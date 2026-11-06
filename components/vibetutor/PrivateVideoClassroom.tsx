'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyCall } from '@daily-co/daily-js';
import { getSupabaseClient } from '@/lib/supabase';

type Access = { lesson: { title: string }; role: 'teacher' | 'student'; userId: string; url?: string; token?: string };
const button = { minHeight: 44, padding: '10px 18px', border: 0, borderRadius: 10, background: '#087451', color: '#fff', cursor: 'pointer' };
export default function PrivateVideoClassroom({ lessonId }: { lessonId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const call = useRef<DailyCall | null>(null);
  const mounted = useRef(true);
  const joining = useRef(false);
  const generation = useRef(0);
  const identity = useRef<string | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState('');
  const [signInRequired, setSignInRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState('Checking lesson access…');
  const stop = useCallback(async () => {
    generation.current += 1;
    const current = call.current; call.current = null;
    if (current && !current.isDestroyed()) await current.destroy();
  }, []);
  const check = useCallback(async (join = false): Promise<Access> => {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    if (!session) { if (mounted.current) setSignInRequired(true); throw new Error('Sign in with your tutor or student account to join.'); }
    if (mounted.current) setSignInRequired(false);
    if (identity.current && identity.current !== session.user.id) throw new Error('Your account changed. Reopen this lesson.');
    const response = await fetch('/api/vibetutor/video/' + encodeURIComponent(lessonId), {
      method: join ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + session.access_token }, cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (mounted.current && response.status === 401) setSignInRequired(true);
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not check lesson access.');
    if (!data.lesson || !data.userId || !['teacher', 'student'].includes(data.role)) throw new Error('Could not check lesson access.');
    return data;
  }, [lessonId]);
  useEffect(() => {
    mounted.current = true;
    let checking = false;
    async function refresh() {
      if (checking) return;
      checking = true;
      try {
        const data = await check();
        if (mounted.current) { setAccess(data); identity.current = data.userId; setError(''); setState(previous => call.current ? previous : 'Ready to join'); }
      } catch (e) {
        if (mounted.current) { setAccess(null); setError(e instanceof Error ? e.message : 'Could not check lesson access.'); setState('Lesson unavailable'); }
        await stop();
      } finally { checking = false; }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 20000);
    const { data: listener } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      if (identity.current && session?.user.id !== identity.current) {
        setAccess(null); setError('Your account changed. Reopen this lesson.'); void stop();
      }
    });
    return () => { mounted.current = false; clearInterval(timer); listener.subscription.unsubscribe(); void stop(); };
  }, [check, stop]);
  async function join() {
    if (joining.current || call.current) return;
    joining.current = true; setBusy(true); setError('');
    const attempt = generation.current;
    try {
      const data = await check(true);
      if (!data.url || !data.token) throw new Error('Could not open the classroom.');
      const { default: Daily } = await import('@daily-co/daily-js');
      if (!mounted.current || !host.current || attempt !== generation.current) return;
      const frame = Daily.createFrame(host.current, {
        iframeStyle: { width: '100%', height: 'min(75dvh, 760px)', minHeight: '420px', border: '0', borderRadius: '12px' },
        showLeaveButton: true, showFullscreenButton: true,
      });
      call.current = frame;
      frame.on('joined-meeting', () => { if (mounted.current) setState('In lesson'); });
      frame.on('left-meeting', () => { if (mounted.current) setState('You left the lesson'); void stop(); });
      frame.on('error', () => { if (mounted.current) { setError('Video connection failed. Check your connection and try again.'); setState('Disconnected'); } void stop(); });
      setState('Opening camera and microphone check…');
      // Token stays in memory and is passed to the SDK, never in the page URL.
      await frame.join({ url: data.url, token: data.token });
    } catch (e) {
      await stop();
      if (mounted.current) { setError('Could not join. Check your connection and camera permissions, then try again.'); setState('Not connected'); }
    } finally { joining.current = false; if (mounted.current) setBusy(false); }
  }
  return <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px', minHeight: '100dvh' }}>
    <Link href={access?.role === 'teacher' ? '/teacher/tutoring/students' : '/student/tutoring'}>← My tuition</Link>
    <h1>{access?.lesson.title ?? 'Private lesson'}</h1>
    <p>Only your connected tutor and student can join. Recording is off.</p>
    <p role="status">{state}</p>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {signInRequired && <Link href={'/login?redirect=' + encodeURIComponent('/tuition/lessons/' + lessonId)}>Sign in</Link>}
    {access && <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
      <button type="button" style={button} disabled={busy || state === 'In lesson' || state.startsWith('Opening')} onClick={() => void join()}>{busy ? 'Connecting…' : 'Join lesson'}</button>
      <button type="button" style={{ ...button, background: '#454545' }} onClick={() => { void stop(); setState('You left the lesson'); }}>Leave lesson</button>
    </div>}
    <div ref={host} aria-label="Private video classroom" style={{ width: '100%' }} />
  </main>;
}
