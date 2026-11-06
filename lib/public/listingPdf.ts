import { TeacherListing } from "./teacherListings";

const printable = (text: string) => text.normalize("NFKD").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/→/g, " to ").replace(/·/g, " | ").replace(/[^\x20-\x7E\n]/g, "");

export async function createListingPdf(listing: TeacherListing, url: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42, width = doc.internal.pageSize.getWidth() - margin * 2, bottom = doc.internal.pageSize.getHeight() - 45;
  let y = 48;
  const text = (value: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    for (const line of doc.splitTextToSize(printable(value), width) as string[]) {
      if (y + size * 1.4 > bottom) { doc.addPage(); y = 48; }
      doc.text(line, margin, y); y += size * 1.4;
    }
    y += 6;
  };
  doc.setTextColor(23, 107, 78); text("VIBESCHOOL | TEACHER MARKETPLACE", 11, true);
  doc.setTextColor(23, 43, 37); text(listing.kind === "job" ? "School job" : "Teacher swap", 11); text(listing.title, 21, true);
  for (const field of listing.fields) text(`${field.label}: ${field.value}`);
  y += 8; text("Full advert & requirements", 13, true); text(listing.details);
  for (const action of listing.actions) text(`${action.label}: ${action.href}`);
  if (listing.kind === "swap") text("Contact is shared privately through interest requests. A match is not official TSC transfer approval.");
  text("View this listing: " + url, 9);
  doc.setProperties({ title: listing.title, creator: "VibeSchool", subject: listing.kind === "job" ? "School job" : "Teacher swap" });
  return doc;
}
