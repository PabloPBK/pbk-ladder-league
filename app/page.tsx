import { AppLayout } from "@/components/layout/AppLayout";
import { PBKButton } from "@/components/ui/PBKButton";

export default function Home() {
  return (
    <AppLayout
      title="League Night"
      description="Choose the view you need for tonight's ladder."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PBKButton href="/admin" primary>
          🛠 Admin Control Center
        </PBKButton>

        <PBKButton href="/walking">
          🚶 Walking Mode
        </PBKButton>

        <PBKButton href="/tv">
          📺 TV Display
        </PBKButton>

        <PBKButton href="/live">
          📊 Live Standings
        </PBKButton>
      </div>
    </AppLayout>
  );
}
