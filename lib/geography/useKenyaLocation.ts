"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useKenyaCounties } from "@/lib/geography/kenyaCounties";

export type ApprovedPlace = { id: string; official_code: string | null; official_name: string };
type HierarchyState = {
  countyCode: string;
  subcountyId: string;
  wardId: string;
};
const empty = { countyCode: "", subcountyId: "", wardId: "" };

export function useKenyaLocation(initial: Partial<HierarchyState> = {}) {
  const { counties, error: countyError } = useKenyaCounties();
  const [selection, setSelection] = useState<HierarchyState>({ ...empty, ...initial });
  const [subcounties, setSubcounties] = useState<ApprovedPlace[]>([]);
  const [wards, setWards] = useState<ApprovedPlace[]>([]);
  const [loadingSubcounties, setLoadingSubcounties] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setSubcounties([]);
    setWards([]);
    if (!selection.countyCode) { setLoadingSubcounties(false); return; }
    setLoadingSubcounties(true);
    void getSupabaseClient().rpc("list_kenya_subcounties" as never, { p_county_code: selection.countyCode } as never)
      .then(({ data, error: issue }) => {
        if (!live) return;
        if (issue) { setError("Subcounty options are unavailable."); return; }
        setSubcounties((data ?? []) as ApprovedPlace[]);
        setError("");
      })
      .catch(() => { if (live) setError("Subcounty options are unavailable."); })
      .finally(() => { if (live) setLoadingSubcounties(false); });
    return () => { live = false; };
  }, [selection.countyCode]);

  useEffect(() => {
    let live = true;
    setWards([]);
    if (!selection.subcountyId) { setLoadingWards(false); return; }
    setLoadingWards(true);
    void getSupabaseClient().rpc("list_kenya_wards" as never, { p_subcounty_id: selection.subcountyId } as never)
      .then(({ data, error: issue }) => {
        if (!live) return;
        if (issue) { setError("Ward options are unavailable."); return; }
        setWards((data ?? []) as ApprovedPlace[]);
        setError("");
      })
      .catch(() => { if (live) setError("Ward options are unavailable."); })
      .finally(() => { if (live) setLoadingWards(false); });
    return () => { live = false; };
  }, [selection.subcountyId]);

  const selectedCounty = useMemo(() => counties.find(c => c.code === selection.countyCode), [counties, selection.countyCode]);
  const selectedSubcounty = subcounties.find(s => s.id === selection.subcountyId);
  const selectedWard = wards.find(w => w.id === selection.wardId);
  function chooseCounty(countyCode: string) { setSelection({ countyCode, subcountyId: "", wardId: "" }); }
  function chooseSubcounty(subcountyId: string) { setSelection(current => ({ ...current, subcountyId, wardId: "" })); }
  function chooseWard(wardId: string) { setSelection(current => ({ ...current, wardId })); }
  return { counties, subcounties, wards, selectedCounty, selectedSubcounty, selectedWard,
    selection, chooseCounty, chooseSubcounty, chooseWard, loading: loadingSubcounties || loadingWards, error: error || countyError };
}
