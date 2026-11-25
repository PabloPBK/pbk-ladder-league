import Link from "next/link";

export const metadata = {
  title: "About ZZ2",
  description: "Get to know the family behind ZZ2 Pickleball and why we run tournaments, leagues, and special events in the Pacific Northwest.",
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
            ZZ2 is a family affair. We love pickleball, and we care about how it feels to spend a day
            at one of our events. That care extends to the clubs and organizations across the Pacific
            Northwest that trust us to bring their players together.
          </p>
        </div>
      </header>

      <div className="bg-[#f4f7fb] px-6 py-12 text-[#081b3b] sm:py-16">
        <section aria-labelledby="founder-story" className="mx-auto grid max-w-7xl gap-8 pb-12 lg:grid-cols-2 lg:gap-14">
          <div className="py-2">
            <h2 id="founder-story" className="text-3xl font-extrabold tracking-tight sm:text-4xl">Why I started ZZ2</h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-700">
              I’d paid steep entry fees, waited hours between matches, and shown up to find that the
              age or skill division I’d signed up for had been combined with another. I started ZZ2
              because I wanted to run the kind of tournament I’d be excited to enter myself.
            </p>
            <p className="mt-4 font-bold text-[#081b3b]">Pablo Granados, founder of ZZ2</p>
          </div>

          <div className="rounded-xl border border-slate-200 border-l-4 border-l-[#ffd22e] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-extrabold">Your time on the court matters</h2>
            <p className="mt-3 leading-relaxed text-slate-700">
              We build schedules to keep matches moving so you can compete without giving up the
              whole day. We do our best to keep you in the age and skill division you signed up and
              paid to play in.
            </p>
            <p className="mt-3 leading-relaxed text-slate-700">
              As our family business grows, we want the competitive pickleball community to grow with
              it. That starts with putting on events players are excited to come back to.
            </p>
          </div>
        </section>

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

      <section aria-labelledby="partner-with-zz2" className="bg-[#091b39] px-6 py-12 text-white sm:py-16">
        <div className="mx-auto max-w-7xl">
          <h2 id="partner-with-zz2" className="text-3xl font-extrabold tracking-tight">Partner with ZZ2</h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-200">
            If you work in pickleball and have an idea that would make the experience better for
            players, we’d love to hear it. Let’s talk about what we could do together.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-md bg-[#ffd22e] px-6 py-3 font-bold text-[#06152e] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffd22e]"
          >
            Contact ZZ2 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
