import { ComposeEmailForm } from "@/components/ComposeEmailForm";

export default function ComposeEmailPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="text-sm font-medium text-sky-200">Manual outreach</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Compose email</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Write and send a custom email using the Direct Optimize branded template.
        </p>
      </header>
      <ComposeEmailForm />
    </div>
  );
}
