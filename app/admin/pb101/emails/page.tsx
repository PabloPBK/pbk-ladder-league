
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function PB101EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  await requireStaffUser();

  const params = await searchParams;

  const { data, error } = await supabaseAdmin
    .from("pb101_google_oauth")
    .select("sender_email, connected_at, updated_at")
    .eq("id", 1)
    .maybeSingle();

  const connected = !error && !!data;

  const statusMessage =
    params.google === "connected"
      ? "Google authorization completed successfully."
      : params.google
        ? `Google connection result: ${params.google}`
        : null;

  return (
    <AppLayout
      title="PB101+ Email Automation"
      description="Manage the email experience for PB101+ guests."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {statusMessage && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-white">
            {statusMessage}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold text-white">
            Gmail Connection
          </h2>

          <div className="mt-4 space-y-3">
            <p className="text-zinc-300">
              Status:{" "}
              <span
                className={
                  connected
                    ? "font-bold text-green-400"
                    : "font-bold text-yellow-400"
                }
              >
                {connected ? "Connected" : "Not connected"}
              </span>
            </p>

            {connected && (
              <>
                <p className="text-zinc-300">
                  Sending account: {data.sender_email}
                </p>

                <p className="text-sm text-zinc-400">
                  Connected:{" "}
                  {new Date(
                    data.connected_at
                  ).toLocaleString()}
                </p>
              </>
            )}

            {error && (
              <p className="text-red-400">
                Unable to verify Gmail connection.
              </p>
            )}

            <Link
              href="/api/pb101/google/connect"
              className="inline-block rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300"
            >
              {connected
                ? "Reconnect Gmail"
                : "Connect Gmail"}
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold text-white">
            Automated Guest Emails
          </h2>

          <p className="mt-3 text-zinc-300">
            This section will manage the automated
            messages sent during the seven-day
            PB101+ guest experience.
          </p>

          <p className="mt-4 text-sm font-semibold text-yellow-400">
            Automated sending is not enabled yet.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
