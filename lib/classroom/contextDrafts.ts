/** Tab-local recovery only; these drafts never count as saved learner records. */
export const learnerContextKeys = ["strengths", "interests", "learning_preferences", "helpful_strategies", "support_needs", "accommodations", "communication_preferences", "responsibilities"] as const;
export type LearnerContextKey = typeof learnerContextKeys[number];
export type ContextDraft = { value: string; baseId: string | null; requestId: string; updatedAt: number };
export type DraftScope = { actorId: string; schoolId: string; classId: string; studentId: string };
const PREFIX = "vibeschool:learner-draft:v1:";
const MAX_AGE = 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storageKey = (scope: DraftScope) => PREFIX + [scope.actorId, scope.schoolId, scope.classId, scope.studentId].map(encodeURIComponent).join(":");
function store(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; }
  catch { return null; }
}
export function readContextDrafts(scope: DraftScope, now = Date.now()): { entries: Partial<Record<LearnerContextKey, ContextDraft>>; available: boolean } {
  const storage = store();
  if (!storage) return { entries: {}, available: false };
  try {
    const raw = storage.getItem(storageKey(scope));
    if (!raw) return { entries: {}, available: true };
    const parsed: unknown = JSON.parse(raw);
    const entries: Partial<Record<LearnerContextKey, ContextDraft>> = {};
    if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 1 && "entries" in parsed && parsed.entries && typeof parsed.entries === "object") {
      for (const field of learnerContextKeys) {
        const value: unknown = Reflect.get(parsed.entries, field);
        if (!value || typeof value !== "object") continue;
        const entry = value as Partial<ContextDraft>;
        if (typeof entry.value !== "string" || entry.value.length > 1200 || typeof entry.requestId !== "string" || !uuid.test(entry.requestId)
          || !(entry.baseId === null || typeof entry.baseId === "string" && uuid.test(entry.baseId))
          || typeof entry.updatedAt !== "number" || !Number.isFinite(entry.updatedAt) || entry.updatedAt > now || now - entry.updatedAt > MAX_AGE) continue;
        entries[field] = entry as ContextDraft;
      }
    }
    if (!Object.keys(entries).length) storage.removeItem(storageKey(scope));
    return { entries, available: true };
  } catch { return { entries: {}, available: false }; }
}
export function saveContextDraft(scope: DraftScope, field: LearnerContextKey, entry: ContextDraft): boolean {
  const storage = store();
  if (!storage) return false;
  try {
    const current = readContextDrafts(scope);
    storage.setItem(storageKey(scope), JSON.stringify({ version: 1, entries: { ...current.entries, [field]: entry } }));
    return true;
  } catch { return false; }
}
export function removeContextDraft(scope: DraftScope, field: LearnerContextKey): boolean {
  const storage = store();
  if (!storage) return false;
  try {
    const { entries } = readContextDrafts(scope);
    delete entries[field];
    if (Object.keys(entries).length) storage.setItem(storageKey(scope), JSON.stringify({ version: 1, entries }));
    else storage.removeItem(storageKey(scope));
    return true;
  } catch { return false; }
}
export function clearLearnerDrafts(): void {
  const storage = store();
  if (!storage) return;
  try {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch { /* Storage can become unavailable; never block sign-out. */ }
}
