import { notFound, redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { requireStaffUser } from "@/lib/server/require-auth";
import LeaguePlanForm from "./LeaguePlanForm";

export default async function NewLeaguePage() {
  try {
    await requireStaffUser();
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") redirect("/login?next=%2Fadmin%2Fleagues%2Fnew");
    if (error instanceof Error && error.message === "STAFF_ACCESS_DENIED") notFound();
    throw error;
  }

  return (
    <AppLayout title="Create League" description="Set up seasons and session dates for staff.">
      <LeaguePlanForm />
    </AppLayout>
  );
}
