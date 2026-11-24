import { redirect } from 'next/navigation'

/** Mini Lessons are an open creator product; there is no HQ content-approval screen. */
export default function RetiredMiniReviewPage() {
  redirect('/explore')
}
