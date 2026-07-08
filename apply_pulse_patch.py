import pathlib

def patch(path, old, new, expected_count=1):
    p = pathlib.Path(path)
    text = p.read_text()
    count = text.count(old)
    assert count == expected_count, f"{path}: expected {expected_count} match(es), found {count}"
    p.write_text(text.replace(old, new, expected_count))
    print(f"patched {path}")

# ── lib/types.ts ──────────────────────────────────────────────
patch(
    "lib/types.ts",
    '''export interface PulseSnapshot {
  userId: string;
  schoolId: string;''',
    '''export interface AvailableWeek {
  termId: string;
  termNumber: number;
  academicYear: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  weekType: string;
  label: string | null;
}

export interface PulseSnapshot {
  userId: string;
  schoolId: string;
  availableWeeks: AvailableWeek[];
  selectedWeekKey: string;''',
)

# ── lib/pulse/fetcher.ts ──────────────────────────────────────
patch(
    "lib/pulse/fetcher.ts",
    '''export async function fetchPulseData(
  userId: string,
  schoolId: string,
  credits: number | null
): Promise<PulseSnapshot> {
  const today = isoDate(new Date());
  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const tomorrowDow = todayDow === 7 ? 1 : todayDow + 1;
  const weekStart = getWeekStart(new Date());
  const recentSchoolDays = lastSchoolDays(5);

  const [slotsRes, termRes, teacherClassesRes] = await Promise.all([
    supabase
      .from("timetable_slots")
      .select("id,day_of_week,period,start_time,end_time,subject_id,class_id")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId)
      .order("start_time"),
    supabase
      .from("academic_terms")
      .select("id,term,start_date,end_date")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("teacher_classes")
      .select("class_id,subject_id,subjects(name),classes(name,stream)")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId),
  ]);

  const rawSlots = (slotsRes.data ?? []) as TimetableSlotRow[];''',
    '''export interface WeekOverride {
  termId: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
}

interface ActiveWeekRpcRow {
  term_id: string;
  term_number: number;
  academic_year: number;
  week_number: number;
  start_date: string;
  end_date: string;
  week_type: string;
  label: string | null;
}

export async function fetchPulseData(
  userId: string,
  schoolId: string,
  credits: number | null,
  weekOverride?: WeekOverride | null
): Promise<PulseSnapshot> {
  const today = isoDate(new Date());
  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const tomorrowDow = todayDow === 7 ? 1 : todayDow + 1;
  const weekStart = getWeekStart(new Date());
  const recentSchoolDays = lastSchoolDays(5);

  const [slotsRes, termRes, teacherClassesRes, activeWeeksRes] = await Promise.all([
    supabase
      .from("timetable_slots")
      .select("id,day_of_week,period,start_time,end_time,subject_id,class_id")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId)
      .order("start_time"),
    supabase
      .from("academic_terms")
      .select("id,term,start_date,end_date")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("teacher_classes")
      .select("class_id,subject_id,subjects(name),classes(name,stream)")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId),
    supabase.rpc("get_teacher_active_weeks", { p_school_id: schoolId, p_teacher_id: userId }),
  ]);

  const rawSlots = (slotsRes.data ?? []) as TimetableSlotRow[];''',
)

patch(
    "lib/pulse/fetcher.ts",
    '''  const activeTermNum = termRow?.term ?? null;
  const { termProgressPct, weekNumber } = safeTermProgress(termRow);''',
    '''  const activeTermNum = termRow?.term ?? null;
  const { termProgressPct, weekNumber } = safeTermProgress(termRow);

  const availableWeeks: PulseSnapshot["availableWeeks"] = (
    (activeWeeksRes.data ?? []) as ActiveWeekRpcRow[]
  ).map((row) => ({
    termId: row.term_id,
    termNumber: row.term_number,
    academicYear: row.academic_year,
    weekNumber: row.week_number,
    startDate: row.start_date,
    endDate: row.end_date,
    weekType: row.week_type,
    label: row.label,
  }));

  // Always surface the live current week, even with zero activity logged yet.
  if (termRow?.id && weekNumber != null) {
    const alreadyListed = availableWeeks.some(
      (w) => w.termId === termRow.id && w.weekNumber === weekNumber
    );
    if (!alreadyListed) {
      const liveWeekEnd = (() => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 6);
        return isoDate(d);
      })();
      availableWeeks.push({
        termId: termRow.id,
        termNumber: activeTermNum ?? 0,
        academicYear: new Date(termRow.start_date ?? today).getFullYear(),
        weekNumber,
        startDate: weekStart,
        endDate: liveWeekEnd,
        weekType: "normal",
        label: null,
      });
    }
  }

  const selectedWeek: WeekOverride =
    weekOverride ??
    (termRow?.id && weekNumber != null
      ? {
          termId: termRow.id,
          weekNumber,
          startDate: weekStart,
          endDate: (() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + 6);
            return isoDate(d);
          })(),
        }
      : { termId: "", weekNumber: 0, startDate: weekStart, endDate: weekStart });

  const selectedWeekKey = `${selectedWeek.termId}::${selectedWeek.weekNumber}`;''',
)

