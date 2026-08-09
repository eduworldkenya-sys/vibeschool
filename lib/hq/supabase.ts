"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let hqClient: SupabaseClient | null = null

export function getHQSupabaseClient() {
  if (!hqClient) {
    hqClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storageKey: "vibeschool-hq-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      }
    )
  }

  return hqClient
}

export const hqSupabase = getHQSupabaseClient()
