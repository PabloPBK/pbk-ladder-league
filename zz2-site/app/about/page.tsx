import Link from "next/link";

export const metadata = {
  title: "About ZZ2",
  description: "Meet ZZ2 Pickleball, organizers of tournaments, leagues, and special events in the Pacific Northwest.",
};

const programs = [
  {
    title: "Tournaments",
    description: "We run competitive events for individual players and teams, from round-robin tournaments with playoffs to Minor League Pickleball and DUPR Waterfalls.",
    href: "/tournaments",
    action: "See upcoming tournaments",
  },
  {
    title: "Leagues",
    description: "We organize flex leagues and DUPR-rated ladders. At Pickleball Kingdom Lynnwood, players can sign up for individual ladder sessions and follow standings and match results throughout the season.",
    href: "/leagues",
    action: "Explore leagues and results",
  },
  {
    title: "Special events",
    description: "We bring players together for club socials, themed events, and community celebrations. We work with clubs and organizers to choose a format that fits the group, the venue, and the occasion.",
    href: "/consulting",
    action: "Explore event planning",
  },
];

export default function AboutPage() {
  return (
    <main>
      <header className="bg-[#091b39] px-6 py-14 text-white sm:py-20">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">About ZZ2</h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-200 sm:text-xl">
            ZZ2 Pickleball organizes events with clubs across the Pacific Northwest. We build
            opportunities for players to compete at their level, meet people, and keep playing.
          </p>
        </div>
      </header>

      <div className="bg-[#f4f7fb] px-6 py-12 text-[#081b3b] sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {programs.map((program) => (
            <section key={program.href} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <h2 className="text-2xl font-extrabold">{program.title}</h2>
              <p className="mb-5 mt-3 leading-relaxed text-slate-700">{program.description}</p>
              <Link
                href={program.href}
                className="mt-auto w-fit rounded-sm py-2 text-sm font-bold text-[#1350b6] underline underline-offset-4 hover:text-[#081b3b] focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                {program.action} <span aria-hidden="true">→</span>
              </Link>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
