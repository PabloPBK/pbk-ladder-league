"use client";

import { useEffect, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { getPlayer, type PlayerProfile } from "@/lib/data/players";

type Props = {
  params: {
    id: string;
  };
};

export default function PlayerProfilePage({
  params,
}: Props) {
  const [player, setPlayer] =
    useState<PlayerProfile | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadPlayer() {
      try {
        const data = await getPlayer(
          params.id,
        );

        setPlayer(data);
      } finally {
        setLoading(false);
      }
    }

    void loadPlayer();
  }, [params.id]);

  if (loading) {
    return (
      <AppLayout
        title="Player Profile"
        description="Loading..."
      >
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          Loading player...
        </div>
      </AppLayout>
    );
  }

  if (!player) {
    return (
      <AppLayout
        title="Player Profile"
        description="Player not found"
      >
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-8 text-center">
          Player not found.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={player.name}
      description="Player Profile"
    >
      <div className="space-y-6">

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-4xl font-bold">
            {player.name}
          </h2>

          <p className="mt-2 text-xl text-zinc-400">
            DUPR {player.dupr.toFixed(2)}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">

          <StatCard
            title="League Nights"
            value="-"
          />

          <StatCard
            title="Wins"
            value="-"
          />

          <StatCard
            title="Losses"
            value="-"
          />

          <StatCard
            title="Win %"
            value="-"
          />

          <StatCard
            title="Point Differential"
            value="-"
          />

          <StatCard
            title="Best Finish"
            value="-"
          />

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

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}