"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { CourtCard } from "@/components/courts/CourtCard";

export default function WalkingPage() {
  const players = ["John", "Mike", "Steve", "Bob"];

  const pairings = [
    {
      team1: ["John", "Mike"] as [string, string],
      team2: ["Steve", "Bob"] as [string, string],
    },
    {
      team1: ["John", "Steve"] as [string, string],
      team2: ["Mike", "Bob"] as [string, string],
    },
    {
      team1: ["John", "Bob"] as [string, string],
      team2: ["Mike", "Steve"] as [string, string],
    },
  ];

  return (
    <AppLayout
      title="Walking Mode"
      description="Tap the correct partnership for each court."
    >
      <CourtCard
        courtNumber={1}
        totalCourts={6}
        players={players}
        pairings={pairings}
        onSelect={(choice) => {
          console.log("Selected pairing:", choice);
        }}
      />
    </AppLayout>
  );
}