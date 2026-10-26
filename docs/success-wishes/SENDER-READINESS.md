# Sender readiness: frontend scope

The sender retains its four designs, public school search, shared sender/recipient BookCard and signature sound.

- Text details and chosen design recover after refresh/navigation in the same tab. Session storage uses a versioned 24-hour draft; clearing needs confirmation. Invalid/expired drafts are ignored. Storage failure shows an honest recovery warning. No phone, payment token, media file or paid status is persisted by this feature.
- SVG previews preserve all wrapped lines. Allowed long names, school labels, long words, emoji and wishes that need more than five lines are not silently truncated. Font size and line spacing fit the card; the opened book supports scrolling through long details.
- Candidate, sender, message and exam year have field-specific validation. School remains optional and does not determine recipient identity.
- Unavailable voice/video delivery is explicitly labelled Preview only, with no purchasable price shown while disabled. Recording/file previews remain available.

## Checkout ownership

CheckoutPreview, payment initiation, provider callbacks, payment recording, access authorization, configuration flags and schemas are unchanged. Payment integration is owned by the separate checkout workstream. Preserve this sender state and shared renderer when integrating its final contract. These frontend changes do not prove or activate real paid delivery.

## Verification

The browser regression covers restore/clear/cancel-clear, all four designs, allowed long text, invalid/corrected exam year, horizontal bounds at four widths and the existing synthetic sender/recipient flow. Unit tests reject corrupt/expired drafts and unapproved properties, preserve line breaks and emoji, and catch the old five-line truncation with a negative control. Build and exact-head CI are required before merge. Production availability is verified separately from paid-delivery readiness.