patch(
    "lib/pulse/fetcher.ts",
    '''  const weekEnd = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return isoDate(d);
  })();

  const [weekAttendanceRes, weekHomeworkRes] = await Promise.all([
    supabase
      .from("attendance")
      .select("timetable_slot_id,date,status")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd),
    supabase
      .from("homework")
      .select("id,created_at")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId)
      .gte("created_at", `${weekStart}T00:00:00`)
      .lte("created_at", `${weekEnd}T23:59:59`),
  ]);''',
    '''  const overviewWeekStart = selectedWeek.startDate;
  const overviewWeekEnd = selectedWeek.endDate;

  const [weekAttendanceRes, weekHomeworkRes] = await Promise.all([
    supabase
      .from("attendance")
      .select("timetable_slot_id,date,status")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId)
      .gte("date", overviewWeekStart)
      .lte("date", overviewWeekEnd),
    supabase
      .from("homework")
      .select("id,created_at")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId)
      .gte("created_at", `${overviewWeekStart}T00:00:00`)
      .lte("created_at", `${overviewWeekEnd}T23:59:59`),
  ]);''',
)

patch(
    "lib/pulse/fetcher.ts",
    '''  return {
    userId,
    schoolId,
    todaySlots,''',
    '''  return {
    userId,
    schoolId,
    availableWeeks,
    selectedWeekKey,
    todaySlots,''',
)

# ── components/teacher/PulseHeader.tsx ────────────────────────
patch(
    "components/teacher/PulseHeader.tsx",
    '''        {snap.myClasses.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ color: "#10b981", flexShrink: 0 }}>👥</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700 }}>Class · Subject</div>
              <select
                value={selectedKey}
                onChange={(event) => onSelectedKeyChange(event.target.value)}
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#1e1b4b",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  maxWidth: 170,
                }}
              >
                {snap.myClasses.map((c) => (
                  <option key={key(c.class_id, c.subject_id)} value={key(c.class_id, c.subject_id)}>
                    {c.class_name} · {c.subject}
                  </option>
                ))}
              </select>
              {!selectedSlot && selectedRoster && (
                <div
                  onClick={() => router.push(`/teacher/classhub/${selectedRoster.class_id}`)}
                  style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, cursor: "pointer", marginTop: 1 }}
                >
                  No lesson today · View class →
                </div>
              )}
            </div>
          </div>
        ) : (
          <SelectorItem
            icon={<span style={{ color: "#10b981" }}>👥</span>}
            label="Class"
            value="No classes assigned"
            actionLabel="Add your class →"
            onAction={() => router.push("/teacher/onboarding/class")}
          />
        )}
        <SelectorItem
          icon={<span>📅</span>}
          label="Week"
          value={snap.weekNumber != null ? `Week ${snap.weekNumber}` : "No active term"}
        />''',
    '''        {snap.myClasses.length > 0 ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ color: "#10b981", flexShrink: 0 }}>👥</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700 }}>Class</div>
                <select
                  value={activeClassId}
                  onChange={(event) => {
                    const newClassId = event.target.value;
                    const firstSubject = snap.myClasses.find((c) => c.class_id === newClassId);
                    if (firstSubject) onSelectedKeyChange(key(newClassId, firstSubject.subject_id));
                  }}
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#1e1b4b",
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    maxWidth: 110,
                  }}
                >
                  {Array.from(new Map(snap.myClasses.map((c) => [c.class_id, c])).values()).map((c) => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.class_name}
                    </option>
                  ))}
                </select>
                {!selectedSlot && selectedRoster && (
                  <div
                    onClick={() => router.push(`/teacher/classhub/${selectedRoster.class_id}`)}
                    style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700, cursor: "pointer", marginTop: 1 }}
                  >
                    No lesson today →
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ color: "#8b5cf6", flexShrink: 0 }}>📘</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700 }}>Subject</div>
                <select
                  value={activeSubjectId}
                  onChange={(event) => onSelectedKeyChange(key(activeClassId, event.target.value))}
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#1e1b4b",
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    maxWidth: 110,
                  }}
                >
                  {snap.myClasses
                    .filter((c) => c.class_id === activeClassId)
                    .map((c) => (
                      <option key={c.subject_id} value={c.subject_id}>
                        {c.subject}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <SelectorItem
            icon={<span style={{ color: "#10b981" }}>👥</span>}
            label="Class"
            value="No classes assigned"
            actionLabel="Add your class →"
            onAction={() => router.push("/teacher/onboarding/class")}
          />
        )}
        {snap.availableWeeks.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ flexShrink: 0 }}>📅</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700 }}>Week</div>
              <select
                value={selectedWeekKey ?? snap.selectedWeekKey}
                onChange={(event) => onSelectedWeekKeyChange?.(event.target.value)}
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#1e1b4b",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  maxWidth: 130,
                }}
              >
                {snap.availableWeeks.map((w) => (
                  <option key={`${w.termId}::${w.weekNumber}`} value={`${w.termId}::${w.weekNumber}`}>
                    Term {w.termNumber} · Week {w.weekNumber}
                    {w.weekType !== "normal" ? ` (${w.weekType.replace("_", " ")})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <SelectorItem icon={<span>📅</span>} label="Week" value="No active term" />
        )}''',
)

