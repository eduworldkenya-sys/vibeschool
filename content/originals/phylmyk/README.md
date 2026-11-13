# Phylmyk and the Dantez Files — VibeSchool Originals

## Canon
- Main character: Phylmyk, a 12-year-old Black American girl detective living in Africa.
- Hometown: **Gema**. Localities: **Langa**, **Shabe**, **Tamtam**.
- Places: **Wakibe** (main shop, run by **Wadani**), **Kwa Kariz** (garage), **Bonde** (notorious street), **Sandona** (wealthy kids' hangout).
- Core cast: Phylmyk, her brother Yobra Mninja, Dantez (computer and motorcycle enthusiast), Labonator (cars and football), Mdavido (skater and avid reader), Lucanji (young Mexican-African child), Vanny Boy (introverted genius who uses advanced terminology).
- Spin-off: **The Shadow Riderz**, following Dantez and Labonator, shares the same universe.
- **Wadani** is the shopkeeper. Do not revert to the retired placeholder Mama Waki.

## Book One
- Title: **The Delivery from Tomorrow**
- File: [book-01-the-delivery-from-tomorrow.md](./book-01-the-delivery-from-tomorrow.md)
- Format: Original, standalone 12-section illustrated eBook (11 chapters and an epilogue).
- Genre: Children's mystery/adventure (recommended ages 8–13).
- Status: VibeSchool Originals pilot; intended as a *free* public eBook, not falsely labelled as formally curriculum-certified.
- Reading UI: Existing `/global/read/publication/[id]` chapter reader; no duplicate book engine.
- Cover: `/originals/phylmyk/book-01-cover.svg`
- In-chapter images: `/originals/phylmyk/chapter-wakibe.svg`, `/originals/phylmyk/chapter-kwa-kariz.svg`, `/originals/phylmyk/chapter-shadow-riderz.svg`
- Cover artwork is a lightweight SVG fallback for the live reader. An additional illustrated cover was generated in the authoring conversation and may replace the fallback once it is uploaded to the platform's media storage.

## Publishing
- Keep chapter and paragraph order unchanged.
- Preserve content and ownership provenance. All illustrations and story text in this folder are original for this project.
- Use `vibe_publications` with `format='ebook'`, `genre='children'`, `status='published'`, `pricing={'type':'free'}`, `cbc_aligned=false`, `series_name='Phylmyk and the Dantez Files'`, `series_number=1`.
- Store sections in `vibe_chapters`; use `ContentBlock` paragraph and image blocks. Do not mark chapters as curriculum-verified without review.
- Published books should remain public-read with the existing RLS policies.
- Future upgrades: reading position persistence, accessible read-aloud, and genuine image asset uploads.

## Storyguard
Children do not investigate unsafe places alone, nor use harmful techniques to access digital accounts. Bonde's poor reputation should not be used to stereotype the people living there.
