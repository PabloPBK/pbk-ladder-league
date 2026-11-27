"use client";

import { useEffect, useState } from "react";
import { getCurrentRound, type SavedCurrentRound } from "@/lib/data/currentRound";

export function LeagueCourtDisplay({ eventId }: { eventId: string }) {
  const [data, setData] = useState<SavedCurrentRound>();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer: number;
    async function update() {
      try {
        const round = await getCurrentRound(eventId);
        if (!cancelled) {
          setData(round);
          setError("");
        }
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : "Unable to load court assignments.");
      } finally {
        if (!cancelled) timer = window.setTimeout(update, 5000);
      }
    }
    void update();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [eventId]);

  return (
    <main className="min-h-screen bg-zinc-950 p-[2vw] text-white">
      {data ? (
        <>
          <header className="mb-[1vw] flex flex-wrap items-baseline gap-x-5">
            <h1 className="text-[clamp(1.7rem,3vw,3.75rem)] font-black text-yellow-400">Round {data.round.round_number} Court Assignments</h1>
            <p className="text-[clamp(1rem,1.5vw,2rem)] text-zinc-300">{data.event.name}</p>
          </header>
          <div className="grid grid-cols-2 gap-[0.75vw] md:grid-cols-3 xl:grid-cols-4">
            {data.courts.map((court) => (
              <section key={court.databaseCourtId} className="rounded-xl border border-zinc-700 bg-zinc-900 px-[1vw] py-[0.55vw]">
                <h2 className="border-b border-zinc-700 pb-[0.2vw] text-[clamp(1.1rem,1.65vw,2.5rem)] font-bold text-yellow-300">Court {court.courtNumber}</h2>
                <ol className="mt-[0.3vw] space-y-[0.1vw] text-[clamp(0.9rem,1.23vw,1.9rem)] leading-tight">
                  {court.players.map((player) => <li key={player.databasePlayerId}>{player.name}</li>)}
                </ol>
              </section>
            ))}
          </div>
        </>
      ) : <p role={error ? "alert" : "status"} className="text-lg text-zinc-300">{error || "Loading court assignments…"}</p>}
    </main>
  );
}
