"use client";
import { Suspense } from "react";
import ClassWorkbook from "@/components/teacher/workbook/ClassWorkbook";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Opening your class workbook…</p>}>
      <ClassWorkbook />
    </Suspense>
  );
}
