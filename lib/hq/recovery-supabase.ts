"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let recoveryClient: SupabaseClient | null = null

export function getHQRecoverySupabaseClient() {
  if (!recoveryClient) {
    recoveryClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storageKey: "vibeschool-hq-recovery-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      }
    )
  }
  return recoveryClient
}

export const hqRecoverySupabase = getHQRecoverySupabaseClient()
