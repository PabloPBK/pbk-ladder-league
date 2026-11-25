export const metadata = { title: "Contact" };

const inquiryEmail = "pablo@zz2pickleball.com";

export default function Page() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-24">
      <p className="font-bold uppercase tracking-widest text-amber-400">ZZ2 Pickleball</p>
      <h1 className="mt-4 text-5xl font-black">Contact</h1>
      <p className="mt-6 max-w-2xl text-lg text-zinc-300">
        Get in touch about tournaments, leagues, and partnerships.
      </p>
      <a
        href={`mailto:${inquiryEmail}`}
        className="mt-4 inline-block break-all rounded-sm font-semibold text-amber-400 underline underline-offset-4 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
      >
        {inquiryEmail}
      </a>
    </main>
  );
}
