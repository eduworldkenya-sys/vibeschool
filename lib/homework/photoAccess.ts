import { supabase } from "@/lib/supabase";

const BUCKET = "homework-photos";
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\/[0-9a-f-]+\\.(jpe?g|png|webp|heic)$/i;

/**
 * New submissions persist the storage object key, not an expiring signed URL.
 * The Storage RLS policy authorizes each fresh viewing link for the learner/staff.
 */
export async function getHomeworkPhotoViewUrl(reference: string | null | undefined): Promise<string | null> {
  if (!reference) return null;
  if (KEY_PATTERN.test(reference)) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(reference, 5 * 60);
    if (error || !data?.signedUrl) throw new Error("Could not open the homework photo. Please retry.");
    return data.signedUrl;
  }

  // Allow historical VibeSchool signed links only, until existing records migrate.
  // Never render arbitrary URLs from a submission as a clickable destination.
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    const url = new URL(reference);
    if (url.origin !== new URL(base).origin ||
        !url.pathname.startsWith("/storage/v1/object/sign/" + BUCKET + "/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
