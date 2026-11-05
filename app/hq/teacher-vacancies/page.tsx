"use client";

import { useCallback, useEffect, useState } from "react";
import { hqSupabase } from "@/lib/hq/supabase";

type Vacancy = {
 id: string; title: string; school_name: string; county: string;
 location: string | null; employment_type: string | null;
 application_url: string | null; closing_date: string | null;
 status: "draft" | "review" | "published" | "expired";
};
type Draft = Pick<Vacancy, "title" | "school_name" | "county" | "location" | "employment_type" | "application_url" | "closing_date">;
const empty: Draft = { title: "", school_name: "", county: "", location: "", employment_type: "", application_url: "", closing_date: "" };
const inputStyle = { minHeight: 44, padding: 10, border: "1px solid #9daab6", borderRadius: 8, width: "100%", background: "#fff", color: "#172b25" };

export default function HQTeachingVacancies() {
 const [rows, setRows] = useState<Vacancy[]>([]);
 const [form, setForm] = useState<Draft>(empty);
 const [editing, setEditing] = useState<string | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 const [notice, setNotice] = useState("");
 const [ready, setReady] = useState(false);
 const refresh = useCallback(async () => {
   const { data, error: e } = await hqSupabase.from("teacher_vacancies").select("id,title,school_name,county,location,employment_type,application_url,closing_date,status").order("created_at", { ascending: false }).limit(200);
   if (e) { setError("Vacancy records are unavailable. Verify the database migration and HQ permissions."); return; }
   setRows((data ?? []) as Vacancy[]);
 }, []);
 useEffect(() => {
   let active = true;
   void (async () => {
     const { data, error: e } = await hqSupabase.rpc("hq_check_owner_access", { p_surface: "/hq/teacher-vacancies" });
     if (!active) return;
     if (e || !(data as { allowed?: boolean } | null)?.allowed) { setError("HQ owner permission is required."); return; }
     setReady(true);
     void refresh();
   })();
   return () => { active = false; };
 }, [refresh]);
 function edit(row: Vacancy) {
   setEditing(row.id);
   setForm({ title: row.title, school_name: row.school_name, county: row.county, location: row.location ?? "", employment_type: row.employment_type ?? "", application_url: row.application_url ?? "", closing_date: row.closing_date ?? "" });
 }
 async function save() {
   if (!form.title.trim() || !form.school_name.trim() || !form.county.trim()) { setError("Title, school and county are required."); return; }
   if (form.application_url && !/^https:\/\//i.test(form.application_url)) { setError("Application link must start with https://"); return; }
   setBusy(true); setError(""); setNotice("");
   const payload = { ...form, title: form.title.trim(), school_name: form.school_name.trim(), county: form.county.trim(), location: form.location || null, employment_type: form.employment_type || null, application_url: form.application_url || null, closing_date: form.closing_date || null };
   const result = editing
     ? await hqSupabase.from("teacher_vacancies").update(payload).eq("id", editing)
     : await hqSupabase.from("teacher_vacancies").insert({ ...payload, status: "draft" });
   if (result.error) setError("Could not save vacancy. Check HQ permissions and try again.");
   else { setNotice("Vacancy saved."); setEditing(null); setForm(empty); await refresh(); }
   setBusy(false);
 }
 async function transition(row: Vacancy, status: Vacancy["status"]) {
   if (status === "published" && !window.confirm(`Publish ${row.title} publicly?`)) return;
   setBusy(true); setError(""); setNotice("");
   const { error: e } = await hqSupabase.from("teacher_vacancies").update({ status }).eq("id", row.id);
   if (e) setError("Status change failed. Check permissions.");
   else { setNotice(`Vacancy marked ${status}.`); await refresh(); }
   setBusy(false);
 }
 return <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, color: "#172b25", background: "#f8fafc", minHeight: "100vh" }}>
   <h1>Teaching vacancies</h1><p>HQ review and publishing. Drafts are not visible publicly.</p>
   {error && <p role="alert" style={{ color: "#a11" }}>{error}</p>}
   {notice && <p role="status">{notice}</p>}
   {ready && <>
     <section aria-label="Vacancy editor" style={{ padding: 18, border: "1px solid #bbc6ce", borderRadius: 12, background: "#fff" }}>
       <h2>{editing ? "Edit vacancy" : "Add vacancy"}</h2>
       <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
         {(["title","school_name","county","location","employment_type","application_url","closing_date"] as const).map(k =>
           <label key={k} style={{ fontWeight: 600 }}>{k.replaceAll("_"," ")}
             <input style={inputStyle} type={k === "closing_date" ? "date" : k === "application_url" ? "url" : "text"}
               value={form[k] ?? ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
           </label>)}
       </div>
       <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
         <button disabled={busy} onClick={() => void save()} style={{ padding: 12 }}>Save draft</button>
         {editing && <button disabled={busy} onClick={() => { setEditing(null); setForm(empty); }}>Cancel edit</button>}
       </div>
     </section>
     <h2>Vacancy register</h2>
     {rows.length === 0 ? <p>No vacancy records yet.</p> : rows.map(row =>
       <article key={row.id} style={{ border: "1px solid #bbc6ce", padding: 16, margin: "10px 0", borderRadius: 12, background: "#fff" }}>
         <h3>{row.title}</h3><p>{row.school_name} · {row.county} · {row.status}</p>
         <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
           <button disabled={busy} onClick={() => edit(row)}>Edit</button>
           {row.status === "draft" && <button disabled={busy} onClick={() => void transition(row,"review")}>Submit for review</button>}
           {row.status === "review" && <button disabled={busy} onClick={() => void transition(row,"published")}>Publish</button>}
           {row.status === "published" && <button disabled={busy} onClick={() => void transition(row,"expired")}>Expire</button>}
         </div>
       </article>)}
   </>}
 </main>;
}
