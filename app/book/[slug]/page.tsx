import { notFound } from "next/navigation";
import { PublicBookingPage } from "@/components/booking/PublicBookingPage";
import { getPublicBookingProfile } from "@/lib/booking";

export const dynamic = "force-dynamic";

export default async function PublicBookingRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublicBookingProfile(slug);
  if (!profile) notFound();
  return <PublicBookingPage profile={profile} />;
}
