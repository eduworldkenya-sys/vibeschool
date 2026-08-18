"use client"

import { createContext, useContext, useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getTwinAuthorityContext, requireTwinRole } from "@/lib/twin/core"

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
        // Twin/portal role authority is relationship-derived. profiles.role is not
        // an authorization root, which allows one identity to hold multiple roles.
        const authority = await getTwinAuthorityContext()
        const studentBindings = requireTwinRole(authority, "student")
        if (studentBindings.length > 1) {
          throw new Error("Multiple current learner school scopes are attached to this account. Choose or reconcile the active enrollment before continuing.")
        }
        const binding = studentBindings[0]
        const userId = authority.userId

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .single()

        if (profileErr || !profile) { router.replace("/?role=student"); return }

        const { data: student, error: studentErr } = await supabase
          .from("students")
          .select("id, name, admission_number, class_id")
          .eq("profile_id", userId)
          .is("deleted_at", null)
          .maybeSingle()

        if (studentErr) throw new Error(studentErr.message || "Learner identity could not be resolved.")
        if (!student) {
          router.replace("/student/claim")
          return
        }
        if (student.id !== binding.scopeId) throw new Error("Learner identity does not match the authorized Student Twin scope.")

        let classId: string | null = null
        let schoolId: string | null = binding.schoolId

        if (schoolId) {
          const { data: enrollment, error: enrollmentErr } = await supabase
            .from("student_classes")
            .select("class_id, school_id")
            .eq("student_id", student.id)
            .eq("school_id", schoolId)
            .eq("is_current", true)
            .order("joined_at", { ascending: false })
            .limit(1)
            .maybeSingle()
          if (enrollmentErr) throw new Error(enrollmentErr.message || "Current learner enrollment could not be resolved.")
          classId = enrollment?.class_id ?? null
          schoolId = enrollment?.school_id ?? schoolId
        } else {
          // Legacy fallback only when there is no current canonical enrollment yet.
          classId = student.class_id ?? null
        }

        let className = ""
        if (classId) {
          const { data: cls } = await supabase
            .from("classes")
            .select("name, stream, school_id")
            .eq("id", classId)
            .single()
          if (cls) {
            className = cls.name + (cls.stream ? " " + cls.stream : "")
            schoolId = schoolId ?? cls.school_id ?? null
          }
        }

        let schoolName = ""
        if (schoolId) {
          const { data: school } = await supabase
            .from("schools")
            .select("name")
            .eq("id", schoolId)
            .single()
          schoolName = school?.name ?? ""
        }

        const fullName  = student.name?.trim() || profile.full_name?.trim() || "Student"
        const firstName = fullName.split(/\s+/)[0] || "Student"

        setIdentity({
          profileId:   userId,
          studentId:   student.id,
          classId,
          schoolId,
          name:        fullName,
          firstName,
          admissionNo: student.admission_number ?? "",
          className,
          schoolName,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not load your student identity. Please try again."
        setError(message)
        console.error("StudentProvider resolve error:", e)
      } finally {
        setLoading(false)
      }
    }

    void resolve()
  }, [router])

  return (
    <StudentCtx.Provider value={{ identity, loading, error }}>
      {children}
    </StudentCtx.Provider>
  )
}
