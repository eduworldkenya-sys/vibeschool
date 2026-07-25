import type { VibeLearnContentDestinationInput } from "@/lib/types";

export function getContentDestination(
  content: VibeLearnContentDestinationInput
): string | null {
  if (content.type === "textbook") {
    return content.vibePublicationId
      ? `/read/textbook/${content.vibePublicationId}`
      : null;
  }

  return content.url;
}
