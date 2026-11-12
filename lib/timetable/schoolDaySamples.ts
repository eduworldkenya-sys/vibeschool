/**
 * OPTIONAL school-day samples. These are editable planning examples, never
 * curriculum authority, seeded database records or active school defaults.
 * KICD allocation counts are checked independently by the timetable engine.
 */
export type SampleBlock = {
  schedule_day: number; label: string; start_time: string; end_time: string;
  kind: string; protected: boolean;
};
export type SchoolDaySample = {
  id: string; name: string; description: string; notes: string; blocks: SampleBlock[];
};
type Row = [string, string, string, string];
const everyday = (rows: Row[]): SampleBlock[] => rows.map(([label, start_time, end_time, kind]) => ({
  schedule_day: 0, label, start_time, end_time, kind, protected: kind !== 'lesson',
}));
const ministerial = everyday([
  ['Assembly', '08:00', '08:20', 'assembly'],
  ['Period 1', '08:20', '08:55', 'lesson'],
  ['Period 2', '08:55', '09:30', 'lesson'],
  ['Morning break', '09:30', '09:50', 'break'],
  ['Period 3', '09:50', '10:25', 'lesson'],
  ['Period 4', '10:25', '11:00', 'lesson'],
  ['Second break', '11:00', '11:30', 'break'],
  ['Period 5', '11:30', '12:05', 'lesson'],
  ['Period 6', '12:05', '12:40', 'lesson'],
  ['Lunch', '12:40', '14:00', 'lunch'],
  ['Period 7', '14:00', '14:35', 'lesson'],
  ['Non-formal activities', '14:35', '16:00', 'games'],
]);
const lowerPrimary = everyday([
  ['Assembly', '08:00', '08:20', 'assembly'],
  ['Period 1', '08:20', '08:50', 'lesson'],
  ['Period 2', '08:50', '09:20', 'lesson'],
  ['Morning break', '09:20', '09:50', 'break'],
  ['Period 3', '09:50', '10:20', 'lesson'],
  ['Period 4', '10:20', '10:50', 'lesson'],
  ['Break', '10:50', '11:10', 'break'],
  ['Period 5', '11:10', '11:40', 'lesson'],
  ['Period 6', '11:40', '12:10', 'lesson'],
  ['Lunch', '12:10', '13:00', 'lunch'],
  ['Period 7', '13:00', '13:30', 'lesson'],
]);
const junior = everyday([
  ['Period 1', '08:00', '08:40', 'lesson'],
  ['Period 2', '08:40', '09:20', 'lesson'],
  ['Morning break', '09:20', '09:40', 'break'],
  ['Period 3', '09:40', '10:20', 'lesson'],
  ['Period 4', '10:20', '11:00', 'lesson'],
  ['Period 5', '11:00', '11:40', 'lesson'],
  ['Second break', '11:40', '12:00', 'break'],
  ['Period 6', '12:00', '12:40', 'lesson'],
  ['Period 7', '12:40', '13:20', 'lesson'],
  ['Lunch', '13:20', '14:00', 'lunch'],
  ['Period 8', '14:00', '14:40', 'lesson'],
  ['Period 9', '14:40', '15:20', 'lesson'],
]);
const tuition: SampleBlock[] = [2, 4, 6].flatMap(day => {
  const morning = day === 6;
  const rows = morning
    ? [['Session 1','09:00','09:40'],['Session 2','09:40','10:20']]
    : [['Session 1','17:00','17:40'],['Session 2','17:40','18:20']];
  return rows.map(([label,start_time,end_time]) => ({
    schedule_day: day, label, start_time, end_time, kind: 'lesson', protected: false,
  }));
});
export const SCHOOL_DAY_SAMPLES: readonly SchoolDaySample[] = [
  {
    id: 'kenyan-upper-primary', name: 'Kenya Ministry-style · Grades 4–6',
    description: 'Seven 35-minute lesson periods with assembly, breaks, lunch and activities.',
    notes: 'Adapted from a published Ministry sample. It is not proof of your school bell times.',
    blocks: ministerial,
  },
  {
    id: 'lower-primary', name: 'Lower Primary · Grades 1–3',
    description: 'Seven possible 30-minute teaching slots per day, with longer breaks.',
    notes: 'Illustrative timing only, not an official lesson-duration claim. The required 31 weekly periods are validated separately.',
    blocks: lowerPrimary,
  },
  {
    id: 'junior-school', name: 'Junior School · Grades 7–9',
    description: 'Nine possible 40-minute teaching slots per day, plus breaks and lunch.',
    notes: 'Illustrative start times and spare capacity. KICD weekly obligations are validated separately.',
    blocks: junior,
  },
  {
    id: 'flexible-tuition', name: 'Flexible / Tuition',
    description: 'Two evening sessions on Tuesday and Thursday, and Saturday morning sessions.',
    notes: 'An optional clock-time planning example; does not create tuition enrolments or change school/tuition identity.',
    blocks: tuition,
  },
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const KINDS = new Set(['lesson','break','lunch','assembly','games','club','prep',
  'staff_meeting','guidance','examination','school_event','free','custom']);
export function isSampleBlock(value: unknown): value is SampleBlock {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<SampleBlock>;
  return Number.isInteger(b.schedule_day) && Number(b.schedule_day) >= 0 && Number(b.schedule_day) <= 7
    && typeof b.label === 'string' && b.label.trim().length > 0 && b.label.length <= 120
    && typeof b.start_time === 'string' && TIME.test(b.start_time)
    && typeof b.end_time === 'string' && TIME.test(b.end_time)
    && b.start_time < b.end_time
    && typeof b.kind === 'string' && KINDS.has(b.kind)
    && typeof b.protected === 'boolean'
    && (b.kind === 'lesson' || b.protected);
}
export function sampleBlockErrors(blocks: readonly unknown[]): string[] {
  if (blocks.length === 0) return ['Add at least one school-day block.'];
  if (blocks.length > 100) return ['A template can contain at most 100 blocks.'];
  const errors: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (!isSampleBlock(blocks[i])) errors.push('Block ' + (i + 1) + ' needs a label, valid times and a permitted activity type.');
  }
  const valid = blocks.filter(isSampleBlock);
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i], b = valid[j];
      const sameDay = a.schedule_day === 0 || b.schedule_day === 0 || a.schedule_day === b.schedule_day;
      if (sameDay && a.start_time < b.end_time && b.start_time < a.end_time) {
        errors.push('Blocks ' + (i + 1) + ' and ' + (j + 1) + ' overlap.');
      }
    }
  }
  return errors;
}
