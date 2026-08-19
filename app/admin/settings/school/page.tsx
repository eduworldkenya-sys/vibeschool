"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"
import { formatJoinCode } from "@/lib/schoolCode"

const COUNTIES = ["Baringo","Bomet","Bungoma","Busia","Elgeyo Marakwet","Embu","Garissa","Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi","Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos","Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Murang'a","Nairobi","Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya","Taita Taveta","Tana River","Tharaka Nithi","Trans Nzoia","Turkana","Uasin Gishu","Vihiga","Wajir","West Pokot"]
const SCHOOL_TYPES = ["private", "public", "mission", "special_needs"]
const SCHOOL_CATEGORIES = ["primary", "secondary", "ecde", "combined"]

type SchoolRow = {
  name: string
  subdomain: string
  motto: string | null
  vision: string | null
  knec_code: string | null
  nemis_code: string | null
  moe_registration_no: string | null
  tsc_code: string | null
  county: string | null
  sub_county: string | null
  ward: string | null
  phone: string | null
  postal_address: string | null
  school_type: string | null
  school_category: string | null
  established_year: number | null
  directory_source: string | null
  last_verified_at: string | null
}

const fieldStyle = { width: "100%", boxSizing: "border-box" as const, border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 11px", background: "white", fontSize: 14 }

export default function AdminSchoolSettingsPage() {
  const router = useRouter()
  const [schoolId, setSchoolId] = useState("")
  const [school, setSchool] = useState<SchoolRow | null>(null)
  const [form, setForm] = useState({ name: "", motto: "", vision: "", county: "", subCounty: "", ward: "", phone: "", postalAddress: "", schoolType: "private", schoolCategory: "primary", establishedYear: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      const { data, error: queryError } = await supabase
        .from("schools")
        .select("*")
        .eq("id", authority.schoolId)
        .single()
      if (queryError) throw queryError
      const row: SchoolRow = data
      setSchool(row)
      setForm({
        name: row.name,
        motto: row.motto ?? "",
        vision: row.vision ?? "",
        county: row.county ?? "",
        subCounty: row.sub_county ?? "",
        ward: row.ward ?? "",
        phone: row.phone ?? "",
        postalAddress: row.postal_address ?? "",
        schoolType: row.school_type ?? "private",
        schoolCategory: row.school_category ?? "primary",
        establishedYear: row.established_year ? String(row.established_year) : "",
      })
    } catch (cause) {
      console.error("Admin school profile load failed", cause)
      setError(cause instanceof Error ? cause.message : "School profile could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!schoolId || !form.name.trim() || saving) return
    setSaving(true)
    setSaved(false)
    setError("")
    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_update_school_profile" as never,
        {
          p_school_id: schoolId,
          p_name: form.name,
          p_motto: form.motto || null,
          p_vision: form.vision || null,
          p_county: form.county || null,
          p_sub_county: form.subCounty || null,
          p_ward: form.ward || null,
          p_phone: form.phone || null,
          p_postal_address: form.postalAddress || null,
          p_school_type: form.schoolType,
          p_school_category: form.schoolCategory,
          p_established_year: form.establishedYear ? Number(form.establishedYear) : null,
        } as never
      )
      if (rpcError) throw rpcError
      setSaved(true)
      await load()
    } catch (cause) {
      console.error("Admin school profile save failed", cause)
      setError(cause instanceof Error ? cause.message : "School profile could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div aria-busy="true" style={{ minHeight: 260, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
      <header style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button aria-label="Back" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontSize: 26, cursor: "pointer" }}>‹</button>
        <div><h1 style={{ margin: 0, fontSize: 24 }}>School profile</h1><p style={{ color: "#64748b", margin: "4px 0 0" }}>Operational details may be maintained here. Official identity codes remain protected canonical identity.</p></div>
      </header>

      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>}
      {saved && <div role="status" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#047857", borderRadius: 12, padding: 12 }}>School profile saved.</div>}

      {school?.subdomain && (
        <section style={{ background: "#0a1628", color: "white", borderRadius: 16, padding: 16 }}>
          <div style={{ color: "#94a3b8", fontSize: 11 }}>SCHOOL JOIN CODE</div>
          <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 850, letterSpacing: 2, marginTop: 4 }}>{formatJoinCode(school.subdomain)}</div>
          <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 5 }}>Use the existing verified onboarding flow to connect legitimate staff; this code does not grant Admin authority.</div>
        </section>
      )}

      <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gap: 11 }}>
        <strong>Official identity</strong>
        {[
          ["KNEC code", school?.knec_code],
          ["NEMIS code", school?.nemis_code],
          ["MoE registration", school?.moe_registration_no],
          ["TSC code", school?.tsc_code],
          ["Directory source", school?.directory_source],
          ["Last verified", school?.last_verified_at ? new Date(school.last_verified_at).toLocaleString("en-KE") : null],
        ].map(([label, value]) => <div key={label} style={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr)", gap: 10, fontSize: 13 }}><span style={{ color: "#64748b" }}>{label}</span><strong>{value || "Not verified"}</strong></div>)}
        <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>Identity/provenance fields are read-only here so ordinary school setup cannot fork the canonical school identity. Corrections follow the verified school-identity review path.</div>
      </section>

      <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gap: 11 }}>
        <strong>Operational profile</strong>
        <label>School name<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} style={fieldStyle} /></label>
        <label>Motto<input value={form.motto} onChange={event => setForm(current => ({ ...current, motto: event.target.value }))} style={fieldStyle} /></label>
        <label>Vision<textarea value={form.vision} onChange={event => setForm(current => ({ ...current, vision: event.target.value }))} rows={3} style={{ ...fieldStyle, resize: "vertical" }} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
          <label>Type<select value={form.schoolType} onChange={event => setForm(current => ({ ...current, schoolType: event.target.value }))} style={fieldStyle}>{SCHOOL_TYPES.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
          <label>Category<select value={form.schoolCategory} onChange={event => setForm(current => ({ ...current, schoolCategory: event.target.value }))} style={fieldStyle}>{SCHOOL_CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <label>Established year<input type="number" min="1800" max={new Date().getFullYear()} value={form.establishedYear} onChange={event => setForm(current => ({ ...current, establishedYear: event.target.value }))} style={fieldStyle} /></label>
      </section>

      <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gap: 11 }}>
        <strong>Location & contact</strong>
        <label>County<select value={form.county} onChange={event => setForm(current => ({ ...current, county: event.target.value }))} style={fieldStyle}><option value="">Choose county</option>{COUNTIES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
          <label>Sub-county<input value={form.subCounty} onChange={event => setForm(current => ({ ...current, subCounty: event.target.value }))} style={fieldStyle} /></label>
          <label>Ward<input value={form.ward} onChange={event => setForm(current => ({ ...current, ward: event.target.value }))} style={fieldStyle} /></label>
        </div>
        <label>Phone<input inputMode="tel" value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} style={fieldStyle} /></label>
        <label>Postal address<input value={form.postalAddress} onChange={event => setForm(current => ({ ...current, postalAddress: event.target.value }))} style={fieldStyle} /></label>
      </section>

      <button disabled={saving || !form.name.trim()} onClick={() => void save()} style={{ border: 0, borderRadius: 12, padding: 13, background: "#10b981", color: "white", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving…" : "Save operational profile"}</button>
    </main>
  )
}
