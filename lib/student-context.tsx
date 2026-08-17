"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getLearnerCoreIdentityForProfile } from "@/lib/learner/profile-core"

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

const StudentCtx = createContext<StudentCtxValue>({ identity: null, loading: true, error: null })

export function useStudent() {
  return useContext(StudentCtx)
}

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [identity, setIdentity] = useState<StudentIdentity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const resolved = useRef(false)

  useEffect(() => {
    if (resolved.current) return
    resolved.current = true

    async function resolve() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace("/?role=student"); return }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        if (profileErr || !profile || profile.role !== "student") {
          router.replace("/?role=student")
          return
        }

        let learner
        try {
          learner = await getLearnerCoreIdentityForProfile(user.id)
        } catch {
          router.replace("/student/claim")
          return
        }

        const fullName = learner.name.trim() || "Student"
        setIdentity({
          profileId: user.id,
          studentId: learner.studentId,
          classId: learner.classId,
          schoolId: learner.schoolId,
          name: fullName,
          firstName: fullName.split(/\s+/)[0] || "Student",
          admissionNo: learner.admissionNumber ?? "",
          className: learner.className,
          schoolName: learner.schoolName,
        })
      } catch (cause) {
        setError("Could not load your profile. Please try again.")
        console.error("StudentProvider resolve error:", cause)
      } finally {
        setLoading(false)
      }
    }

    void resolve()
  }, [router])

  return <StudentCtx.Provider value={{ identity, loading, error }}>{children}</StudentCtx.Provider>
}
