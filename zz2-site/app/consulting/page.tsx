import Link from "next/link";

export const metadata = {
  title: "Consulting",
  description: "ZZ2 Pickleball helps clubs plan tournaments, leagues, and special events, build facility programming, and improve day-to-day operations.",
};

const services = [
  {
    title: "Tournaments",
    description: "Plan a competition around your players, courts, and schedule.",
    details: [
      "Formats, divisions, and match schedules",
      "Registration setup and event promotion",
      "On-site operations, scoring, and results",
    ],
  },
  {
    title: "Leagues",
    description: "Build a recurring program that fits your club and gives players a reason to come back.",
    details: [
      "Drop-in ladders, flex leagues, and season schedules",
      "Session registration and player check-in",
      "Standings, match history, and DUPR reporting for rated play",
    ],
  },
  {
    title: "Special events",
    description: "Put pickleball at the center of a club social, themed event, or community celebration.",
    details: [
      "Play formats for your group and skill levels",
      "Court scheduling, check-in, and event-day coordination",
      "Promotion and prize planning when it fits the event",
    ],
  },
  {
    title: "Facility programming",
    description: "Build a weekly calendar that fits your courts and gives players clear ways to get involved.",
    details: [
      "Open-play schedules by skill level and time of day",
      "Beginner programs and a path into regular play",
      "A mix of clinics, leagues, and social play that fits court capacity",
    ],
  },
  {
    title: "Facility operations",
    description: "Set up routines your team can use to keep play running smoothly.",
    details: [
      "Court assignments, daily schedules, and staff handoffs",
      "Registration, check-in, and attendance workflows",
      "Participation reports to guide scheduling and program decisions",
    ],
  },
];

export default function ConsultingPage() {
  return (
    <main>
      <header className="bg-[#091b39] px-6 py-14 text-white sm:py-20">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Pickleball Consulting</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-200">
            ZZ2 helps pickleball clubs and organizers run tournaments, leagues, and special events.
            We also help clubs build their weekly programming and improve day-to-day operations.
          </p>
          <Link
            href="/contact"
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-md bg-[#ffd22e] px-6 py-3 font-bold text-[#06152e] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffd22e]"
          >
            Contact ZZ2 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <div className="bg-[#f4f7fb] px-6 py-12 text-[#081b3b] sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-6">
            {services.map((service, index) => (
              <section key={service.title} className={`rounded-xl border border-slate-200 border-t-4 border-t-[#1350b6] bg-white p-6 shadow-sm sm:p-7 ${index < 3 ? "lg:col-span-2" : "lg:col-span-3"}`}>
                <h2 className="text-2xl font-extrabold">{service.title}</h2>
                <p className="mt-3 leading-relaxed text-slate-700">{service.description}</p>
                <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700 marker:text-[#1350b6]">
                  {service.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-7 max-w-2xl text-sm leading-relaxed text-slate-700">
            Tell us where you play and what you’d like to improve or organize. For events, include your preferred dates and estimated player count if you know them.
          </p>
        </div>
      </div>
    </main>
  );
}
