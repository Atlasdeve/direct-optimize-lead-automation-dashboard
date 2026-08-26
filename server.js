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
  if (!Number.isFinite(configured)) return 120;
  return Math.max(45, Math.min(240, Math.round(configured)));
}

function buildInstructions(call) {
  const lead = call.lead;
  const contactName = lead?.decisionMakerName || lead?.managerName || lead?.ownerName || "the owner or manager";
  const finding = lead?.researchNote || lead?.notes || "a few quick improvement points around Google visibility and website conversion";
  return [
    "You are Trevor, a polite appointment coordinator for Direct Optimize.",
    "Your tone is friendly, light, confident, and conversational. Smile while speaking. Do not sound like a system voice.",
    "You are not a salesperson. You are asking for a tiny bit of help so you can confirm whether the business owner wants a short free online-presence audit.",
    "Keep this call under ninety seconds unless the person is clearly interested. Speak naturally, warmly, and briefly.",
    "Sound calm and human. Use simple words. Do not sound scripted, pushy, robotic, or like a cold call.",
    "Use small natural acknowledgements when appropriate, like 'sure', 'okay', 'right', or 'I understand', but do not overuse them.",
    "Do not make every sentence perfect. Keep it polite but slightly conversational.",
    "Pause briefly before answering, as a human would.",
    "Say only one or two short sentences at a time, then stop and wait for the other person.",
    "Never continue talking after asking a question. Ask the question and wait.",
    "Do not mention that the person self-registered unless they directly ask why you are calling.",
    "Do not repeat the same question. If they already did not answer email or WhatsApp, ask once in a different way, then move on or end politely.",
    "Do not treat tiny fragments like 'y', 'uh', 'hmm', 'a', or unclear words as agreement. Ask a clarifying question instead.",
    "Only ask for email or WhatsApp after the person clearly says yes, okay, sure, send it, or asks you to send the audit.",
    "The opening should feel like a real person asking for quick help, not like a pitch.",
    "Your only goal is to ask permission to send a short audit and, if they are interested, ask whether a developer should follow up.",
    "Do not sell deeply. Do not discuss pricing. Do not answer technical questions.",
    "If they ask why you are calling or what the point is, answer naturally: Sure. I was reviewing your business listing and noticed a few quick online visibility points. I just wanted to ask if you would be open to a short audit, no obligation.",
    "If they ask what Direct Optimize does, say: We help businesses improve their website, Google visibility, and lead conversion. For now I am only asking permission to send a quick audit.",
    "If they ask what kind of audit, answer directly: It is a simple online presence audit. We check the website basics, Google Business Profile visibility, reviews, contact path, and a few conversion points. Then ask: Would you like me to send that over?",
    "If asked technical questions beyond the audit overview, say: That's a good question. A developer from our team can explain the audit properly on a short call.",
    "If asked for your name, say: My name is Trevor, calling from Direct Optimize.",
    "If the person is busy, ask whether email or WhatsApp is better and end politely.",
    "If they say no, no need, or not interested, say: No problem, I understand. We will not bother you further. Have a good day. Then stop.",
    "If they sound confused or the transcript is unclear, say: Sorry, I may have missed that. Are you asking what the audit includes?",
    "If the person speaks Urdu, Hindi, or another language you recognize, respond briefly in that language if you can. Do not keep pushing English channel questions.",
    "If they ask if this is AI or a bot, be honest: I am an AI assistant helping Direct Optimize with initial appointment calls. A real developer will handle any detailed discussion.",
    "Never promise rankings, revenue, leads, or guaranteed results.",
    "If interrupted, stop speaking and listen.",
    `Business name: ${lead?.companyName || call.companyName || "the business"}.`,
    `Location: ${[lead?.city, lead?.country].filter(Boolean).join(", ") || lead?.region || "not available"}.`,
    `Contact target: ${contactName}.`,
    `Known email: ${lead?.email || "not available"}.`,
    `Known phone: ${call.phone}.`,
    `Specific observation to mention in one simple sentence: ${finding}.`,
    "Opening line must be exactly one short question: Hi, is this the owner or manager of the business?",
    "After they confirm, say exactly: Hi, this is Trevor from Direct Optimize. I was reviewing your business listing. Can you help me out for a moment?",
    "After the help question, wait. Do not explain the audit until they confirm they can help, can listen, or ask what this is about.",
    "If they confirm they can help or listen, say: Brilliant, thanks. I noticed a couple of small online visibility points. Would it be okay if I send you a short audit?",
    "Only after they agree to receive the audit, ask: Would email or WhatsApp be easier?",
    "If they choose email or WhatsApp, thank them and ask one final soft question: Would you like a developer to explain it after you review it, or should we just send it first?",
    "If they do not choose a channel after two attempts, say: No worries, I do not want to take more of your time. Have a good day. Then stop."
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
  if (/\bnot interested\b|\bno need\b|\bstop calling\b|\bdon't call\b|\bwon't bother\b/.test(text)) return "Not interested";
  if (/\bdeveloper\b/.test(text) && /\bfollow up\b|\bexplain\b|\bcall\b/.test(text) && /\byes\b|\bok\b|\bsure\b|\bplease\b/.test(text)) return "Developer follow-up requested";
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
  const humanReplyDelayMs = Number.isFinite(Number(process.env.AI_CALL_REPLY_DELAY_MS))
    ? Math.max(250, Math.min(1800, Number(process.env.AI_CALL_REPLY_DELAY_MS)))
    : 700;
  let openaiWs = null;
  let streamId = "";
  let started = false;
  let openaiReady = false;
  let greetingRequested = false;
  let responseActive = false;
  let interruptedResponse = false;
  let leadSpeaking = false;
  let suppressAiAudioUntil = 0;
  let manualResponseTimer = null;
  let finished = false;
  const transcriptParts = [];
  const aiParts = [];
  const aiAudioQueue = [];
  let aiAudioTimer = null;
  let aiAudioDelaySatisfied = false;
  let callRecord = null;

  const closeAll = () => {
    if (aiAudioTimer) clearTimeout(aiAudioTimer);
    if (manualResponseTimer) clearTimeout(manualResponseTimer);
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
    if (telnyxWs.readyState === WebSocket.OPEN) telnyxWs.close();
  };

  const clearAiAudioQueue = () => {
    aiAudioQueue.length = 0;
    aiAudioDelaySatisfied = false;
    if (aiAudioTimer) {
      clearTimeout(aiAudioTimer);
      aiAudioTimer = null;
    }
  };

  const flushAiAudioQueue = () => {
    aiAudioTimer = null;
    if (interruptedResponse || leadSpeaking || Date.now() < suppressAiAudioUntil || telnyxWs.readyState !== WebSocket.OPEN || !streamId) {
      clearAiAudioQueue();
      return;
    }
    aiAudioDelaySatisfied = true;
    while (aiAudioQueue.length) {
      telnyxWs.send(JSON.stringify({ event: "media", stream_id: streamId, media: { payload: aiAudioQueue.shift() } }));
    }
  };

  const enqueueAiAudio = (payload) => {
    if (interruptedResponse || leadSpeaking || Date.now() < suppressAiAudioUntil || telnyxWs.readyState !== WebSocket.OPEN || !streamId) return;
    if (aiAudioDelaySatisfied) {
      telnyxWs.send(JSON.stringify({ event: "media", stream_id: streamId, media: { payload } }));
      return;
    }
    aiAudioQueue.push(payload);
    if (!aiAudioTimer) {
      const jitter = Math.floor(Math.random() * 250);
      aiAudioTimer = setTimeout(flushAiAudioQueue, humanReplyDelayMs + jitter);
    }
    if (aiAudioQueue.length > 80) flushAiAudioQueue();
  };

  const requestFollowupResponse = () => {
    if (!openaiReady || responseActive || leadSpeaking || openaiWs?.readyState !== WebSocket.OPEN) return;
    responseActive = true;
    openaiWs.send(JSON.stringify({
      type: "response.create",
      response: {
        instructions: "Reply naturally to what the caller just said. Answer their question first. Keep it to one or two short sentences, then ask only one simple next question if needed."
      }
    }));
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
        instructions: "Say only this exact line, then stop speaking and wait: Hi, is this the owner or manager of the business?"
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
                transcription: { model: "gpt-4o-mini-transcribe" },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.62,
                  prefix_padding_ms: 500,
                  silence_duration_ms: 1200,
                  interrupt_response: true,
                  create_response: true
                }
              },
              output: {
                format: { type: "audio/pcmu" },
                voice: process.env.OPENAI_REALTIME_VOICE || "coral"
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
        if (aiEvent.type === "response.created") {
          responseActive = true;
          aiAudioDelaySatisfied = false;
        }
        if (aiEvent.type === "response.done" || aiEvent.type === "response.cancelled") {
          responseActive = false;
          interruptedResponse = false;
          aiAudioDelaySatisfied = false;
        }
        if ((aiEvent.type === "response.audio.delta" || aiEvent.type === "response.output_audio.delta") && aiEvent.delta && telnyxWs.readyState === WebSocket.OPEN && streamId) {
          if (interruptedResponse || leadSpeaking || Date.now() < suppressAiAudioUntil) return;
          enqueueAiAudio(aiEvent.delta);
        }
        if (aiEvent.type === "input_audio_buffer.speech_started" && telnyxWs.readyState === WebSocket.OPEN && streamId) {
          leadSpeaking = true;
          if (manualResponseTimer) {
            clearTimeout(manualResponseTimer);
            manualResponseTimer = null;
          }
          interruptedResponse = responseActive;
          suppressAiAudioUntil = Date.now() + 1600;
          clearAiAudioQueue();
          telnyxWs.send(JSON.stringify({ event: "clear", stream_id: streamId }));
        }
        if (aiEvent.type === "input_audio_buffer.speech_stopped") {
          leadSpeaking = false;
          suppressAiAudioUntil = Date.now() + 700;
          if (!responseActive) {
            manualResponseTimer = setTimeout(requestFollowupResponse, 900);
          }
        }
        if (
          (aiEvent.type === "conversation.item.input_audio_transcription.completed" ||
            aiEvent.type === "conversation.item.input_audio_transcription.done" ||
            aiEvent.type === "conversation.item.audio_transcription.completed" ||
            aiEvent.type === "conversation.item.audio_transcription.done") &&
          aiEvent.transcript
        ) {
          transcriptParts.push(`Lead: ${aiEvent.transcript}`);
          if (!responseActive && openaiReady) {
            if (manualResponseTimer) clearTimeout(manualResponseTimer);
            manualResponseTimer = setTimeout(requestFollowupResponse, 500);
          }
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
        console.log("OpenAI realtime websocket closed", { callLogId, started });
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
      console.log("Telnyx media stream stopped", {
        callLogId,
        event: event.event,
        streamId,
        sequenceNumber: event.sequence_number || event.sequenceNumber,
        reason: event.reason || event.stop?.reason
      });
      void finishOnce("completed", "Telnyx media stream ended.");
    }
  });

  telnyxWs.on("close", () => {
    console.log("Telnyx websocket closed", { callLogId, started, finished });
    if (!finished) void finishOnce(started ? "completed" : "no-answer", started ? "Phone media stream closed." : "Call ended before media stream started.");
  });
  telnyxWs.on("error", (error) => {
    console.error("Telnyx media stream failed", error?.message || error);
    void finishOnce("failed", "Telnyx media stream failed.");
  });
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
