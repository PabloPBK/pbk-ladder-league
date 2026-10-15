
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

export default function TVScreenSettingsPage() {
  const params = useParams<{ id: string }>();
  const screenId = params.id;

  return (
    <AppLayout
      title="TV Settings"
      description="Configure an individual TV display."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin/tv-manager/screens"
          className="text-yellow-400 hover:underline"
        >
          ← Back to TV Screens
        </Link>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-2xl font-bold text-white">
            📺 TV Screen Settings
          </h2>

          <p className="mt-2 text-zinc-400">
            Configure this television independently.
          </p>

          <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-5">
            <p className="text-sm text-zinc-400">
              Screen ID
            </p>

            <p className="mt-2 break-all font-mono text-sm text-white">
              {screenId}
            </p>
          </div>

          <p className="mt-6 text-yellow-400">
            Screen settings are ready for configuration.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