patch(
    "components/teacher/PulseHeader.tsx",
    '''  selectedKey,
  onSelectedKeyChange,
  onOpenNotifications,
  schools = [],
  activeSchoolId,
  onSchoolChange,
}: {
  snap: PulseSnapshot;
  name: string;
  avatarUrl?: string;
  selectedKey: string;
  onSelectedKeyChange: (key: string) => void;
  onOpenNotifications?: () => void;
  schools?: { id: string; name: string }[];
  activeSchoolId?: string | null;
  onSchoolChange?: (id: string) => void;
}) {''',
    '''  selectedKey,
  onSelectedKeyChange,
  onOpenNotifications,
  schools = [],
  activeSchoolId,
  onSchoolChange,
  selectedWeekKey,
  onSelectedWeekKeyChange,
}: {
  snap: PulseSnapshot;
  name: string;
  avatarUrl?: string;
  selectedKey: string;
  onSelectedKeyChange: (key: string) => void;
  onOpenNotifications?: () => void;
  schools?: { id: string; name: string }[];
  activeSchoolId?: string | null;
  onSchoolChange?: (id: string) => void;
  selectedWeekKey?: string;
  onSelectedWeekKeyChange?: (key: string) => void;
}) {''',
)

# ── app/teacher/pulse/page.tsx ─────────────────────────────────
patch(
    "app/teacher/pulse/page.tsx",
    '''import { fetchPulseData } from "@/lib/pulse/fetcher";''',
    '''import { fetchPulseData, type WeekOverride } from "@/lib/pulse/fetcher";''',
)

patch(
    "app/teacher/pulse/page.tsx",
    '''  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);

  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const activeSchoolIdRef = useRef<string | null>(null);''',
    '''  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [selectedWeekKey, setSelectedWeekKey] = useState("");

  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const activeSchoolIdRef = useRef<string | null>(null);
  const weekOverrideRef = useRef<WeekOverride | null>(null);''',
)

patch(
    "app/teacher/pulse/page.tsx",
    '''      const fresh = await fetchPulseData(user.id, schoolId, null);''',
    '''      const fresh = await fetchPulseData(user.id, schoolId, null, weekOverrideRef.current);''',
)

patch(
    "app/teacher/pulse/page.tsx",
    '''      setSnap(fresh);
      setUsingCachedSnap(false);
      writeSnapCache(fresh);
      await resolveGuide(fresh, signal);''',
    '''      setSnap(fresh);
      setSelectedWeekKey(fresh.selectedWeekKey);
      setUsingCachedSnap(false);
      writeSnapCache(fresh);
      await resolveGuide(fresh, signal);''',
)

patch(
    "app/teacher/pulse/page.tsx",
    '''  const handleSchoolChange = useCallback(
    (id: string) => {
      activeSchoolIdRef.current = id;
      setActiveSchoolId(id);
      setSelectedKey("");
      boot(true);
    },
    [boot]
  );''',
    '''  const handleSchoolChange = useCallback(
    (id: string) => {
      activeSchoolIdRef.current = id;
      setActiveSchoolId(id);
      setSelectedKey("");
      weekOverrideRef.current = null;
      boot(true);
    },
    [boot]
  );

  const handleWeekChange = useCallback(
    (weekKey: string) => {
      const [termId, weekNumberStr] = weekKey.split("::");
      const match = snap?.availableWeeks.find(
        (w) => w.termId === termId && String(w.weekNumber) === weekNumberStr
      );

      if (!match) return;

      weekOverrideRef.current = {
        termId: match.termId,
        weekNumber: match.weekNumber,
        startDate: match.startDate,
        endDate: match.endDate,
      };
      setSelectedWeekKey(weekKey);
      boot(true);
    },
    [boot, snap]
  );''',
)

patch(
    "app/teacher/pulse/page.tsx",
    '''              schools={schools}
              activeSchoolId={activeSchoolId ?? snap.schoolId}
              onSchoolChange={handleSchoolChange}
            />''',
    '''              schools={schools}
              activeSchoolId={activeSchoolId ?? snap.schoolId}
              onSchoolChange={handleSchoolChange}
              selectedWeekKey={selectedWeekKey || snap.selectedWeekKey}
              onSelectedWeekKeyChange={handleWeekChange}
            />''',
)

print("\\nAll patches applied. Now run: npx tsc --noEmit")
