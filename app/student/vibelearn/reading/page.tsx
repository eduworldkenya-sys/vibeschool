"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search, ArrowLeft, LibraryBig } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";

type Publication = {
  id: string;
  title: string;
  description: string | null;
  cbc_grade: string | null;
  cbc_subject: string | null;
};

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function IndependentReadingPage() {
  const { identity } = useStudent();
  const [books, setBooks] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const learnerGrade = normalized(identity?.className);

  useEffect(() => {
    let mounted = true;
    supabase.from("vibe_publications")
      .select("id,title,description,cbc_grade,cbc_subject")
      .eq("status", "published")
      .eq("format", "vibetextbook")
      .order("title", { ascending: true })
      .limit(150)
      .then(({ data, error: fetchError }) => {
        if (!mounted) return;
        if (fetchError) setError("Published reading materials could not be loaded. Please try again.");
        else setBooks((data ?? []) as Publication[]);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const grades = useMemo(() => Array.from(new Set(books.map(book => book.cbc_grade?.trim()).filter((value): value is string => Boolean(value)))).sort((a,b) => a.localeCompare(b, "en", { numeric: true })), [books]);
  const myGrade = grades.find(value => normalized(value) === learnerGrade);
  const selectedGrade = grade || myGrade || "";
  const visible = useMemo(() => books.filter(book => {
    const matchesGrade = !selectedGrade || normalized(book.cbc_grade) === normalized(selectedGrade);
    const text = [book.title, book.cbc_subject, book.description].join(" ").toLowerCase();
    return matchesGrade && text.includes(query.trim().toLowerCase());
  }), [books, selectedGrade, query]);

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px 110px", color: "var(--vs-text, #0f172a)" }}>
      <Link href="/student/vibelearn" style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, color: "var(--vs-accent, #4338ca)", textDecoration: "none" }}>
        <ArrowLeft size={18} aria-hidden="true" /> Learn
      </Link>
      <header style={{ margin: "12px 0 20px" }}>
        <BookOpen size={28} aria-hidden="true" strokeWidth={1.8} />
        <h1 style={{ fontSize: 26, margin: "8px 0" }}>Reading Library</h1>
        <p style={{ color: "var(--vs-muted, #64748b)", margin: 0, lineHeight: 1.5 }}>Read published VibeSchool textbooks independently. Your progress remains with your learner account.</p>
      </header>
      <section aria-label="Find reading material" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginBottom: 18 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>
          Search books or subjects
          <span style={{ position: "relative" }}><Search aria-hidden="true" size={17} style={{ position: "absolute", left: 11, top: 12, color: "#64748b" }} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search" style={{ width: "100%", boxSizing: "border-box", minHeight: 44, padding: "10px 10px 10px 35px", borderRadius: 12, border: "1px solid var(--vs-border, #cbd5e1)", background: "var(--vs-card, #fff)", color: "inherit" }} />
          </span>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>
          Grade or form
          <select value={selectedGrade} onChange={event => setGrade(event.target.value)} style={{ minHeight: 44, padding: 10, borderRadius: 12, border: "1px solid var(--vs-border, #cbd5e1)", background: "var(--vs-card, #fff)", color: "inherit" }}>
            <option value="">All available levels</option>
            {grades.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </section>
      {loading ? <p role="status">Loading published textbooks…</p> : error ? <p role="alert">{error}</p> : visible.length === 0 ? (
        <section style={{ padding: 24, border: "1px solid var(--vs-border, #e2e8f0)", borderRadius: 16 }}>
          <LibraryBig size={26} aria-hidden="true" />
          <h2 style={{ fontSize: 17 }}>No published textbook found for this selection</h2>
          <p style={{ color: "var(--vs-muted, #64748b)", fontSize: 13 }}>Try another grade or search. Materials are only shown after publication.</p>
          <button onClick={() => { setQuery(""); setGrade(myGrade ? "all" : ""); }} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid var(--vs-border, #e2e8f0)", background: "var(--vs-card, #fff)", color: "inherit", cursor: "pointer" }}>Show all levels</button>
        </section>
      ) : (
        <section aria-label="Published textbooks" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
          {visible.map(book => (
            <Link key={book.id} href={`/read/textbook/${encodeURIComponent(book.id)}`} style={{ display: "grid", gap: 8, padding: 16, borderRadius: 16, border: "1px solid var(--vs-border, #e2e8f0)", background: "var(--vs-card, #fff)", color: "inherit", textDecoration: "none", minHeight: 132 }}>
              <BookOpen size={24} strokeWidth={1.8} aria-hidden="true" />
              <strong style={{ fontSize: 15 }}>{book.title}</strong>
              <span style={{ color: "var(--vs-muted, #64748b)", fontSize: 12 }}>{[book.cbc_grade, book.cbc_subject].filter(Boolean).join(" · ") || "Reading material"}</span>
              <span style={{ color: "var(--vs-accent, #4338ca)", fontWeight: 700, fontSize: 12 }}>Read textbook</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
