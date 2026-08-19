import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function expect(file, pattern, message) {
  const source = read(file);
  if (!pattern.test(source)) failures.push(`${file}: ${message}`);
}

expect("app/teacher/page.tsx", /router\.replace\("\/teacher\/pulse"\)/, "Teacher entry must land on Today/Pulse.");
expect("app/teacher/page.tsx", /PortalLoading/, "Teacher entry must not render a blank redirect state.");
expect("components/teacher/PulseHeader.tsx", /\/teacher\/notifications/, "Today notifications must navigate to a real Teacher surface.");
expect("components/teacher/PulseHeader.tsx", /minHeight:\s*46|minHeight:\s*44|width:\s*44/, "Primary Today controls need phone-sized touch targets.");
expect("components/teacher/PulseHeader.tsx", /sessionStorage\.setItem\(CONTEXT_KEY/, "Class/subject context must persist within the Teacher session.");
expect("components/teacher/PulseHeader.tsx", /aria-label=\"Current class and subject\"/, "Class/subject switcher must be explicitly labelled.");
expect("app/teacher/notifications/page.tsx", /Requires action/, "Notifications must distinguish action-required updates.");
expect("app/teacher/notifications/page.tsx", /role=\"alert\"/, "Notification load failures must be announced accessibly.");
expect("app/teacher/notifications/page.tsx", /Check your connection and try again/, "Network errors must provide a recovery path.");
expect("app/teacher/notifications/page.tsx", /Back to Today/, "Empty notifications state must provide a safe next action.");

if (failures.length) {
  console.error("Teacher UX Task 23 contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Teacher UX Task 23 contract: PASS");
