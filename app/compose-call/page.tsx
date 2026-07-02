import { redirect } from "next/navigation";
import { ComposeCallForm } from "@/components/ComposeCallForm";
import { currentUser } from "@/lib/auth";

export default async function ComposeCallPage() {
  const user = await currentUser();
  if (!user || !["admin", "employee"].includes(user.role)) redirect("/");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="text-sm font-medium text-emerald-200">Manual outreach</div>
        <h1 className="mt-2 text-4xl font-semibold text-white">Compose call</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Call any valid international number through Telnyx without creating a lead first.
        </p>
      </header>
      <ComposeCallForm />
    </div>
  );
}
