import { notFound, redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { getListingSeasonOptions } from "@/lib/server/league-listings";
import { requireRevenueAdmin } from "@/lib/server/require-revenue-admin";
import RevenueDetails from "./RevenueDetails";

export default async function RevenueDetailsPage() {
  try {
    await requireRevenueAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/login?next=%2Fadmin%2Frevenue");
    if (error instanceof Error && ["STAFF_ACCESS_DENIED", "REVENUE_ACCESS_DENIED"].includes(error.message)) notFound();
    throw error;
  }

  const { leagues, seasons } = await getListingSeasonOptions();
  return (
    <AppLayout title="Revenue Details" description="Review league revenue, download reports, and estimate payouts.">
      <RevenueDetails leagues={leagues} seasons={seasons} />
    </AppLayout>
  );
}
