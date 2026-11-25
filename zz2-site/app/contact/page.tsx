import { inquiryEmail } from "../../lib/contact";
import { postmarkContactSettings } from "../../lib/postmark-contact";
import { ContactForm } from "./ContactForm";

export const metadata = { title: "Contact", description: "Send an inquiry to ZZ2 Pickleball about events, facility consulting, or partnerships." };

export const dynamic = "force-dynamic";

export default function Page() {
  const showForm = postmarkContactSettings() !== null;
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
        <div className={`mx-auto max-w-7xl ${showForm ? "grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}>
          {showForm && <ContactForm />}
          <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-extrabold">Email ZZ2</h2>
            <a href={`mailto:${inquiryEmail}`}
              className="mt-3 inline-block break-all rounded-sm font-semibold text-[#1350b6] underline underline-offset-4 hover:text-[#081b3b] focus-visible:outline-2 focus-visible:outline-offset-4">
              {inquiryEmail}
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
