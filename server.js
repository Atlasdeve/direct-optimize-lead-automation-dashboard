const { createServer } = require("http");
const crypto = require("crypto");
const next = require("next");
const WebSocket = require("ws");
const { WebSocketServer } = require("ws");
const { PrismaClient } = require("@prisma/client");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.APP_HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

function streamSecret() {
  return process.env.AI_CALL_STREAM_SECRET || process.env.NEXTAUTH_SECRET || process.env.LEAD_CAPTURE_API_KEY || "";
}

function verifyStreamToken(callLogId, token) {
  const secret = streamSecret();
  if (!secret || !callLogId || !token) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(callLogId).digest("base64url"));
  const received = Buffer.from(token);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function maxDurationSeconds() {
  const configured = Number(process.env.AI_CALL_MAX_SECONDS);
  if (!Number.isFinite(configured)) return 90;
  return Math.max(30, Math.min(180, Math.round(configured)));
}

function buildInstructions(call) {
  const lead = call.lead;
  const contactName = lead?.decisionMakerName || lead?.managerName || lead?.ownerName || "the owner or manager";
  const finding = lead?.researchNote || lead?.notes || "a few quick improvement points around Google visibility and website conversion";
  return [
    "You are Ayesha, a polite appointment coordinator for Direct Optimize.",
    "You are not a salesperson. You are only checking whether the business wants a short free audit sent by email or WhatsApp.",
    "Keep this call under sixty seconds unless the person asks questions. Speak naturally, warmly, and briefly.",
    "Sound calm and human. Use simple words. Do not sound scripted, pushy, or robotic.",
    "Say only one or two short sentences at a time, then stop and wait for the other person.",
    "Never continue talking after asking a question. Ask the question and wait.",
    "Do not mention that the person self-registered unless they directly ask why you are calling.",
    "Your only goal is to ask permission to send a short audit and, if they are interested, ask whether a developer should follow up.",
    "Do not sell deeply. Do not discuss pricing. Do not answer technical questions.",
    "If asked technical questions, say: That's a good question. A developer from our team can explain the audit properly on a short call.",
    "If asked for your name, say: My name is Ayesha, calling from Direct Optimize.",
    "If the person is busy, ask whether email or WhatsApp is better and end politely.",
    "If they say no, no need, or not interested, say: No problem, I understand. We will not bother you further. Have a good day. Then stop.",
    "Never promise rankings, revenue, leads, or guaranteed results.",
    "If interrupted, stop speaking and listen.",
    `Business name: ${lead?.companyName || call.companyName || "the business"}.`,
    `Location: ${[lead?.city, lead?.country].filter(Boolean).join(", ") || lead?.region || "not available"}.`,
    `Contact target: ${contactName}.`,
    `Known email: ${lead?.email || "not available"}.`,
    `Known phone: ${call.phone}.`,
    `Specific observation to mention in one simple sentence: ${finding}.`,
    "Opening line must be exactly one short question: Hi, this is Ayesha from Direct Optimize. Is this the owner or manager? I will be very quick.",
    "After the opening line, wait. Do not explain the audit until they confirm they can listen.",
    "If they confirm, say: We noticed a couple of small online visibility points for your business. Would it be okay if I send you a short audit by email or WhatsApp?",
    "If they say yes, ask which option they prefer: email or WhatsApp.",
    "If they choose email or WhatsApp, thank them and say a developer can follow up only if they want. Then end politely."
  ].join("\n");
}

function updateCall(callLogId, data) {
  return prisma.callLog.update({ where: { id: callLogId }, data }).catch(() => null);
}

async function hangupCall(call) {
  if (!call?.providerCallSid || !process.env.TELNYX_API_KEY) return;
  await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(call.providerCallSid)}/actions/hangup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  }).catch(() => undefined);
}

