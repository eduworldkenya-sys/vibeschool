import PrivateVideoClassroom from '@/components/vibetutor/PrivateVideoClassroom';
export const metadata = { title: 'Private lesson | VibeSchool', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function LessonPage(props: { params: Promise<{ lessonId: string }> }) {
  const params = await props.params;
  return <PrivateVideoClassroom lessonId={params.lessonId} />;
}
