import { ContactForm } from "./ContactForm";

export const metadata = { title: "Contact", description: "Send an inquiry to ZZ2 Pickleball about events, facility consulting, or partnerships." };

const inquiryEmail = "pablo@zz2pickleball.com";
const contactEndpoint = new URL("/api/public/zz2/contact", process.env.TOURNAMENT_FEED_URL ?? "https://leagues.zz2pickleball.com").href;

export default function Page() {
  return (
    <main>
      <header className="bg-[#091b39] px-6 py-14 text-white sm:py-20">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Contact ZZ2</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-200">
            Get in touch about tournaments, leagues, facility consulting, or partnering with ZZ2.
          </p>
        </div>
      </header>
      <div className="bg-[#f4f7fb] px-6 py-12 text-[#081b3b] sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ContactForm endpoint={contactEndpoint} />
          <aside className="md:py-4">
            <h2 className="text-xl font-extrabold">Prefer email?</h2>
            <a href={`mailto:${inquiryEmail}`}
              className="mt-3 inline-block break-all rounded-sm font-semibold text-[#1350b6] underline underline-offset-4 hover:text-[#081b3b] focus-visible:outline-2 focus-visible:outline-offset-4">
              {inquiryEmail}
            </a>
          </aside>
        </div>
      </div>
    </main>
  );
}
