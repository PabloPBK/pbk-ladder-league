import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

const managerSections = [
  {
    title: "TV Screens",
    description: "Configure individual TV displays.",
    icon: "📺",
    href: "/admin/tv-manager/screens",
  },
  {
    title: "Presentations",
    description: "Manage playlists and promotional images.",
    icon: "🎬",
    href: "/admin/tv-manager/presentations",
  },
  {
    title: "Live Rosters",
    description: "Manage teams and DUPR rankings.",
    icon: "🏆",
    href: "/admin/tv-manager/rosters",
  },
];

export default function TVManagerPage() {
  return (
    <AppLayout
      title="TV Display Manager"
      description="Manage TV screens, presentations, and live event displays."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-2xl font-black text-yellow-400">
            Pickleball Kingdom TV Manager
          </h2>

          <p className="mt-2 text-zinc-400">
            Control presentations across multiple TVs
            from one dashboard.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {managerSections.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="block rounded-xl border border-zinc-700 bg-zinc-950 p-5 transition hover:border-yellow-400 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              >
                <div className="text-3xl">{item.icon}</div>
                <h3 className="mt-3 text-lg font-bold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold text-white">
            Getting Started
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Select a section above to manage your TV
            displays, presentations, and live rosters.
          </p>

          <Link
            href="/admin"
            className="mt-5 inline-block rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300"
          >
            Return to League Admin
          </Link>
        </section>
      </div>
    </AppLayout>
  );
}
