import type { ReactNode } from "react";

// The learner identity must lead the profile. School-life tools live inside
// the Overview section instead of injecting a banner above the learner name.
export default function LearnerProfileLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
