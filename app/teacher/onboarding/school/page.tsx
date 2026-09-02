"use client"

export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type School = {
  id: string
  name: string
  county: string | null
  sub_county: string | null
  school_type: string | null
  ownership_type: string | null
  gender_type: string | null
  levels: string[]
  distance_km: number | null
  source: "CANONICAL" | "DIRECTORY"
  knec_code: string | null
}

const LEVELS = [
  ["PRIMARY", "Primary", "PP1–Grade 6"],
  ["JUNIOR", "Junior School", "Grade 7–9"],
  ["SENIOR_SECONDARY", "Senior Secondary", "Grade 10–12"],
] as const

const COUNTIES = [
  "Nakuru", "Nairobi", "Kiambu", "Kisumu", "Mombasa", "Uasin Gishu", "Machakos", "Kakamega",
  "Meru", "Nyeri", "Kisii", "Baringo", "Bomet", "Bungoma", "Busia", "Embu", "Kajiado",
  "Kericho", "Kilifi", "Kirinyaga", "Kitui", "Kwale", "Laikipia", "Lamu", "Makueni",
  "Mandera", "Marsabit", "Migori", "Murang’a", "Nandi", "Narok", "Nyandarua", "Samburu",
  "Siaya", "Taita Taveta", "Tana River", "Tharaka Nithi", "Trans Nzoia", "Turkana", "Vihiga",
  "Wajir", "West Pokot",
]

