export type BookingState='upcoming'|'joinable'|'ended'|'cancelled'|'completed'
export type ScheduledBookingContext={id:string;title:string;role:'teacher'|'student';state:BookingState;startsAt:string;endsAt:string;roomId:string|null;hasJoined:boolean}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseScheduledBooking(value:unknown,expectedId:string):ScheduledBookingContext{
 const v=value as ScheduledBookingContext
 if(!v||v.id!==expectedId||!uuid.test(v.id)||typeof v.title!=='string'||!['teacher','student'].includes(v.role)||!['upcoming','joinable','ended','cancelled','completed'].includes(v.state)||!Number.isFinite(Date.parse(v.startsAt))||!Number.isFinite(Date.parse(v.endsAt))||typeof v.hasJoined!=='boolean'||!(v.roomId===null||typeof v.roomId==='string'&&uuid.test(v.roomId)))throw Error('Invalid scheduled lesson response.')
 return v
}
export const scheduledLiveEnabled=process.env.NEXT_PUBLIC_VIBE_SCHEDULED_LIVE_ENABLED==='true'&&process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED==='true'
