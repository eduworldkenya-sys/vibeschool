import type { ReactNode } from "react";
import { StudyCapturePanel } from "@/components/read/StudyCapturePanel";

export default function TextbookReaderLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { publicationId: string };
}) {
  return (
    <>
      {children}
      <StudyCapturePanel publicationId={params.publicationId} />
    </>
  );
}