function inferOutcome(transcript) {
  const text = transcript.toLowerCase();
  if (/\bnot interested\b|\bno need\b|\bstop calling\b|\bdon't call\b/.test(text)) return "Not interested";
  if (/\bwhatsapp\b/.test(text) && /\bsend\b|\baudit\b|\bok\b|\byes\b/.test(text)) return "Send audit by WhatsApp";
  if (/\bemail\b/.test(text) && /\bsend\b|\baudit\b|\bok\b|\byes\b/.test(text)) return "Send audit by email";
  if (/\bmeeting\b|\bdeveloper\b|\bcall me\b|\bschedule\b|\bappointment\b/.test(text)) return "Meeting requested";
  if (/\byes\b|\bok\b|\bsend\b|\binterested\b/.test(text)) return "Interested";
  return "Needs human follow-up";
}

async function finishAiCall({ call, status, transcriptParts, aiParts, reason }) {
  const transcript = transcriptParts.filter(Boolean).join("\n").trim();
  const aiText = aiParts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const durationSeconds = call.startedAt ? Math.max(0, Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000)) : 0;
  const outcome = transcript || aiText ? inferOutcome(`${transcript}\n${aiText}`) : status === "no-answer" ? "No answer" : "Needs human follow-up";
  const notes = [
    `AI appointment setter summary: ${reason || status}.`,
    aiText ? `AI said: ${aiText}` : "",
    transcript ? `Transcript:\n${transcript}` : "Transcript was not returned by the realtime session.",
    "Rule: AI handled appointment setting only. Technical follow-up should be handled by a human."
  ].filter(Boolean).join("\n\n").slice(0, 4000);
  await updateCall(call.id, {
    status,
    outcome,
    notes,
    durationSeconds,
    endedAt: new Date()
  });
  if (call.leadId) {
    await prisma.notification.create({
      data: {
        type: "ai_call_finished",
        title: outcome === "Not interested" ? "AI call: not interested" : "AI call needs review",
        message: `${call.lead?.companyName || call.companyName || call.phone}: ${outcome}.`,
        actionUrl: `/leads/${call.leadId}`,
        leadId: call.leadId
      }
    }).catch(() => undefined);
  }
}

