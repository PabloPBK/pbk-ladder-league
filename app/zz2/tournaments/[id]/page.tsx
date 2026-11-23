import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
export const dynamic="force-dynamic";
export default async function TournamentDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const {data:e,error}=await supabaseAdmin.from("tournaments").select("id,name,start_date,end_date,description,registration_url,registration_platform,logo_url,tournament_facilities(name,city,state,address)").eq("id",id).eq("status","published").eq("publish_zz2",true).maybeSingle();
 if(error||!e)notFound();
 const f=e.tournament_facilities as unknown as {name:string;city:string|null;state:string|null;address:string|null}|null;
 return <main className="min-h-screen bg-[#090e1c] px-6 py-12 text-white"><div className="mx-auto max-w-3xl"><Link href="/zz2/tournaments" className="font-bold text-yellow-400">← All Tournaments</Link><p className="mt-12 text-sm font-bold uppercase tracking-wider text-yellow-400">{e.start_date}{e.end_date!==e.start_date?" – "+e.end_date:""}</p><h1 className="mt-3 text-4xl font-black md:text-6xl">{e.name}</h1>{e.logo_url&&<div className="mt-8 flex max-h-72 items-center justify-center rounded-2xl bg-white/10 p-6"><img src={e.logo_url} alt="" className="max-h-60 object-contain"/></div>}<div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-7"><h2 className="text-xl font-bold">Location</h2><p className="mt-2 text-zinc-300">{f?.name??"To be announced"}{f?.address?", "+f.address:""}{f?.city?", "+f.city:""}{f?.state?", "+f.state:""}</p>{e.description&&<p className="mt-8 whitespace-pre-line leading-relaxed text-zinc-200">{e.description}</p>}{e.registration_url&&<a href={e.registration_url} target="_blank" rel="noopener noreferrer" className="mt-8 inline-block rounded-xl bg-yellow-400 px-7 py-4 font-bold text-black">Register for Tournament</a>}</div></div></main>;
}