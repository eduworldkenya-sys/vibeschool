"use client";

import SearchableSelect from "@/components/ui/SearchableSelect";
import { useKenyaLocation } from "@/lib/geography/useKenyaLocation";

/** Verified geography only. If a tier is not yet approved, it is not guessed. */
export function KenyaLocationFields({ onChange }: {
  onChange?: (value: { countyCode: string; countyName: string; subcountyId: string; subcountyName: string; wardId: string; wardName: string }) => void;
}) {
  const location = useKenyaLocation();
  const { selection, counties, subcounties, wards, loading, error } = location;
  const countyByName = (name: string) => counties.find(c => c.display_name === name);
  const subcountyByName = (name: string) => subcounties.find(s => s.official_name === name);
  const wardByName = (name: string) => wards.find(w => w.official_name === name);
  const emit = (countyCode: string, subcountyId = "", wardId = "") => {
    onChange?.({
      countyCode, countyName: counties.find(c => c.code === countyCode)?.display_name ?? "",
      subcountyId, subcountyName: subcounties.find(s => s.id === subcountyId)?.official_name ?? "",
      wardId, wardName: wards.find(w => w.id === wardId)?.official_name ?? ""
    });
  };
  return <div style={{display:"grid",gap:12}}>
    <label style={{display:"grid",gap:6}}>County
      <SearchableSelect label="County" value={location.selectedCounty?.display_name ?? ""} onChange={name => {
        const code = countyByName(name)?.code ?? "";
        location.chooseCounty(code); emit(code);
      }} options={counties.map(c => c.display_name)} placeholder="Search county…" />
    </label>
    <label style={{display:"grid",gap:6}}>Subcounty
      <SearchableSelect label="Subcounty" value={location.selectedSubcounty?.official_name ?? ""} onChange={name => {
        const id = subcountyByName(name)?.id ?? "";
        location.chooseSubcounty(id); emit(selection.countyCode, id);
      }} options={subcounties.map(s => s.official_name)} placeholder={selection.countyCode ? (subcounties.length ? "Search subcounty…" : "No verified subcounties yet") : "Choose county first"} disabled={!selection.countyCode || subcounties.length === 0} />
    </label>
    <label style={{display:"grid",gap:6}}>Ward
      <SearchableSelect label="Ward" value={location.selectedWard?.official_name ?? ""} onChange={name => {
        const id = wardByName(name)?.id ?? "";
        location.chooseWard(id); emit(selection.countyCode, selection.subcountyId, id);
      }} options={wards.map(w => w.official_name)} placeholder={selection.subcountyId ? (wards.length ? "Search ward…" : "No verified wards yet") : "Choose subcounty first"} disabled={!selection.subcountyId || wards.length === 0} />
    </label>
    {loading && <span role="status">Loading approved locations…</span>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
