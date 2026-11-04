"use client"

import { createContext, useContext, useEffect, useState } from "react"
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
  retry:    () => void
}

const StudentCtx = createContext<StudentCtxValue>({
  identity: null,
  loading:  true,
  error:    null,
  retry:    () => undefined,
})

export function useStudent() {
  return useContext(StudentCtx)
}

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  const [identity, setIdentity] = useState<StudentIdentity | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      setLoading(true)
      setError(null)
      try {
        // The canonical learner RPC is the authority for account → student identity.
        // Do not require unrelated teacher/parent Twin queries for student sign-in.
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw new Error("Could not verify this learner session.")
        const userId = auth.user?.id
        if (!userId) {
          if (!cancelled) router.replace("/login/student")
          return
        }

        const { data: canonicalId, error: canonicalError } = await supabase.rpc("current_student_id")
        if (cancelled) return
        if (canonicalError) throw new Error(canonicalError.message || "Learner identity could not be verified.")
        if (!canonicalId) {
          router.replace("/student/claim")
          return
        }

        const [profileRes, learnerRes] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", userId).single(),
          supabase.from("students")
            .select("id, name, admission_number")
            .eq("id", canonicalId)
            .eq("profile_id", userId)
            .is("deleted_at", null)
            .single(),
        ])
        if (cancelled) return
        if (profileRes.error || !profileRes.data || learnerRes.error || !learnerRes.data) {
          throw new Error("Learner account data is unavailable. Please retry.")
        }
        const profile = profileRes.data
        const student = learnerRes.data

        const { data: enrollments, error: enrollmentError } = await supabase
          .from("student_classes")
          .select("class_id, school_id")
          .eq("student_id", student.id)
          .eq("is_current", true)
          .limit(2)
        if (cancelled) return
        if (enrollmentError) throw new Error("Could not verify your current class. Please retry.")
        if (!enrollments?.length) throw new Error("Your school has not confirmed your current class. Ask your teacher to complete enrollment.")
        if (enrollments.length !== 1 || !enrollments[0].class_id || !enrollments[0].school_id) {
          throw new Error("Your school has conflicting or incomplete current enrollment. Ask an administrator to correct it.")
        }
        const classId = enrollments[0].class_id
        const schoolId = enrollments[0].school_id

        let className = ""
        if (classId) {
          const { data: cls, error: classError } = await supabase
            .from("classes")
            .select("name, stream, school_id")
            .eq("id", classId)
            .single()
          if (cancelled) return
          if (classError || !cls || cls.school_id !== schoolId) throw new Error("Your class does not match the current school enrollment.")
          className = cls.name + (cls.stream ? " " + cls.stream : "")
        }

        let schoolName = ""
        if (schoolId) {
          const { data: school, error: schoolError } = await supabase
            .from("schools")
            .select("name")
            .eq("id", schoolId)
            .single()
          if (cancelled) return
          if (schoolError || !school) throw new Error("Your school record is unavailable. Please retry.")
          schoolName = school.name ?? ""
        }

        const fullName  = student.name?.trim() || profile.full_name?.trim() || "Student"
        const firstName = fullName.split(/\s+/)[0] || "Student"

        if (!cancelled) {
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
        }
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : "Could not load your student identity. Please try again."
        setIdentity(null)
        setError(message)
        console.error("StudentProvider resolve error:", e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void resolve()
    return () => { cancelled = true }
  }, [router, retryNonce])

  function retry() {
    setRetryNonce(value => value + 1)
  }

  return (
    <StudentCtx.Provider value={{ identity, loading, error, retry }}>
      {children}
    </StudentCtx.Provider>
  )
}