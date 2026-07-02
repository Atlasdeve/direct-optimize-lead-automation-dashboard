"use client";

import { useEffect, useRef, useState } from "react";
import CallIcon from "@mui/icons-material/Call";
import CallEndIcon from "@mui/icons-material/CallEnd";
import HistoryIcon from "@mui/icons-material/History";
import SaveIcon from "@mui/icons-material/Save";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import type { Call, INotification, TelnyxRTC } from "@telnyx/webrtc";

type CallRecord = {
  id: string;
  agent: string;
  contactName?: string | null;
  companyName?: string | null;
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
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function ComposeCallForm() {
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>(fallbackOutcomes);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [callState, setCallState] = useState<"idle" | "connecting" | "ringing" | "connected">("idle");
  const [message, setMessage] = useState("");
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [showDisposition, setShowDisposition] = useState(false);
  const [saving, setSaving] = useState(false);
  const [speakerStatus, setSpeakerStatus] = useState<"idle" | "playing" | "blocked">("idle");
  const [disposition, setDisposition] = useState({ outcome: "No answer", notes: "", followUpAt: "" });
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
    const response = await fetch("/api/calls?standalone=1");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Unable to load call history.");
      return;
    }
    setCalls(data.calls ?? []);
    setOutcomes(data.outcomes ?? fallbackOutcomes);
    setProviderConfigured(Boolean(data.providerConfigured));
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
  }, []);

  async function patchCall(callId: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error("Unable to update the call log.");
  }

  async function startCall() {
    if (!phone.trim() || callState !== "idle") return;
    setMessage("");
    setShowDisposition(false);
    setCallState("connecting");
    let callLogId = "";
    try {
      const tokenResponse = await fetch("/api/calls/token");
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Unable to initialize Telnyx.");

      const logResponse = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "telnyx", phone, contactName, companyName })
      });
      const logData = await logResponse.json();
      if (!logResponse.ok) throw new Error(logData.error || "Unable to create the call log.");
      callLogId = logData.call.id;
      setActiveLogId(callLogId);

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
        destinationNumber: logData.call.phone,
        callerNumber: tokenData.callerNumber,
        audio: true,
        remoteElement: remoteAudioRef.current ?? undefined,
        customHeaders: [{ name: "X-Call-Log-ID", value: callLogId }]
      });
      callRef.current = call;
      await patchCall(callLogId, { providerCallSid: call.id, status: "requesting" });
      setMessage(`Calling ${contactName || companyName || logData.call.phone}...`);

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
        setMessage(wasConnected ? "Call ended. Record the outcome and next step." : `Call failed${code ? ` (${code})` : ""}: ${reason}`);
        callRef.current = null;
        setShowDisposition(true);
        void loadCalls();
      };

      client.on("telnyx.notification", (notification: INotification) => {
        if (!notification.call || notification.call.id !== call.id) return;
        const state = notification.call.state;
        if (state === "requesting" || state === "new") setCallState("connecting");
        if (state === "ringing") {
          setCallState("ringing");
          void patchCall(callLogId, { status: "ringing" });
        }
        if (state === "active") {
          connectedAtRef.current ??= Date.now();
          setCallState("connected");
          setMessage(`Connected to ${contactName || companyName || logData.call.phone}.`);
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
      if (callLogId) await patchCall(callLogId, { status: "failed" }).catch(() => undefined);
      setActiveLogId(null);
      void loadCalls();
    }
  }

  async function saveDisposition() {
    if (!activeLogId) return;
    setSaving(true);
    try {
      await patchCall(activeLogId, {
        outcome: disposition.outcome,
        notes: disposition.notes,
        followUpAt: disposition.followUpAt || null
      });
      setDisposition({ outcome: "No answer", notes: "", followUpAt: "" });
      setShowDisposition(false);
      setActiveLogId(null);
      setMessage("Call outcome saved.");
      await loadCalls();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the outcome.");
    } finally {
      setSaving(false);
    }
  }

  const target = contactName || companyName || "Custom recipient";

  return (
    <div className="space-y-6">
      <section className="glass rounded-xl p-5">
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.15fr_auto] lg:items-end">
          <label className="text-sm text-slate-300">Recipient name
            <input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Jane Smith" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
          <label className="text-sm text-slate-300">Company
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Example Company" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
          <label className="text-sm text-slate-300">Phone number
            <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="+14165550123" className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
          </label>
          {callState === "idle" ? (
            <button onClick={startCall} disabled={!providerConfigured || !phone.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-45">
              <CallIcon fontSize="small" /> Call
            </button>
          ) : (
            <button onClick={() => void callRef.current?.hangup()} disabled={!callRef.current} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-rose-400 px-5 font-semibold text-slate-950 hover:bg-rose-300 disabled:opacity-60">
              <CallEndIcon fontSize="small" /> {callState === "connected" ? "End" : callState === "ringing" ? "Ringing" : "Connecting"}
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/6 p-4 soft-border">
          <div><div className="text-xs uppercase text-slate-500">Current target</div><div className="mt-1 font-semibold text-white">{target}</div></div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-300">Use international E.164 format, including the country code.</div>
            <button onClick={() => void playRemoteAudio(callRef.current)} disabled={!callRef.current} className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/8 px-3 text-sm font-semibold text-white soft-border hover:bg-white/12 disabled:opacity-45">
              <VolumeUpIcon fontSize="small" /> {speakerStatus === "playing" ? "Speaker active" : "Enable speaker"}
            </button>
          </div>
        </div>
        {message && <div className="mt-4 rounded-lg bg-sky-400/10 p-3 text-sm text-sky-100 soft-border">{message}</div>}

        {showDisposition && activeLogId && (
          <div className="mt-4 grid gap-3 rounded-lg bg-black/20 p-4 soft-border md:grid-cols-2">
            <label className="text-sm text-slate-300">Outcome
              <select value={disposition.outcome} onChange={(event) => setDisposition({ ...disposition, outcome: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-line bg-[#091629] px-3 text-white outline-none focus:border-sky-300">
                {outcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">Follow-up date
              <input type="datetime-local" value={disposition.followUpAt} onChange={(event) => setDisposition({ ...disposition, followUpAt: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-line bg-black/20 px-3 text-white outline-none focus:border-sky-300" />
            </label>
            <label className="text-sm text-slate-300 md:col-span-2">Call notes
              <textarea rows={4} value={disposition.notes} onChange={(event) => setDisposition({ ...disposition, notes: event.target.value })} className="mt-2 w-full rounded-lg border border-line bg-black/20 p-3 text-white outline-none focus:border-sky-300" />
            </label>
            <button onClick={saveDisposition} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60 md:col-span-2">
              <SaveIcon fontSize="small" /> {saving ? "Saving..." : "Save outcome"}
            </button>
          </div>
        )}
      </section>

      <section className="glass rounded-xl p-5">
        <div className="flex items-center gap-2"><HistoryIcon className="text-sky-200" fontSize="small" /><h2 className="font-semibold text-white">Custom call history</h2></div>
        {calls.length === 0 ? <div className="mt-4 rounded-lg bg-white/6 p-4 text-sm text-slate-400 soft-border">No custom calls logged yet.</div> : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {calls.map((call) => (
              <div key={call.id} className="rounded-lg bg-white/6 p-4 soft-border">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="font-semibold text-white">{call.contactName || call.companyName || call.phone}</div><div className="mt-1 text-xs text-slate-400">{call.companyName || call.phone} · {call.agent}</div></div>
                  <div className="text-xs text-slate-500">{new Date(call.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-3 flex gap-3 text-sm text-slate-300"><span>{call.outcome || call.status}</span><span>{durationLabel(call.durationSeconds)}</span></div>
                {call.notes && <p className="mt-3 text-sm leading-6 text-slate-300">{call.notes}</p>}
                {call.followUpAt && <div className="mt-3 text-xs text-amber-200">Follow up: {new Date(call.followUpAt).toLocaleString()}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
