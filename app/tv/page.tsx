import { AppLayout } from "@/components/layout/AppLayout";

export default function TVPage() {
  return (
    <AppLayout
      title="TV Display"
      description="Live standings, court assignments, results, and round progress."
      showNavigation={false}
    >
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-zinc-300">
          The full-screen broadcast display will be built here.
        </p>
      </div>
    </AppLayout>
  );
}
