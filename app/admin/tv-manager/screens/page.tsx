import { AppLayout } from "@/components/layout/AppLayout";
import Link from "next/link";

export default function TVScreensPage() {
  return (
    <AppLayout
      title="TV Screens"
      description="Manage your Pickleball Kingdom TV displays."
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
            TV Screen Management
          </h2>

          <p className="mt-3 text-zinc-400">
            This is where you will register, configure,
            and manage your five TV screens.
          </p>

          <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-5">
            <h3 className="text-lg font-bold text-yellow-400">
              TV Screens Setup
            </h3>

            <p className="mt-2 text-sm text-zinc-400">
              Next, we will connect this page to your
              Supabase TV database so you can view and
              manage your registered screens.
            </p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
