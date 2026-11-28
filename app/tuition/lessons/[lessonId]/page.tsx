import PrivateVideoClassroom from '@/components/vibetutor/PrivateVideoClassroom';
import ScheduledLiveClassroom from '@/components/vibetutor/ScheduledLiveClassroom';
import {scheduledLiveEnabled} from '@/components/live-classroom/ScheduledBookingContext';
export const metadata = { title: 'Private lesson | VibeSchool', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function LessonPage(props: { params: Promise<{ lessonId: string }> }) {
  const params = await props.params;
  return scheduledLiveEnabled?<ScheduledLiveClassroom lessonId={params.lessonId}/>:<PrivateVideoClassroom lessonId={params.lessonId} />;
}
