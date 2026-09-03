/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import ShieldIcon from "@mui/icons-material/Shield";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { prisma } from "@/lib/prisma";

export default async function OrganizationLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { name: true, slug: true, companyName: true, logoUrl: true, brandColor: true, plan: true, systemStatus: true }
  });
  if (!organization) notFound();

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl place-items-center px-4 py-8">
      <section className="glass w-full max-w-md rounded-xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-sky-400/15 text-sky-200 soft-border" style={{ color: organization.brandColor }}>
            {organization.logoUrl ? (
              <img src={organization.logoUrl} alt={`${organization.companyName} logo`} className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <ShieldIcon />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{organization.companyName}</h1>
            <p className="text-sm text-slate-400">{organization.systemStatus === "active" ? "Client workspace login" : "Workspace paused"}</p>
          </div>
        </div>
        {organization.systemStatus === "active" ? (
          <Suspense fallback={<div className="rounded-lg bg-white/6 p-4 text-sm text-slate-300 soft-border">Loading auth form...</div>}>
            <AuthForm organizationSlug={organization.slug} />
          </Suspense>
        ) : (
          <div className="rounded-lg bg-amber-400/10 p-4 text-sm text-amber-100 soft-border">
            This client workspace is paused by the Direct Optimize super admin.
          </div>
        )}
      </section>
    </main>
  );
}
