#!/usr/bin/env node
import fs from "node:fs";

const page = fs.readFileSync("app/teacher/profile/page.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260818152550_teacher_profile_avatar_storage.sql", "utf8");

const checks = [
  ["profile does not delete teacher assignments", !/from\(["']teacher_classes["']\)\s*\.delete\(/s.test(page)],
  ["profile does not insert teacher assignments", !/from\(["']teacher_classes["']\)\s*\.insert\(/s.test(page)],
  ["profile communicates school-owned assignments", page.includes("Managed by your school")],
  ["avatar uses user-scoped folder", page.includes("`${profile.id}/profile.${extension}`")],
  ["avatar client enforces 3 MB", page.includes("3 * 1024 * 1024")],
  ["avatar client restricts MIME types", page.includes('"image/jpeg"') && page.includes('"image/png"') && page.includes('"image/webp"')],
  ["migration creates avatars bucket", migration.includes("'avatars'") && migration.includes("3145728")],
  ["migration scopes inserts to auth folder", migration.includes("(storage.foldername(name))[1] = (select auth.uid())::text")],
  ["unfinished coming-soon profile tabs removed", !page.includes("ComingSoon") && !page.includes("Attendance & Leave") && !page.includes("Finance Reference")],
];

const failures = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failures.length) process.exit(1);
