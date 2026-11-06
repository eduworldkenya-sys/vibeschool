"use client";

import { useEffect, useState } from "react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { getSupabaseClient } from "@/lib/supabase";

type VerifiedSubcounty = { id: string; official_code: string | null; official_name: string };
type Props = { countyCode: string; label: string; value: string; onChange: (value: string) => void; optional?: boolean };

export default function SwapSubcountyField({ countyCode, label, value, onChange, optional = false }: Props) {
  const [choices, setChoices] = useState<VerifiedSubcounty[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setChoices([]);
    setFailed(false);
    if (!countyCode) { setLoading(false); return; }
    setLoading(true);
    void Promise.resolve(getSupabaseClient().rpc("list_kenya_subcounties" as never, { p_county_code: countyCode } as never))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setFailed(true); return; }
        setChoices((data ?? []) as VerifiedSubcounty[]);
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [countyCode]);

  const names = choices.map(item => item.official_name);
  const legacy = !!value && names.length > 0 && !names.some(name => name.toLowerCase() === value.toLowerCase());
  const selectAvailable = countyCode && !loading && !failed && names.length > 0 && !legacy;

  return <div>
    {selectAvailable ?
      <label>{label}<SearchableSelect label={label} options={names} value={value} placeholder={optional ? "Any verified subcounty" : "Search verified subcounty"} onChange={onChange} /></label> :
      <label>{label}<input value={value} maxLength={100} placeholder={optional ? "Any subcounty (optional)" : "Enter current subcounty"} onChange={event => onChange(event.target.value)} /></label>}
    {countyCode && (loading ? <small role="status">Loading verified subcounties…</small> :
      failed ? <small>Verified subcounty choices are unavailable. Enter your subcounty manually.</small> :
      legacy ? <small>Your existing subcounty is not yet in the verified directory. You may keep or edit it.</small> :
      names.length === 0 ? <small>No verified subcounty choices for this county yet. Manual entry is available.</small> : null)}
  </div>;
}
