import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

export default function PresentationsPage() {
  return (
    <AppLayout
      title="TV Presentations"
      description="Create and manage presentations for your Pickleball Kingdom TVs."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/admin/tv-manager"
          className="text-yellow-400 hover:underline"
        >
          ← Back to TV Display Manager
        </Link>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-2xl font-bold text-white">
            🎬 Presentation Manager
          </h2>

          <p className="mt-2 text-zinc-400">
            Create presentations, organize slides, and
            assign content to your TVs.
          </p>

          <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-6">
            <h3 className="text-lg font-bold text-white">
              Your Presentations
            </h3>

            <p className="mt-3 text-zinc-400">
              No presentations created yet.
            </p>

            <p className="mt-4 text-sm text-yellow-400">
              Presentation creation and slide management
              will be added next.
            </p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
