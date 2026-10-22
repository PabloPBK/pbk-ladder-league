import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireStaffUser } from "@/lib/server/require-auth";

export const dynamic = "force-dynamic";

export default async function FacilityScheduleLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireStaffUser();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "AUTH_REQUIRED") {
      redirect("/login?next=/admin/facility-schedule");
    }

    if (message === "STAFF_ACCESS_DENIED") {
      return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-yellow-400">
              Staff Access Required
            </h1>

            <p className="mt-4 text-zinc-400">
              You are not authorized to manage the daily
              operations schedule.
            </p>
          </div>
        </main>
      );
    }

    throw error;
  }

  return <>{children}</>;
}
