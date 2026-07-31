import { AppLayout } from "@/components/layout/AppLayout";

export default function AdminPage() {
  return (
    <AppLayout
      title="Admin Control Center"
      description="Manage players, rounds, courts, partnerships, and results."
    >
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-zinc-300">
          The league-night dashboard will be built here.
        </p>
      </div>
    </AppLayout>
  );
}
