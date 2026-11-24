// Merge/deploy the compatible foundation without activating a new public format.
export function miniSlidesEnabled():boolean {
 return process.env.NEXT_PUBLIC_MINI_LESSON_SLIDES_ENABLED==='true'
}
export function miniSlideColumns(enabled=miniSlidesEnabled()):string {
 return enabled?',slide_deck':''
}
