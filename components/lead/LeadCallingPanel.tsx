"use client";

import { useEffect, useRef, useState } from "react";
import CallIcon from "@mui/icons-material/Call";
import CallEndIcon from "@mui/icons-material/CallEnd";
import HistoryIcon from "@mui/icons-material/History";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import type { Call, INotification, TelnyxRTC } from "@telnyx/webrtc";

type CallRecord = {
  id: string;
  agent: string;
  provider: string;
  phone: string;
  status: string;
  outcome?: string | null;
  notes?: string | null;
  durationSeconds: number;
  followUpAt?: string | null;
  createdAt: string;
};

const fallbackOutcomes = ["Interested", "Callback", "Voicemail", "No answer", "Not interested", "Wrong number", "Qualified"];

function durationLabel(seconds: number) {
  if (!seconds) return "No duration";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function LeadCallingPanel({
  leadId,
  phone,
  region,
  companyName,
  websiteFlags,
  gmbFlags
}: {
  leadId: string;
  phone?: string | null;
  region: string;
  companyName: string;
  websiteFlags: string[];
  gmbFlags: string[];
}) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>(fallbackOutcomes);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [browserCallingAllowed, setBrowserCallingAllowed] = useState(false);
  const [callablePhone, setCallablePhone] = useState("");
  const [callState, setCallState] = useState<"idle" | "connecting" | "ringing" | "connected">("idle");
  const [message, setMessage] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [dispositionCallId, setDispositionCallId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [speakerStatus, setSpeakerStatus] = useState<"idle" | "playing" | "blocked">("idle");
  const [manual, setManual] = useState({ outcome: "No answer", durationMinutes: "0", notes: "", followUpAt: "" });
  const clientRef = useRef<TelnyxRTC | null>(null);
  const callRef = useRef<Call | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  async function playRemoteAudio(activeCall: Call | null) {
    const audio = remoteAudioRef.current;
    if (!audio || !activeCall) return;
    if (activeCall.remoteStream && audio.srcObject !== activeCall.remoteStream) {
      audio.srcObject = activeCall.remoteStream;
    }
    audio.muted = false;
    audio.volume = 1;
    try {
      await audio.play();
      setSpeakerStatus("playing");
    } catch {
      setSpeakerStatus("blocked");
      setMessage("Connected, but the browser blocked incoming audio. Press Enable speaker.");
    }
  }

  async function loadCalls() {
    const response = await fetch(`/api/calls?leadId=${encodeURIComponent(leadId)}`);
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Unable to load call history.");
      return;
    }
    setCalls(data.calls ?? []);
    setOutcomes(data.outcomes ?? fallbackOutcomes);
    setProviderConfigured(Boolean(data.providerConfigured));
    setBrowserCallingAllowed(Boolean(data.browserCallingAllowed));
    setCallablePhone(data.callablePhone ?? "");
  }

  useEffect(() => {
    void loadCalls();
    return () => {
      const activeCall = callRef.current;
      const activeClient = clientRef.current;
      void (async () => {
        if (activeCall && !["hangup", "destroy", "destroyed"].includes(activeCall.state)) {
          await activeCall.hangup().catch(() => undefined);
        }
        await activeClient?.disconnect().catch(() => undefined);
      })();
    };
  }, [leadId]);

  async function patchCall(callId: string, body: Record<string, unknown>) {
    await fetch(`/api/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async function startTelnyxCall() {
    if (!callablePhone || callState !== "idle") return;
    setMessage("");
    setCallState("connecting");
    let callLogId = "";
    try {
      const tokenResponse = await fetch("/api/calls/token");
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Unable to initialize Telnyx.");

      const logResponse = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, provider: "telnyx", phone: callablePhone })
      });
      const logData = await logResponse.json();
      if (!logResponse.ok) throw new Error(logData.error || "Unable to create the call log.");
      callLogId = logData.call.id;
      setDispositionCallId(callLogId);

      const { TelnyxRTC } = await import("@telnyx/webrtc");
      const client = new TelnyxRTC({ login_token: tokenData.token, enableCallReports: true });
      clientRef.current = client;
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (!settled) reject(new Error("Telnyx connection timed out."));
        }, 15000);
        client.on("telnyx.ready", () => {
          settled = true;
          window.clearTimeout(timeout);
          resolve();
        });
        client.on("telnyx.error", (event) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          reject(new Error(event.error.message || "Telnyx connection failed."));
        });
        void client.connect().catch(reject);
      });
      const call = client.newCall({
        destinationNumber: callablePhone,
        callerNumber: tokenData.callerNumber,
        audio: true,
        remoteElement: remoteAudioRef.current ?? undefined,
        customHeaders: [{ name: "X-Call-Log-ID", value: callLogId }]
      });
      callRef.current = call;
      await patchCall(callLogId, { providerCallSid: call.id, status: "requesting" });
      setMessage(`Calling ${companyName}...`);
      let finished = false;
      const finish = async (endedCall: Call) => {
        if (finished) return;
        finished = true;
        const wasConnected = connectedAtRef.current !== null;
        const durationSeconds = wasConnected ? Math.max(0, Math.round((Date.now() - connectedAtRef.current!) / 1000)) : 0;
        const code = endedCall.sipCode || endedCall.causeCode || 0;
        const reason = endedCall.sipReason || endedCall.cause || "Carrier rejected the call";
        const finalStatus = wasConnected ? "completed" : code === 486 ? "busy" : [408, 480].includes(code) ? "no-answer" : "failed";
        connectedAtRef.current = null;
        await patchCall(callLogId, { status: finalStatus, durationSeconds });
        setCallState("idle");
        setMessage(wasConnected ? "Call ended. Add an outcome while the conversation is fresh." : `Call failed${code ? ` (${code})` : ""}: ${reason}`);
        callRef.current = null;
        setShowManual(true);
        void loadCalls();
      };
      client.on("telnyx.notification", (notification: INotification) => {
        if (!notification.call || notification.call.id !== call.id) return;
        const state = notification.call?.state;
        if (state === "requesting" || state === "new") setCallState("connecting");
        if (state === "ringing") {
          setCallState("ringing");
          void patchCall(callLogId, { status: "ringing" });
        }
        if (state === "active") {
          connectedAtRef.current ??= Date.now();
          setCallState("connected");
          setMessage(`Connected to ${companyName}.`);
          void playRemoteAudio(notification.call);
          void patchCall(callLogId, { status: "in-progress" });
        }
        if (state === "hangup") void finish(notification.call);
        if (state === "destroy" || state === "destroyed") {
          void (async () => {
            await finish(notification.call!);
            await client.disconnect().catch(() => undefined);
            if (clientRef.current === client) clientRef.current = null;
          })();
        }
      });
    } catch (error) {
      await clientRef.current?.disconnect().catch(() => undefined);
      clientRef.current = null;
      callRef.current = null;
      setCallState("idle");
      setMessage(error instanceof Error ? error.message : "Unable to start the call.");
      if (callLogId) await patchCall(callLogId, { status: "failed" });
      setDispositionCallId(null);
    }
  }

  function endCall() {
    void callRef.current?.hangup();
  }

  async function saveManualCall() {
    if (!callablePhone) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(dispositionCallId ? `/api/calls/${dispositionCallId}` : "/api/calls", {
        method: dispositionCallId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dispositionCallId ? {
          outcome: manual.outcome,
          notes: manual.notes,
          followUpAt: manual.followUpAt || null
        } : {
          leadId,
          provider: "manual",
          phone: callablePhone,
          outcome: manual.outcome,
          durationSeconds: Math.max(0, Number(manual.durationMinutes) || 0) * 60,
          notes: manual.notes,
          followUpAt: manual.followUpAt || null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the call.");
      setManual({ outcome: "No answer", durationMinutes: "0", notes: "", followUpAt: "" });
      setShowManual(false);
      setDispositionCallId(null);
      setMessage("Call logged successfully.");
      await loadCalls();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the call.");
    } finally {
      setSaving(false);
    }
  }

  const canCall = Boolean(callablePhone && browserCallingAllowed && providerConfigured);
  const talkingPoints = [...websiteFlags.slice(0, 2), ...gmbFlags.slice(0, 2)];

  return (
    <section className="glass rounded-xl p-5">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CallIcon className="text-emerald-200" fontSize="small" />
            <h2 className="font-semibold text-white">Calling workspace</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">Browser calls for USA, Canada, and UK. Manual logs keep Qatar and UAE activity in the same timeline.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {callState === "idle" ? (
            <button onClick={startTelnyxCall} disabled={!canCall} title={!phone ? "No phone number" : !browserCallingAllowed ? "Use manual calling for this region" : !providerConfigured ? "Add Telnyx credentials first" : "Call in browser"} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-45">
              <CallIcon fontSize="small" />
              Call with Telnyx
            </button>
          ) : (
            <button onClick={endCall} disabled={callState === "connecting"} className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-400 px-4 text-sm font-semibold text-slate-950 hover:bg-rose-300 disabled:opacity-60">
              <CallEndIcon fontSize="small" />
              {callState === "connected" ? "End Call" : "Connecting..."}
            </button>
          )}
          <button onClick={() => { setDispositionCallId(null); setShowManual((value) => !value); }} disabled={!phone} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-semibold text-white soft-border hover:bg-white/12 disabled:opacity-45">
            <NoteAddIcon fontSize="small" />
            Log Manual Call
          </button>
          <button onClick={() => void playRemoteAudio(callRef.current)} disabled={!callRef.current} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-semibold text-white soft-border hover:bg-white/12 disabled:opacity-45">
            <VolumeUpIcon fontSize="small" /> {speakerStatus === "playing" ? "Speaker active" : "Enable speaker"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg bg-white/6 p-4 soft-border">
          <div className="text-xs uppercase text-slate-500">Call target</div>
          <div className="mt-2 font-semibold text-white">{companyName}</div>
          <div className="mt-1 text-sm text-slate-300">{phone || "No phone number available"}</div>
          <div className="mt-3 text-xs text-slate-400">Region: {region} · Integrated calling: {browserCallingAllowed ? "Supported" : "Manual"}</div>
        </div>
        <div className="rounded-lg bg-white/6 p-4 soft-border">
          <div className="text-xs uppercase text-slate-500">Audit talking points</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {talkingPoints.length ? talkingPoints.map((point) => <span key={point} className="rounded-md bg-sky-400/10 px-3 py-1 text-sm text-sky-100 soft-border">{point}</span>) : <span className="text-sm text-slate-400">No major audit gaps available. Review the lead before calling.</span>}
          </div>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg bg-sky-400/10 p-3 text-sm text-sky-100 soft-border">{message}</div>}

      {showManual && (
        <div className="mt-4 grid gap-3 rounded-lg bg-black/20 p-4 soft-border md:grid-cols-2">
          {dispositionCallId && <div className="md:col-span-2 text-sm font-medium text-emerald-200">Complete the outcome for the Telnyx call that just ended.</div>}
          <label className="text-sm text-slate-300">Outcome
            <select value={manual.outcome} onChange={(event) => setManual({ ...manual, outcome: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-line bg-[#091629] px-3 text-white outline-none focus:border-sky-300">
              {outcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}
            </select>
          </label>
          {!dispositionCallId && <label className="text-sm text-slate-300">Duration in minutes
            <input type="number" min="0" max="1440" value={manual.durationMinutes} onChange={(event) => setManual({ ...manual, durationMinutes: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>}
          <label className="text-sm text-slate-300 md:col-span-2">Call notes
            <textarea value={manual.notes} onChange={(event) => setManual({ ...manual, notes: event.target.value })} rows={4} className="mt-2 w-full rounded-lg border border-line bg-black/20 p-3 text-white outline-none focus:border-sky-300" />
          </label>
          <label className="text-sm text-slate-300">Follow-up date
            <input type="datetime-local" value={manual.followUpAt} onChange={(event) => setManual({ ...manual, followUpAt: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
          <div className="flex items-end">
            <button onClick={saveManualCall} disabled={saving} className="h-11 w-full rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">{saving ? "Saving..." : "Save Call Log"}</button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><HistoryIcon fontSize="small" />Call history</div>
        {calls.length === 0 ? (
          <div className="rounded-lg bg-white/6 p-4 text-sm text-slate-400 soft-border">No calls logged for this lead.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {calls.map((call) => (
              <div key={call.id} className="rounded-lg bg-white/6 p-4 soft-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{call.outcome || call.status}</div>
                    <div className="mt-1 text-xs text-slate-400">{call.agent} · {call.provider === "telnyx" ? "Telnyx" : "Manual"} · {durationLabel(call.durationSeconds)}</div>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(call.createdAt).toLocaleString()}</div>
                </div>
                {call.notes && <p className="mt-3 text-sm leading-6 text-slate-300">{call.notes}</p>}
                {call.followUpAt && <div className="mt-3 text-xs text-amber-200">Follow up: {new Date(call.followUpAt).toLocaleString()}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
