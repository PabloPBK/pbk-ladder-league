import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { isUuid } from "@/lib/data/league-listings";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { GuestEditForm } from "./GuestEditForm";

export const dynamic = "force-dynamic";

export default async function PB101GuestEditPage({
  params,
}: {
  params: Promise<{ guestId: string }>;
}) {
  const { guestId } = await params;
  if (!isUuid(guestId)) notFound();

  try {
    await requireStaffUser();
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      redirect("/login?next=" + encodeURIComponent(`/admin/pb101/guests/${guestId}/edit`));
    }
    if (error instanceof Error && error.message === "STAFF_ACCESS_DENIED") notFound();
    throw error;
  }

  const { data: guest, error } = await supabaseAdmin
    .from("pb101_guests")
    .select("id, first_name, last_name, email, pb101_completed_at, trial_start_date, updated_at")
    .eq("id", guestId)
    .maybeSingle();

  if (error) throw new Error("Unable to load the PB101 guest.", { cause: error });
  if (!guest) notFound();

  return (
    <AppLayout title="Edit PB101+ Guest" description={guest.email}>
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={`/admin/pb101/guests#guest-${guest.id}`} className="inline-block text-sm text-blue-300 underline underline-offset-4">
          ← Registered Guests
        </Link>
        <GuestEditForm guest={guest} />
      </div>
    </AppLayout>
  );
}
