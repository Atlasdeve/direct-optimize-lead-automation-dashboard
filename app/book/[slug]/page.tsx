import { notFound } from "next/navigation";
import { PublicBookingPage } from "@/components/booking/PublicBookingPage";
import { getPublicBookingProfile } from "@/lib/booking";

export const dynamic = "force-dynamic";

export default async function PublicBookingRoute({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ company?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const profile = await getPublicBookingProfile(slug);
  if (!profile) notFound();
  const initialCompanyName = typeof query.company === "string" ? query.company.trim().slice(0, 160) : "";
  return <PublicBookingPage profile={profile} initialCompanyName={initialCompanyName} />;
}
