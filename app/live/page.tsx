import { AppLayout } from "@/components/layout/AppLayout";

export default function LivePage() {
  return (
    <AppLayout
      title="Live Standings"
      description="Phone-friendly weekly and season standings."
    >
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-zinc-300">
          Live player standings will be built here.
        </p>
      </div>
    </AppLayout>
  );
}
