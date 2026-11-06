"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

export type KenyaCounty = { code: string; official_name: string; display_name: string };
let cached: KenyaCounty[] | null = null;
let pending: Promise<KenyaCounty[]> | null = null;

export async function fetchKenyaCounties(): Promise<KenyaCounty[]> {
  if (cached) return cached;
  if (!pending) {
    pending = (async () => {
      const { data, error } = await getSupabaseClient().rpc("list_kenya_counties" as never);
      if (error) throw error;
      const rows = (data ?? []) as KenyaCounty[];
      if (rows.length !== 47 || new Set(rows.map(row => row.code)).size !== 47) {
        throw new Error("The approved 47-county registry is unavailable.");
      }
      cached = rows;
      return rows;
    })().finally(() => { pending = null; });
  }
  return pending;
}

export function normalizeKenyaCounty(value: string, counties: KenyaCounty[]): string {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return counties.find(row =>
    row.official_name.toLowerCase().replace(/[^a-z0-9]/g, "") === key ||
    row.display_name.toLowerCase().replace(/[^a-z0-9]/g, "") === key
  )?.display_name ?? value;
}

export function useKenyaCounties() {
  const [counties, setCounties] = useState<KenyaCounty[]>(cached ?? []);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetchKenyaCounties().then(rows => {
      if (active) { setCounties(rows); setError(""); }
    }).catch(() => {
      if (active) setError("County choices are temporarily unavailable. Please try again.");
    });
    return () => { active = false; };
  }, []);
  return { counties, countyNames: counties.map(row => row.display_name), error };
}