export default function SchoolDiscovery() {
  const router = useRouter()
  const [level, setLevel] = useState("")
  const [q, setQ] = useState("")
  const [county, setCounty] = useState("")
  const [subCounty, setSubCounty] = useState("")
  const [schoolCode, setSchoolCode] = useState("")
  const [alternativeName, setAlternativeName] = useState("")
  const [notes, setNotes] = useState("")
  const [rows, setRows] = useState<School[]>([])
  const [picked, setPicked] = useState<School | null>(null)
  const [busy, setBusy] = useState(false)
  const [searching, setSearching] = useState(false)
  const [msg, setMsg] = useState("")
  const [missingMode, setMissingMode] = useState(false)
  const [sent, setSent] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude)
        setLng(p.coords.longitude)
      },
      () => {},
      { maximumAge: 300000, timeout: 3500 }
    )
  }, [])

  useEffect(() => {
    if (!level || q.trim().length < 2) {
      setRows([])
      setSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      const { data, error } = await supabase.rpc("search_school_directory", {
        p_query: q.trim(),
        p_level: level,
        p_county: county || null,
        p_sub_county: subCounty || null,
        p_lat: lat,
        p_lng: lng,
        p_limit: 40,
      })
      setSearching(false)
      if (error) {
        setMsg("School search is temporarily unavailable. Please try again.")
        return
      }
      setMsg("")
      setRows((data || []) as School[])
    }, 180)

    return () => clearTimeout(timer)
  }, [q, level, county, subCounty, lat, lng])

  const hasAmbiguousNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const key = `${row.name.toLowerCase().replace(/[^a-z0-9]/g, "")}|${(row.county || "").toLowerCase()}|${(row.sub_county || "").toLowerCase()}`
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.values()).some((count) => count > 1)
  }, [rows])

  async function connect() {
    if (!picked || !level) return
    setBusy(true)
    setMsg("")
    const fn = picked.source === "DIRECTORY" ? "connect_teacher_to_directory_school" : "connect_teacher_to_school"
    const args = picked.source === "DIRECTORY"
      ? { p_directory_id: picked.id, p_level: level }
      : { p_school_id: picked.id, p_level: level }
    const { error } = await supabase.rpc(fn, args)
    setBusy(false)
    if (error) {
      if (error.message?.includes("school_identity_review_required")) {
        setMsg("This directory school needs verification before we can connect it safely. Send the school details below and our team will reconcile it without creating a duplicate.")
        setMissingMode(true)
      } else {
        setMsg("We could not connect you to that school. Please retry.")
      }
      return
    }
    router.push("/teacher/onboarding/class")
  }

  async function requestMissingSchool() {
    if (q.trim().length < 3) {
      setMsg("Enter the school name first.")
      return
    }

    setBusy(true)
    setMsg("")
    const { error } = await supabase.rpc("submit_school_discovery_request", {
      p_name: q.trim(),
      p_county: county || null,
      p_sub_county: subCounty.trim() || null,
      p_ward: null,
      p_level: level || null,
      p_school_code: schoolCode.trim() || null,
      p_lat: lat,
      p_lng: lng,
      p_alternative_name: alternativeName.trim() || null,
      p_notes: notes.trim() || null,
      p_contact_name: null,
      p_contact_phone: null,
    })
    setBusy(false)
    if (error) {
      setMsg("We could not send the school details. Please retry.")
      return
    }
    setSent(true)
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f3f4f6", padding: 16, fontFamily: "system-ui" }}>
      <section style={{ maxWidth: 560, margin: "40px auto", background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Find your school</h1>
        <p style={{ color: "#667085", marginTop: 0 }}>
          Choose your level, type a few words, and pick your school. We use school names, verified aliases and location clues to make the match faster.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {LEVELS.map(([value, label, hint]) => (
            <button
              key={value}
              onClick={() => { setLevel(value); setPicked(null); setMsg(""); setMissingMode(false); setSent(false) }}
              style={{ padding: 12, borderRadius: 12, border: level === value ? "2px solid #16a34a" : "1px solid #ddd", background: level === value ? "#f0fdf4" : "#fff" }}
            >
              <b>{label}</b>
              <small style={{ display: "block", marginTop: 4, color: "#667085" }}>{hint}</small>
            </button>
          ))}
        </div>

        <input
          disabled={!level}
          value={q}
          onChange={(e) => { setQ(e.target.value); setPicked(null); setMissingMode(false); setSent(false) }}
          placeholder={level ? "e.g. St Marys, Moi, Mangu, school code" : "Choose a level first"}
          style={{ width: "100%", boxSizing: "border-box", marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid #ccc", fontSize: 16 }}
        />

        <select value={county} onChange={(e) => setCounty(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 14, borderRadius: 12, border: "1px solid #ccc" }}>
          <option value="">Any county</option>
          {COUNTIES.map((c) => <option key={c}>{c}</option>)}
        </select>

        <div style={{ fontSize: 13, color: "#667085", marginTop: 8 }}>
          {lat != null && lng != null ? "📍 Using your location to rank nearby schools." : "💡 Location is optional. If allowed, it helps distinguish schools with the same name."}
        </div>

        {searching && <p style={{ color: "#667085", fontSize: 13 }}>Searching schools…</p>}

        {hasAmbiguousNames && (
          <div style={{ marginTop: 12, padding: 12, background: "#fffaeb", border: "1px solid #fedf89", borderRadius: 12, fontSize: 13, color: "#7a2e0e" }}>
            <b>There are schools with the same name.</b> Check the county/sub-county and location details before connecting.
          </div>
        )}

        {rows.map((school) => (
          <button
            key={`${school.source}-${school.id}`}
            onClick={() => { setPicked(school); setMsg("") }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: 13, marginTop: 8, borderRadius: 12, border: picked?.id === school.id && picked?.source === school.source ? "2px solid #16a34a" : "1px solid #e5e7eb", background: picked?.id === school.id && picked?.source === school.source ? "#f0fdf4" : "#fff" }}
          >
            <b>{school.name}</b>
            <div style={{ fontSize: 12, color: "#667085", marginTop: 4 }}>
              {[school.sub_county, school.county, school.ownership_type, school.gender_type].filter(Boolean).join(" · ") || "Location details being verified"}
            </div>
            <div style={{ fontSize: 11, color: "#667085", marginTop: 3 }}>
              {school.levels.join(" · ")}
              {school.distance_km != null ? ` · ${school.distance_km} km away` : ""}
              {school.knec_code ? ` · KNEC ${school.knec_code}` : ""}
            </div>
            {school.source === "DIRECTORY" && (
              <div style={{ marginTop: 5, fontSize: 11, color: "#667085" }}>Directory record · identity is verified before a canonical connection is created.</div>
            )}
          </button>
        ))}

        {q.trim().length >= 2 && !searching && rows.length === 0 && !missingMode && (
          <div style={{ marginTop: 14, padding: 14, background: "#f8fafc", borderRadius: 12 }}>
            <b>We can't see your school yet.</b>
            <p style={{ fontSize: 13, color: "#667085", marginBottom: 10 }}>
              Try a shorter name, an abbreviation, or a school code. If it is genuinely new or missing, send us the details below — you won't need to create a duplicate school yourself.
            </p>
            <button onClick={() => setMissingMode(true)} style={{ width: "100%", padding: 13, borderRadius: 10, border: "1px solid #d0d5dd", background: "#fff", fontWeight: 700 }}>
              My school is new or missing
            </button>
          </div>
        )}

        {msg && <p role="alert" style={{ color: "#b42318", fontWeight: 600 }}>{msg}</p>}

        {picked && (
          <button disabled={busy} onClick={connect} style={{ width: "100%", marginTop: 12, padding: 14, border: 0, borderRadius: 12, background: "#16a34a", color: "#fff", fontWeight: 700 }}>
            {busy ? "Connecting…" : "This is my school →"}
          </button>
        )}

        {!picked && rows.length > 0 && !missingMode && (
          <button onClick={() => setMissingMode(true)} style={{ width: "100%", marginTop: 8, padding: 13, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
            I still can't find my school
          </button>
        )}

        {missingMode && (
          <div style={{ marginTop: 14, padding: 14, background: "#f8fafc", borderRadius: 12 }}>
            {sent ? (
              <>
                <b>School details received.</b>
                <p style={{ fontSize: 13, color: "#667085", marginBottom: 0 }}>
                  We'll check the directory and reconcile the school before creating a duplicate. You can retry the school connection once it is identified.
                </p>
              </>
            ) : (
              <>
                <b>Help us identify the school</b>
                <p style={{ fontSize: 13, color: "#667085" }}>
                  The level is already captured. Add only what you know; the rest is optional.
                </p>
                <input value={subCounty} onChange={(e) => setSubCounty(e.target.value)} placeholder="Sub-county (optional)" style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: 12, borderRadius: 10, border: "1px solid #ccc" }} />
                <input value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} placeholder="KNEC/NEMIS code (optional)" style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: 12, borderRadius: 10, border: "1px solid #ccc" }} />
                <input value={alternativeName} onChange={(e) => setAlternativeName(e.target.value)} placeholder="Another name people use (optional)" style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: 12, borderRadius: 10, border: "1px solid #ccc" }} />
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything that will help us identify it (optional)" rows={3} style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: 12, borderRadius: 10, border: "1px solid #ccc", resize: "vertical" }} />
                <button disabled={busy} onClick={requestMissingSchool} style={{ width: "100%", padding: 13, border: 0, borderRadius: 10, background: "#111827", color: "#fff", fontWeight: 700 }}>
                  {busy ? "Sending…" : "Send school details"}
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
