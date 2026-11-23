"use client";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
type Tournament = { id:string; name:string; facility_id:string; start_date:string; end_date:string; description:string|null; registration_platform:string|null; registration_url:string|null; logo_url:string|null; status:string };
type Facility = { id:string; name:string };
const field = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white";
export default function EditTournament() {
 const { id } = useParams<{id:string}>();
 const [t,setT] = useState<Tournament|null>(null);
 const [facilities,setFacilities] = useState<Facility[]>([]);
 const [error,setError] = useState("");
 const [notice,setNotice] = useState("");
 const [saving,setSaving] = useState(false);
 const [uploading,setUploading] = useState(false);
 useEffect(() => {
  Promise.all([
   fetch(`/api/tournaments/${id}`,{cache:"no-store"}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error);return x.tournament as Tournament;}),
   fetch("/api/tournament-facilities",{cache:"no-store"}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error);return x.facilities as Facility[];})
  ]).then(([t,f])=>{setT(t);setFacilities(f);}).catch(e=>setError(e instanceof Error?e.message:"Unable to load tournament."));
 },[id]);
 function update(key:keyof Tournament,value:string){setT(old=>old?{...old,[key]:value}:old);}
 async function uploadLogo(event:ChangeEvent<HTMLInputElement>) {
  const file=event.target.files?.[0];
  if(!file)return;
  event.target.value="";
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>4194304||file.size===0){setError("Choose a PNG, JPG, or WebP image under 4 MB.");return;}
  setUploading(true);setError("");setNotice("");
  try{
   const form=new FormData();form.append("file",file);
   const response=await fetch(`/api/tournaments/${id}/logo`,{method:"POST",body:form});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"Logo upload failed.");
   update("logo_url",result.logo_url);
   setNotice("Logo uploaded and saved. It will appear on tournament pages.");
  }catch(e){setError(e instanceof Error?e.message:"Logo upload failed.");}
  finally{setUploading(false);}
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!t||saving||uploading)return;
  setSaving(true);setError("");setNotice("");
  try{
   const response=await fetch(`/api/tournaments/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"Save failed.");
   setNotice("Tournament changes saved successfully.");
  }catch(e){setError(e instanceof Error?e.message:"Save failed.");}
  finally{setSaving(false);}
 }
 return <AppLayout title="Edit Tournament" description="Update tournament details before or after publishing.">
  <div className="mx-auto max-w-3xl space-y-5">
   <Link href="/admin/events/tournaments" className="text-yellow-400">← Tournament Management</Link>
   {error&&<p role="alert" className="rounded-lg border border-red-500/40 p-3 text-red-400">{error}</p>}
   {notice&&<p role="status" className="rounded-lg border border-green-500/40 p-3 text-green-400">{notice}</p>}
   {!t?<p className="text-zinc-300">Loading tournament…</p>:<form onSubmit={save} className="space-y-5 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
    {([["name","Tournament Name"],["start_date","Start Date"],["end_date","End Date"],["registration_platform","Registration Platform"],["registration_url","Registration URL"]] as const).map(([key,label])=>
     <label key={key} className="block space-y-2 text-sm font-bold text-zinc-300"><span>{label}</span><input className={field} type={key.includes("date")?"date":key.includes("url")?"url":"text"} required={["name","start_date","end_date"].includes(key)} value={t[key]??""} onChange={e=>update(key,e.target.value)}/></label>
    )}
    <label className="block space-y-2 text-sm font-bold text-zinc-300"><span>Host Facility</span><select required className={field} value={t.facility_id} onChange={e=>update("facility_id",e.target.value)}>{facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <label className="block space-y-2 text-sm font-bold text-zinc-300"><span>Description</span><textarea rows={7} className={field} value={t.description??""} onChange={e=>update("description",e.target.value)}/></label>
    <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
     <h3 className="font-bold text-white">Tournament Logo</h3>
     {t.logo_url?<img src={t.logo_url} alt="Current tournament logo" className="max-h-48 max-w-full rounded-lg bg-white p-3 object-contain"/>:<p className="text-sm text-zinc-400">No logo uploaded yet.</p>}
     <label className="inline-flex cursor-pointer rounded-lg border border-yellow-400 px-4 py-2 text-sm font-bold text-yellow-400">
      {uploading?"Uploading…":t.logo_url?"Replace Logo":"Upload Logo"}
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading||saving} onChange={uploadLogo} className="sr-only"/>
     </label>
     <p className="text-xs text-zinc-400">PNG, JPG or WebP. Maximum 4 MB. Uploads save immediately; replacing a logo does not change other tournament details.</p>
     <label className="block space-y-2 text-sm text-zinc-400"><span>Or use a logo image URL</span><input type="url" className={field} value={t.logo_url??""} onChange={e=>update("logo_url",e.target.value)} placeholder="https://..."/></label>
    </div>
    <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving||uploading} className="rounded-lg bg-yellow-400 px-6 py-3 font-bold text-black disabled:opacity-50">{saving?"Saving…":"Save Changes"}</button><Link href={`/admin/events/tournaments/${id}/preview`} className="rounded-lg border border-zinc-600 px-6 py-3 font-bold">Preview Tournament</Link></div>
    <p className="text-xs text-zinc-400">Saving changes does not publish the tournament. Changes to already published events appear on the ZZ2 preview site.</p>
   </form>}
  </div>
 </AppLayout>;
}
