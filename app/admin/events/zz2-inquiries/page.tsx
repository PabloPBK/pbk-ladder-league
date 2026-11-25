import Link from "next/link";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { canReadZz2Contact } from "@/lib/server/zz2-contact";
import { supabaseAdmin } from "@/lib/supabase-admin";

const path = "/admin/events/zz2-inquiries";
const pageSize = 25;
const pacificTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });

export default async function Zz2Inquiries({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  let allowed;
  try {
    allowed = await canReadZz2Contact();
  } catch (error) {
    if (error instanceof Error && ["AUTH_REQUIRED", "STAFF_ACCESS_DENIED"].includes(error.message)) notFound();
    throw error;
  }
  if (!allowed) notFound();

  const requestedPage = Number((await searchParams).page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1;
  const offset = (page - 1) * pageSize;
  const { data, error } = await supabaseAdmin.from("zz2_contact_inquiries")
    .select("id,received_at,sender_name,sender_email,topic,message")
    .order("received_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + pageSize);
  if (error) throw new Error("Could not load ZZ2 inquiries.");

  const messages = data.slice(0, pageSize);
  return (
    <AppLayout title="ZZ2 inquiries" description="Messages from the ZZ2 website contact form.">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/admin/events" className="text-sm font-semibold text-yellow-400 hover:underline">← Back to Events</Link>
        {messages.length === 0 && <p className="rounded-xl border border-zinc-800 p-5 text-zinc-300">No inquiries on this page.</p>}
        <ul className="space-y-4">
          {messages.map((inquiry) => (
            <li key={inquiry.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="break-words text-lg font-bold">{inquiry.topic}</h2>
                <time dateTime={inquiry.received_at} className="text-sm text-zinc-400">{pacificTime.format(new Date(inquiry.received_at))} PT</time>
              </div>
              <p className="mt-2 break-words text-sm text-zinc-300">{inquiry.sender_name} · {inquiry.sender_email}</p>
              <p className="mt-4 whitespace-pre-wrap break-words text-zinc-100">{inquiry.message}</p>
              <a href={`mailto:${encodeURIComponent(inquiry.sender_email).replace("%40", "@")}?subject=${encodeURIComponent("ZZ2 Pickleball · " + inquiry.topic)}`}
                className="mt-4 inline-block text-sm font-semibold text-yellow-400 hover:underline">Reply by email</a>
            </li>
          ))}
        </ul>
        {(page > 1 || data.length > pageSize) && (
          <nav aria-label="Inquiry pages" className="flex gap-5 text-sm font-semibold text-yellow-400">
            {page > 1 && <Link href={`${path}?page=${page - 1}`}>← Previous</Link>}
            {data.length > pageSize && <Link href={`${path}?page=${page + 1}`}>Next →</Link>}
          </nav>
        )}
      </div>
    </AppLayout>
  );
}
