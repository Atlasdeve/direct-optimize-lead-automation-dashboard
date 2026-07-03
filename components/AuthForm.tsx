"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

type Mode = "login" | "register";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "login"
          ? { identifier, password }
          : { username, email, name, password }
      )
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Authentication failed.");
      return;
    }
    const next = searchParams.get("next");
    router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-white/6 p-1 soft-border">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={mode === "login" ? "h-10 rounded-md bg-sky-400 font-semibold text-slate-950" : "h-10 rounded-md text-sm font-medium text-slate-300"}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={mode === "register" ? "h-10 rounded-md bg-sky-400 font-semibold text-slate-950" : "h-10 rounded-md text-sm font-medium text-slate-300"}
        >
          Register
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "login" ? (
          <label className="block">
            <span className="text-sm text-slate-300">Username or email</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-line bg-white/7 px-3 text-white outline-none focus:border-sky-300"
              autoComplete="username"
            />
          </label>
        ) : (
          <>
            <label className="block">
              <span className="text-sm text-slate-300">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-line bg-white/7 px-3 text-white outline-none focus:border-sky-300"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-line bg-white/7 px-3 text-white outline-none focus:border-sky-300"
                type="email"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-300">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-line bg-white/7 px-3 text-white outline-none focus:border-sky-300"
                autoComplete="name"
              />
            </label>
          </>
        )}

        <label className="block">
          <span className="text-sm text-slate-300">Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-line bg-white/7 px-3 text-white outline-none focus:border-sky-300"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {error && <div className="rounded-lg bg-rose-400/12 p-3 text-sm text-rose-100 soft-border">{error}</div>}

        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-60"
          disabled={busy}
        >
          {mode === "login" ? <LoginIcon fontSize="small" /> : <PersonAddIcon fontSize="small" />}
          {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
