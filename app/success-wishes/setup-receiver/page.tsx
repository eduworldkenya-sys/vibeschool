'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Crown,
  School as SchoolIcon,
  Search,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Lock,
  ArrowLeft,
  FileCheck
} from 'lucide-react'

type School = { id: string; name: string }
type Student = { id: string; name: string; admissionNumber: string | null }
type Guardian = { id: string; relationship: string }

const provision = '/api/success-wishes/receiver/provision'

export default function ReceiverSchoolSetup() {
  const [schools, setSchools] = useState<School[]>([])
  const [schoolId, setSchoolId] = useState('')
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [guardianId, setGuardianId] = useState('')
  const [recordRef, setRecordRef] = useState('')
  const [attested, setAttested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    void fetch('/api/success-wishes/my-schools', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'School setup is unavailable.')
        return data
      })
      .then((data) => {
        if (mounted) setSchools(data.schools || [])
      })
      .catch((e) => {
        if (mounted)
          setError(
            e instanceof Error ? e.message : 'Could not load authorised schools.'
          )
      })
    return () => {
      mounted = false
    }
  }, [])

  async function request(url: string, options?: RequestInit) {
    const r = await fetch(url, { cache: 'no-store', ...options })
    const data = await r.json()
    if (!r.ok)
      throw new Error(
        data.error || 'The registration request could not be completed.'
      )
    return data
  }

  async function search() {
    setBusy(true)
    setError('')
    setMessage('')
    setStudent(null)
    setStudents([])
    setGuardians([])
    try {
      if (!schoolId || query.trim().length < 2)
        throw new Error('Choose a school and enter at least two letters.')
      const data = await request(
        '/api/success-wishes/candidates?schoolId=' +
          encodeURIComponent(schoolId) +
          '&q=' +
          encodeURIComponent(query.trim())
      )
      setStudents(data.candidates || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setBusy(false)
    }
  }

  async function choose(candidate: Student) {
    setBusy(true)
    setError('')
    setMessage('')
    setGuardianId('')
    setRecordRef('')
    setAttested(false)
    setStudent(candidate)
    setGuardians([])
    try {
      const data = await request(
        provision +
          '?schoolId=' +
          encodeURIComponent(schoolId) +
          '&studentId=' +
          encodeURIComponent(candidate.id)
      )
      setGuardians(data.guardians || [])
      if (!data.guardians?.length)
        setMessage(
          'No primary guardian with school consent authority is linked. Correct the official school record before proceeding.'
        )
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'The student could not be verified.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function register() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (!student || !guardianId || !attested || recordRef.trim().length < 6)
        throw new Error(
          'Choose a guardian, verify the school record, and enter its reference.'
        )
      const data = await request(provision, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          studentId: student.id,
          guardianLinkId: guardianId,
          schoolRecordReference: recordRef.trim(),
          schoolRecordChecked: attested
        })
      })
      setMessage(data.message || 'Recipient registered pending guardian consent.')
      setRecordRef('')
      setAttested(false)
      setGuardianId('')
      setStudent(null)
      setGuardians([])
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Registration was not completed.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 bg-[#0A0D14] text-slate-200 antialiased selection:bg-[#D4AF37] selection:text-black flex flex-col justify-between relative overflow-x-hidden">

      {/* BACKGROUND GLOWS */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#00A896]/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* TOP HEADER */}


      {/* MAIN CONTAINER */}
      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center space-y-6 relative z-10">

        {/* HERO TITLE */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider mb-1">
            <SchoolIcon className="w-3.5 h-3.5" />
            <span>School-Assisted Pilot</span>
          </div>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[#FFF5C0] via-[#D4AF37] to-[#AA7C11] bg-clip-text text-transparent">
            Register a Verified Student Recipient.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            For school administrators only. A guardian must be linked in the school system and have a separately verified phone. The recipient will not need a VibeSchool login. No wish can be opened until guardian consent is verified.
          </p>
        </div>

        {/* FEEDBACK ALERTS */}
        {error && (
          <div
            className="p-4 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs sm:text-sm space-y-1"
            role="alert"
          >
            <div className="flex items-center gap-2 font-bold text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Registration Error</span>
            </div>
            <p className="pl-6">{error}</p>
          </div>
        )}

        {message && (
          <div
            className="p-4 rounded-2xl bg-[#00A896]/15 border border-[#00A896]/40 text-[#00A896] text-xs sm:text-sm space-y-1"
            role="status"
          >
            <div className="flex items-center gap-2 font-bold text-[#00A896]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Notice</span>
            </div>
            <p className="pl-6 text-slate-300">{message}</p>
          </div>
        )}

        {/* STEP 1: FIND THE STUDENT */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#D4AF37]/30 shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#D4AF37]" />
              <span>1. Find the Student</span>
            </h2>
            <span className="text-[10px] text-slate-400">Step 1 of 2</span>
          </div>

          <div className="space-y-4">
            {/* School Selector */}
            <div className="space-y-1.5">
              <label htmlFor="setup-receiver-field-1" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                School
              </label>
              <select id="setup-receiver-field-1"
                value={schoolId}
                onChange={(e) => {
                  setSchoolId(e.target.value)
                  setStudent(null)
                  setStudents([])
                  setGuardians([])
                  setMessage('')
                }}
                className="w-full bg-slate-900 border border-slate-800 focus:border-[#D4AF37] rounded-xl px-3.5 py-3 text-xs text-slate-200 focus:outline-none transition-colors"
              >
                <option value="">Choose your school</option>
                {schools.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Candidate Search */}
            <div className="space-y-1.5">
              <label htmlFor="setup-receiver-field-2" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Student Name
              </label>
              <input id="setup-receiver-field-2"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={80}
                placeholder="Search official school roll..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-[#D4AF37] rounded-xl px-3.5 py-3 text-xs text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600"
              />
            </div>

            <button
              type="button"
              disabled={busy || !schoolId || query.trim().length < 2}
              onClick={() => void search()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-slate-950 font-bold text-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-md shadow-[#D4AF37]/20"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Searching Roll...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Students</span>
                </>
              )}
            </button>

            {/* Candidate Search Results */}
            {students.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Select Matching Student
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {students.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => void choose(s)}
                      disabled={busy}
                      className="w-full text-left p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-[#00A896]/50 text-slate-200 font-medium text-xs active:scale-98 transition-all flex items-center justify-between group"
                    >
                      <span className="group-hover:text-[#00A896] transition-colors">
                        {s.name}
                        {s.admissionNumber ? ` · ${s.admissionNumber}` : ''}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#00A896] group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: CHECK THE GUARDIAN */}
        {student && (
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border-2 border-[#00A896]/50 shadow-2xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#00A896]" />
                <span>2. Check the Guardian</span>
              </h2>
              <span className="text-[10px] text-slate-400">Step 2 of 2</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Selected Student:{' '}
              <strong className="text-slate-100 font-semibold">{student.name}</strong>. Only primary guardians linked to this school are eligible. Never enter a phone number on behalf of the guardian.
            </p>

            <div className="space-y-4">
              {/* Linked Guardian Selector */}
              <div className="space-y-1.5">
                <label htmlFor="setup-receiver-field-3" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  School-Linked Guardian
                </label>
                <select id="setup-receiver-field-3"
                  value={guardianId}
                  onChange={(e) => setGuardianId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-[#00A896] rounded-xl px-3.5 py-3 text-xs text-slate-200 focus:outline-none transition-colors"
                >
                  <option value="">Choose the verified school link</option>
                  {guardians.map((g, i) => (
                    <option key={g.id} value={g.id}>
                      {g.relationship} · #{i + 1}
                    </option>
                  ))}
                </select>
              </div>

              {/* Record Reference Input */}
              <div className="space-y-1.5">
                <label htmlFor="setup-receiver-field-4" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  School Record Reference
                </label>
                <input id="setup-receiver-field-4"
                  value={recordRef}
                  maxLength={120}
                  onChange={(e) => setRecordRef(e.target.value)}
                  placeholder="Reference code of the official register checked..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-[#00A896] rounded-xl px-3.5 py-3 text-xs text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600 font-mono"
                />
              </div>

              {/* Legal Verification Checkbox */}
              <label className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer text-xs text-slate-300 leading-relaxed hover:border-[#00A896]/30 transition-colors">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-[#00A896] focus:ring-[#00A896] accent-[#00A896] w-4 h-4 shrink-0"
                />
                <span>
                  I verified the student's identity and the listed guardian's authority against the school's official records.
                </span>
              </label>

              {/* Submit Action */}
              <button
                type="button"
                disabled={
                  busy ||
                  !guardianId ||
                  !attested ||
                  recordRef.trim().length < 6
                }
                onClick={() => void register()}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#00A896] to-[#0F5257] text-white font-bold text-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#00A896]/20"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying &amp; Registering...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Register Recipient</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <Link
            href="/success-wishes/privacy-review"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <FileCheck className="w-3.5 h-3.5 text-[#00A896]" />
            <span>Receiver Privacy Queue</span>
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/success-wishes"
            className="hover:text-[#D4AF37] transition-colors flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Success Wishes</span>
          </Link>
        </div>

      </main>

      {/* FOOTER */}


    </div>
  )
}
