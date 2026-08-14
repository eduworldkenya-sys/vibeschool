"use client"

import { createContext, useContext, useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export interface StudentIdentity {
  profileId:   string
  studentId:   string
  classId:     string | null
  schoolId:    string | null
  name:        string
  firstName:   string
  admissionNo: string
  className:   string
  schoolName:  string
}

interface StudentCtxValue {
  identity: StudentIdentity | null
  loading:  boolean
  error:    string | null
}

const StudentCtx = createContext<StudentCtxValue>({
  identity: null,
  loading:  true,
  error:    null,
})

export function useStudent() {
  return useContext(StudentCtx)
}

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  const [identity, setIdentity] = useState<StudentIdentity | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const resolved = useRef(false)

  useEffect(() => {
    if (resolved.current) return
    resolved.current = true

    async function resolve() {
      try {
        // 1. Auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace("/?role=student"); return }

        // 2. Profile is the authenticated account record, not the school learner authority.
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single()

        if (profileErr || !profile) { router.replace("/?role=student"); return }
        if (profile.role !== "student") { router.replace("/?role=student"); return }

        // 3. Student row is the canonical school learner identity chain pivot.
        const { data: student, error: studentErr } = await supabase
          .from("students")
          .select("id, name, admission_number, class_id")
          .eq("profile_id", user.id)
          .single()

        if (studentErr || !student) {
          router.replace("/student/claim")
          return
        }

        // 4. Class — null safe
        let className  = ""
        let schoolId: string | null = null

        if (student.class_id) {
          const { data: cls } = await supabase
            .from("classes")
            .select("name, stream, school_id")
            .eq("id", student.class_id)
            .single()

          if (cls) {
            className = cls.name + (cls.stream ? " " + cls.stream : "")
            schoolId  = cls.school_id ?? null
          }
        }

        // 5. School — null safe
        let schoolName = ""
        if (schoolId) {
          const { data: school } = await supabase
            .from("schools")
            .select("name")
            .eq("id", schoolId)
            .single()
          schoolName = school?.name ?? ""
        }

        // School-controlled learner name wins. profiles.full_name remains a safe fallback
        // for legacy rows while the identity data is reconciled.
        const fullName  = student.name?.trim() || profile.full_name?.trim() || "Student"
        const firstName = fullName.split(/\s+/)[0] || "Student"

        setIdentity({
          profileId:   user.id,
          studentId:   student.id,
          classId:     student.class_id ?? null,
          schoolId,
          name:        fullName,
          firstName,
          admissionNo: student.admission_number ?? "",
          className,
          schoolName,
        })
      } catch (e) {
        setError("Could not load your profile. Please try again.")
        console.error("StudentProvider resolve error:", e)
      } finally {
        setLoading(false)
      }
    }

    resolve()
  }, [router])

  return (
    <StudentCtx.Provider value={{ identity, loading, error }}>
      {children}
    </StudentCtx.Provider>
  )
}
