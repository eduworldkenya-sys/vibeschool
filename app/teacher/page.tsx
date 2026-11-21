import type { Metadata } from "next";
import TeacherMarketplacePage from "./marketplace/page";

export const metadata: Metadata = {
  title: "For Teachers | VibeSchool",
  description: "Explore teaching jobs, online tuition and station swaps, or recruit teachers through VibeSchool.",
  alternates: { canonical: "/teacher/marketplace" },
};

// Keep the existing /teacher public entry, but render the canonical marketplace.
// Teacher OS remains available through the existing /teacher/pulse route.
export default function TeacherGateway() {
  return <TeacherMarketplacePage />;
}
