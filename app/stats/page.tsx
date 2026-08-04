import { AppLayout } from "@/components/layout/AppLayout";

type PlayerProfilePageProps = {
  params: {
    id: string;
  };
};

export default function PlayerProfilePage({
  params,
}: PlayerProfilePageProps) {
  return (
    <AppLayout
      title="Player Profile"
      description="Career statistics and season performance"
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-3xl font-bold text-white">
            Player
          </h2>

          <p className="mt-2 text-zinc-400">
            Player ID: {params.id}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="League Nights" value="-" />
          <StatCard title="Wins" value="-" />
          <StatCard title="Losses" value="-" />
          <StatCard title="Win %" value="-" />
          <StatCard title="Point Differential" value="-" />
          <StatCard title="DUPR" value="-" />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="text-xl font-bold">
            Season History
          </h3>

          <p className="mt-3 text-zinc-400">
            This section will show each season, final finish,
            wins, losses and attendance.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm uppercase tracking-wide text-zinc-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}