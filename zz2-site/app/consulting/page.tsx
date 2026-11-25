import Link from "next/link";

export const metadata = {
  title: "Consulting",
  description: "ZZ2 Pickleball helps clubs and organizers plan and run tournaments, leagues, and special events.",
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
];

export default function ConsultingPage() {
  return (
    <main>
      <header className="bg-[#091b39] px-6 py-14 text-white sm:py-20">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Pickleball Consulting</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-200">
            ZZ2 helps clubs and organizers plan and run tournaments, leagues, and special events.
            We can help with the format, registration, and promotion, and run play on event day.
          </p>
          <Link
            href="/contact"
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-md bg-[#ffd22e] px-6 py-3 font-bold text-[#06152e] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffd22e]"
          >
            Contact ZZ2 about your event <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <div className="bg-[#f4f7fb] px-6 py-12 text-[#081b3b] sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-3">
            {services.map((service) => (
              <section key={service.title} className="rounded-xl border border-slate-200 border-t-4 border-t-[#1350b6] bg-white p-6 shadow-sm sm:p-7">
                <h2 className="text-2xl font-extrabold">{service.title}</h2>
                <p className="mt-3 leading-relaxed text-slate-700">{service.description}</p>
                <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700 marker:text-[#1350b6]">
                  {service.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-7 max-w-2xl text-sm leading-relaxed text-slate-700">
            When you reach out, share your venue or city, preferred dates, and estimated player count if you know them.
          </p>
        </div>
      </div>
    </main>
  );
}
