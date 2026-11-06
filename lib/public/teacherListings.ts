import { vacancyApplication } from "./vacancyApplication";

export const NOT_PROVIDED = "Not provided";
export const JOB_SELECT = "id,title,school_name,county,location,employment_type,application_url,closing_date,description,created_at";
export const SWAP_SELECT = "id,current_county,current_subcounty,preferred_county,preferred_subcounty,school_level,subject,created_at";
export type PublicJob = { id: string; title: string; school_name: string; county: string; location: string | null; employment_type: string | null; application_url: string | null; closing_date: string | null; description: string | null; created_at?: string };
export type PublicSwap = { id: string; current_county: string; current_subcounty: string; preferred_county: string; preferred_subcounty: string | null; school_level: string; subject: string; created_at: string };
export type ListingField = { label: string; value: string };
export type ListingAction = { href: string; label: string; external: boolean };
export type TeacherListing = { id: string; kind: "job" | "swap"; title: string; school: string; subtitle: string; fields: ListingField[]; details: string; actions: ListingAction[] };

export function provided(value: string | null | undefined): string {
  const text = value?.trim();
  return !text || /^not (specified|provided)$/i.test(text) ? NOT_PROVIDED : text;
}
export function listingDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return NOT_PROVIDED;
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(value));
}
export const validListingId = (value: string | null): value is string => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Only literal information from the advert is promoted into the summary. */
export function jobListing(job: PublicJob): TeacherListing {
  const description = job.description ?? "";
  const subject = job.title.match(/^Junior School Teacher\s*[—-]\s*(.+)$/i)?.[1]
    ?? job.title.match(/^(Music|Computer|P\.?E\.?|Mathematics|Physics|Chemistry|Biology|English|Kiswahili|History|Geography|CRE|IRE|French|German|Arabic)\b/i)?.[1]
    ?? description.match(/able to handle\s+([^.!]+)[.!]/i)?.[1];
  const level = job.title.match(/\b(Lower Primary|Upper Primary|Junior School|Senior School|Kindergarten|ECDE|Primary School)\b/i)?.[1];
  const start = job.title.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/i)?.[0]
    ?? description.match(/\bfor (?:the )?(20\d{2} academic year)\b/i)?.[1];
  const actions: ListingAction[] = [];
  const add = (input: string) => {
    let action = vacancyApplication(input);
    if (action?.href.startsWith("tel:")) {
      const phone = action.href.slice(4);
      if (/^0[17][0-9]{8}$/.test(phone)) action = { ...action, href: "tel:+254" + phone.slice(1) };
      else if (/^254[17][0-9]{8}$/.test(phone)) action = { ...action, href: "tel:+" + phone };
    }
    if (!action || actions.some(a => a.href.toLowerCase() === action.href.toLowerCase())) return;
    let label = action.href.startsWith("mailto:") ? "Email school" : action.href.startsWith("tel:") ? "Call school" : "Apply online";
    if (action.external && ["wa.me", "api.whatsapp.com"].includes(new URL(action.href).hostname)) label = "WhatsApp";
    actions.push({ ...action, label });
  };
  if (job.application_url) add(job.application_url);
  for (const match of description.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) add(match[0]);
  for (const match of description.matchAll(/(?<!\d)(?:\+254|254|0)[17](?:[ -]?\d){8}(?!\d)/g)) add(match[0].replace(/[ -]/g, ""));
  return {
    id: job.id, kind: "job", title: provided(job.title), school: provided(job.school_name), subtitle: `${provided(job.county)} · ${provided(job.location)}`,
    fields: [
      { label: "School name", value: provided(job.school_name) }, { label: "County", value: provided(job.county) },
      { label: "Location", value: provided(job.location) }, { label: "Subjects", value: provided(subject) },
      { label: "Teaching level", value: provided(level) }, { label: "Employment type", value: provided(job.employment_type) },
      { label: "Start date", value: provided(start) }, { label: "Application deadline", value: listingDate(job.closing_date) },
      { label: "Published", value: listingDate(job.created_at) },
    ], details: provided(job.description), actions,
  };
}

export function swapListing(swap: PublicSwap): TeacherListing {
  // Private interest messages and phone numbers are deliberately never projected.
  return {
    id: swap.id, kind: "swap", title: `${provided(swap.current_county)} → ${provided(swap.preferred_county)}`, school: NOT_PROVIDED,
    subtitle: `${provided(swap.school_level)} · ${provided(swap.subject)}`,
    fields: [
      { label: "School name", value: NOT_PROVIDED }, { label: "County", value: provided(swap.current_county) },
      { label: "Location", value: provided(swap.current_subcounty) }, { label: "Subjects", value: provided(swap.subject) },
      { label: "Teaching level", value: provided(swap.school_level) }, { label: "Employment type", value: NOT_PROVIDED },
      { label: "Start date", value: NOT_PROVIDED }, { label: "Application deadline", value: NOT_PROVIDED },
      { label: "Published", value: listingDate(swap.created_at) },
      { label: "Current station", value: `${provided(swap.current_county)} · ${provided(swap.current_subcounty)}` },
      { label: "Desired county", value: provided(swap.preferred_county) }, { label: "Desired sub-county", value: provided(swap.preferred_subcounty) },
    ], details: NOT_PROVIDED, actions: [],
  };
}

export function listingText(listing: TeacherListing): string {
  return ["VibeSchool · " + (listing.kind === "job" ? "School job" : "Teacher swap"), listing.title, ...listing.fields.map(f => `${f.label}: ${f.value}`), "", "Full advert & requirements", listing.details, "", ...listing.actions.map(a => `${a.label}: ${a.href}`), ...(listing.kind === "swap" ? ["Contact is shared privately through interest requests. A match is not official TSC transfer approval."] : [])].join("\n");
}
export function listingUrl(kind: TeacherListing["kind"], id: string, origin: string): string {
  const url = new URL("/teacher", origin); url.searchParams.set(kind, id); return url.href;
}