function setupAiCallStream(telnyxWs, request, callLogId) {
  let openaiWs = null;
  let streamId = "";
  let started = false;
  let openaiReady = false;
  let greetingRequested = false;
  let responseActive = false;
  let finished = false;
  const transcriptParts = [];
  const aiParts = [];
  let callRecord = null;

  const closeAll = () => {
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
    if (telnyxWs.readyState === WebSocket.OPEN) telnyxWs.close();
  };

  const finishOnce = async (status, reason) => {
    if (finished) return;
    finished = true;
    clearTimeout(maxTimer);
    if (callRecord) await finishAiCall({ call: callRecord, status, transcriptParts, aiParts, reason });
    closeAll();
  };

  const requestGreeting = () => {
    if (greetingRequested || !streamId || !openaiReady || openaiWs?.readyState !== WebSocket.OPEN) return;
    greetingRequested = true;
    responseActive = true;
    openaiWs.send(JSON.stringify({
      type: "response.create",
      response: {
        instructions: "Say only this exact line, then stop speaking and wait: Hi, this is Ayesha from Direct Optimize. Is this the owner or manager? I will be very quick."
      }
    }));
  };

  const maxTimer = setTimeout(() => {
    void hangupCall(callRecord);
    void finishOnce("completed", "Maximum AI appointment call duration reached.");
  }, maxDurationSeconds() * 1000);

  telnyxWs.on("message", async (raw) => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (event.event === "start") {
      streamId = event.stream_id || event.start?.stream_id || streamId;
      callRecord = await prisma.callLog.findUnique({
        where: { id: callLogId },
        include: { lead: true }
      });
      if (!callRecord) {
        void finishOnce("failed", "Call log was not found.");
        return;
      }
      await updateCall(callLogId, { status: "in-progress", answeredAt: new Date() });

      openaiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini")}`, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });

      openaiWs.on("open", () => {
        openaiWs.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            output_modalities: ["audio"],
            instructions: buildInstructions(callRecord),
            audio: {
              input: {
                format: { type: "audio/pcmu" },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 650,
                  interrupt_response: true
                }
              },
              output: {
                format: { type: "audio/pcmu" },
                voice: process.env.OPENAI_REALTIME_VOICE || "shimmer"
              }
            }
          }
        }));
        started = true;
      });

      openaiWs.on("message", (openaiRaw) => {
        let aiEvent;
        try {
          aiEvent = JSON.parse(openaiRaw.toString());
        } catch {
          return;
        }
        if (aiEvent.type === "session.updated" || aiEvent.type === "session.created") {
          openaiReady = true;
          requestGreeting();
        }
        if (aiEvent.type === "response.created") responseActive = true;
        if (aiEvent.type === "response.done" || aiEvent.type === "response.cancelled") responseActive = false;
        if ((aiEvent.type === "response.audio.delta" || aiEvent.type === "response.output_audio.delta") && aiEvent.delta && telnyxWs.readyState === WebSocket.OPEN && streamId) {
          telnyxWs.send(JSON.stringify({ event: "media", stream_id: streamId, media: { payload: aiEvent.delta } }));
        }
        if (aiEvent.type === "input_audio_buffer.speech_started" && telnyxWs.readyState === WebSocket.OPEN && streamId) {
          if (responseActive && openaiWs.readyState === WebSocket.OPEN) {
            responseActive = false;
            openaiWs.send(JSON.stringify({ type: "response.cancel" }));
          }
          telnyxWs.send(JSON.stringify({ event: "clear", stream_id: streamId }));
        }
        if (aiEvent.type === "conversation.item.input_audio_transcription.completed" && aiEvent.transcript) {
          transcriptParts.push(`Lead: ${aiEvent.transcript}`);
        }
        if ((aiEvent.type === "response.audio_transcript.done" || aiEvent.type === "response.output_audio_transcript.done") && aiEvent.transcript) {
          transcriptParts.push(`AI: ${aiEvent.transcript}`);
          aiParts.push(aiEvent.transcript);
        }
        if (aiEvent.type === "error") {
          const message = aiEvent.error?.message || "unknown error";
          console.error("OpenAI realtime error", message);
          transcriptParts.push(`System: OpenAI realtime error: ${message}`);
        }
      });

      openaiWs.on("close", () => {
        if (!finished && started) void finishOnce("completed", "OpenAI realtime session closed.");
      });
      openaiWs.on("error", (error) => {
        console.error("OpenAI realtime websocket failed", error?.message || error);
        void finishOnce("failed", "OpenAI realtime session failed.");
      });
      requestGreeting();
      return;
    }

    if (event.event === "media" && event.media?.payload && openaiWs?.readyState === WebSocket.OPEN) {
      openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: event.media.payload }));
      return;
    }

    if (event.event === "stop" || event.event === "closed") {
      void finishOnce("completed", "Telnyx media stream ended.");
    }
  });

  telnyxWs.on("close", () => {
    if (!finished) void finishOnce(started ? "completed" : "no-answer", started ? "Phone media stream closed." : "Call ended before media stream started.");
  });
  telnyxWs.on("error", () => void finishOnce("failed", "Telnyx media stream failed."));
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const aiCallWss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname !== "/api/calls/ai/stream") {
      socket.destroy();
      return;
    }
    const callLogId = url.searchParams.get("callLogId") || "";
    const token = url.searchParams.get("token");
    if (!verifyStreamToken(callLogId, token)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    aiCallWss.handleUpgrade(request, socket, head, (ws) => {
      setupAiCallStream(ws, request, callLogId);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`Direct Optimize listening on ${hostname}:${port}`);
    console.log("AI appointment call media stream endpoint ready at /api/calls/ai/stream");
  });
});
