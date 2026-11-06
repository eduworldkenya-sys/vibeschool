import PrivateVideoClassroom from '@/components/vibetutor/PrivateVideoClassroom';
export const metadata = { title: 'Private lesson | VibeSchool', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function LessonPage({ params }: { params: { lessonId: string } }) {
  return <PrivateVideoClassroom lessonId={params.lessonId} />;
}
