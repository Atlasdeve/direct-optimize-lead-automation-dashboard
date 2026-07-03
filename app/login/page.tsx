import ShieldIcon from "@mui/icons-material/Shield";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl place-items-center">
      <section className="glass w-full max-w-md rounded-xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-200 soft-border">
            <ShieldIcon />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Direct Optimize</h1>
            <p className="text-sm text-slate-400">Admin login</p>
          </div>
        </div>
        <Suspense fallback={<div className="rounded-lg bg-white/6 p-4 text-sm text-slate-300 soft-border">Loading auth form...</div>}>
          <AuthForm />
        </Suspense>
      </section>
    </div>
  );
}
