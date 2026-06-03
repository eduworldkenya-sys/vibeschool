"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const TEAL = '#0891b2';
const TEAL_DARK = '#0e7490';
const GREEN = '#16a34a';
const BG = '#f9fafb';

const SUBJECTS = ['maths', 'english', 'kiswahili', 'science', 'social_studies', 'general'];
const SUBJECT_LABELS: Record<string, string> = {
  maths: 'Maths', english: 'English', kiswahili: 'Kiswahili',
  science: 'Science', social_studies: 'Social Studies', general: 'General',
};
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function shuffle(arr: any[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalise(row: any) {
  let opts: any = {};
  try {
    opts = typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || {});
  } catch { opts = {}; }
  const optMap = Array.isArray(opts)
    ? { A: opts[0], B: opts[1], C: opts[2], D: opts[3] }
    : opts;
  const lookupKey = String(row.correct || '').toUpperCase().trim();
  const answerText = optMap[lookupKey] ?? row.correct ?? '';
  return {
    id: row.id,
    front: row.question_text || 'Missing Question',
    back: row.explanation?.trim() ? row.explanation : answerText,
  };
}

function LoadingScreen({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #cffafe', borderTopColor: TEAL, animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6b7280', fontWeight: 600, fontSize: 15 }}>{text}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function ErrorScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <h2 style={{ color: '#374151', fontWeight: 800, margin: 0 }}>Oops!</h2>
      <p style={{ color: '#6b7280', fontSize: 15, maxWidth: 300 }}>{message}</p>
      <button onClick={onBack} style={{ padding: '14px 32px', borderRadius: 16, border: 'none', background: TEAL, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Back to FunHub</button>
    </div>
  );
}

function LobbyScreen({ onStart }: { onStart: (subject: string, grade: number) => void }) {
  const [subject, setSubject] = useState('maths');
  const [grade, setGrade] = useState(4);
  const [pressed, setPressed] = useState(false);

  const chipStyle = (active: boolean) => ({
    padding: '8px 14px', borderRadius: 99,
    border: `2px solid ${active ? TEAL : '#e5e7eb'}`,
    background: active ? '#ecfeff' : '#fff',
    color: active ? TEAL : '#374151',
    fontWeight: active ? 700 : 500, fontSize: 14,
    cursor: 'pointer', transition: 'all 0.15s',
    transform: active ? 'scale(1.04)' : 'scale(1)',
    fontFamily: 'inherit',
  });

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>🃏</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: TEAL, margin: 0 }}>Flashcards</h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>Flip · Learn · Master</p>
      </div>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '24px 20px', boxShadow: '0 4px 24px rgba(8,145,178,0.10)', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => setSubject(s)} style={chipStyle(subject === s)}>
                {SUBJECT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grade</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GRADES.map(g => <button key={g} onClick={() => setGrade(g)} style={chipStyle(grade === g)}>Grade {g}</button>)}
          </div>
        </div>
        <button
          onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
          onClick={() => onStart(subject, grade)}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer', transform: pressed ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.12s', boxShadow: '0 4px 16px rgba(8,145,178,0.35)', fontFamily: 'inherit' }}
        >START FLASHCARDS →</button>
      </div>
    </div>
  );
}

function FlipCard({ card, onGotIt, onStillLearning }: { card: any; onGotIt: () => void; onStillLearning: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const [pressing, setPressing] = useState(false);
  useEffect(() => { setFlipped(false); }, [card.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
      <style>{`
        .card-scene { width:100%; max-width:360px; height:220px; perspective:1000px; cursor:pointer; }
        .card-inner { width:100%; height:100%; position:relative; transform-style:preserve-3d; transition:transform 0.4s cubic-bezier(0.25,0.8,0.25,1); }
        .card-inner.flipped { transform:rotateY(180deg); }
        .card-face { position:absolute; width:100%; height:100%; backface-visibility:hidden; -webkit-backface-visibility:hidden; border-radius:20px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; }
        .card-front { background:#fff; border:2px solid #e0f2fe; box-shadow:0 8px 32px rgba(8,145,178,0.12); }
        .card-back { background:linear-gradient(135deg,#0891b2,#0e7490); transform:rotateY(180deg); box-shadow:0 8px 32px rgba(8,145,178,0.25); }
      `}</style>
      <div className="card-scene" onPointerDown={() => setPressing(true)} onPointerUp={() => { setPressing(false); setFlipped(f => !f); }} onPointerLeave={() => setPressing(false)} style={{ transform: pressing ? 'scale(0.97)' : 'scale(1)', transition: 'transform 0.12s' }}>
        <div className={`card-inner${flipped ? ' flipped' : ''}`}>
          <div className="card-face card-front">
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Question</p>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1f2937', textAlign: 'center', lineHeight: 1.45, margin: 0 }}>{card.front}</p>
            <p style={{ fontSize: 12, color: '#cbd5e1', margin: '16px 0 0', fontWeight: 500 }}>Tap to reveal answer</p>
          </div>
          <div className="card-face card-back">
            <p style={{ fontSize: 11, fontWeight: 700, color: '#a5f3fc', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Answer</p>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.45, margin: 0 }}>{card.back}</p>
          </div>
        </div>
      </div>
      {flipped ? (
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 360 }}>
          <button onClick={onStillLearning} style={{ flex: 1, padding: '14px 0', borderRadius: 16, border: '2px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>❌ Still learning</button>
          <button onClick={onGotIt} style={{ flex: 1, padding: '14px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${GREEN}, #15803d)`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✅ Got it!</button>
        </div>
      ) : <div style={{ height: 52 }} />}
    </div>
  );
}

function GameScreen({ cards, subject, grade, onFinish }: { cards: any[]; subject: string; grade: number; onFinish: (r: any) => void }) {
  const [deck, setDeck] = useState(() => shuffle(cards));
  const [gotItIds, setGotItIds] = useState<Set<string>>(new Set());
  const [deckIdx, setDeckIdx] = useState(0);
  const [rounds, setRounds] = useState(1);
  const totalCards = cards.length;
  const currentCard = deck[deckIdx];
  const gotItCount = gotItIds.size;
  const progressPct = Math.round((gotItCount / totalCards) * 100);

  function handleGotIt() {
    const newGotIt = new Set(gotItIds);
    newGotIt.add(currentCard.id);
    setGotItIds(newGotIt);
    if (newGotIt.size >= totalCards) { onFinish({ gotItCount: newGotIt.size, totalCards, rounds }); return; }
    advanceDeck(newGotIt, deckIdx);
  }

  function handleStillLearning() { advanceDeck(gotItIds, deckIdx); }

  function advanceDeck(currentGotIt: Set<string>, currentIdx: number) {
    const remaining = deck.filter(c => !currentGotIt.has(c.id));
    if (remaining.length === 0) { onFinish({ gotItCount: currentGotIt.size, totalCards, rounds }); return; }
    const nextIdx = currentIdx + 1;
    if (nextIdx >= deck.length) { setDeck(shuffle(remaining)); setDeckIdx(0); setRounds(r => r + 1); return; }
    let ni = nextIdx;
    while (ni < deck.length && currentGotIt.has(deck[ni]?.id)) ni++;
    if (ni >= deck.length) { setDeck(shuffle(remaining)); setDeckIdx(0); setRounds(r => r + 1); }
    else setDeckIdx(ni);
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: TEAL, fontSize: 15 }}>🃏 Flashcards</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>{gotItCount} / {totalCards} mastered</span>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Progress</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEAL }}>{progressPct}%</span>
          </div>
          <div style={{ width: '100%', height: 6, background: '#e0f2fe', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: TEAL, borderRadius: 99, transition: 'width 0.4s ease' }} />
          </div>
        </div>
        {rounds > 1 && (
          <div style={{ background: '#ecfeff', borderRadius: 12, padding: '8px 14px', border: `1px solid ${TEAL}`, textAlign: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: TEAL }}>Round {rounds} — reviewing {deck.filter(c => !gotItIds.has(c.id)).length} cards</span>
          </div>
        )}
        {currentCard && <FlipCard card={currentCard} onGotIt={handleGotIt} onStillLearning={handleStillLearning} />}
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>{SUBJECT_LABELS[subject]} · Grade {grade}</span>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ result, subject, grade, onReplay, onBack, xpEarned }: any) {
  const { gotItCount, totalCards, rounds } = result;
  const accuracy = Math.round((gotItCount / totalCards) * 100);

  const statBox = (label: string, value: any, color = '#1f2937') => (
    <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 10px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52 }}>🃏</div>
          <h1 style={{ margin: '12px 0 4px', fontSize: 26, fontWeight: 900, color: '#1f2937' }}>
            {accuracy === 100 ? 'All Mastered! 🎉' : accuracy >= 70 ? 'Great session! 👍' : 'Keep practising! 💪'}
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontWeight: 500, fontSize: 14 }}>{SUBJECT_LABELS[subject]} · Grade {grade}</p>
        </div>
        <div style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, borderRadius: 20, padding: '20px 0', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#a5f3fc', fontWeight: 600, textTransform: 'uppercase' }}>Cards Mastered</p>
          <p style={{ margin: '4px 0 0', fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{gotItCount}/{totalCards}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {statBox('Accuracy', `${accuracy}%`, TEAL)}
          {statBox('Rounds', rounds, '#7c3aed')}
          {statBox('XP Earned', `+${xpEarned}`, GREEN)}
        </div>
        <button onClick={onReplay} style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>🃏 Play Again</button>
        <button onClick={onBack} style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: `2px solid ${TEAL}`, background: '#fff', color: TEAL, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to FunHub</button>
      </div>
    </div>
  );
}

export default function FlashcardsPage() {
  const router = useRouter();
  const [screen, setScreen] = useState('lobby');
  const [subject, setSubject] = useState<string | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [gameResult, setGameResult] = useState<any>(null);
  const [xpEarned, setXpEarned] = useState(0);

  async function handleStart(sub: string, gr: number) {
    setSubject(sub); setGrade(gr); setScreen('loading');
    try {
      const { data, error } = await supabase
        .from('funhub_questions')
        .select('*')
        .eq('subject', sub)
        .eq('grade', gr);
      if (error) throw error;
      if (!data || data.length === 0) {
        setErrorMsg(`No cards found for ${SUBJECT_LABELS[sub]} Grade ${gr}. Try a different subject or grade!`);
        setScreen('error'); return;
      }
      setCards(data.map(normalise));
      setScreen('game');
    } catch {
      setErrorMsg("Could not load flashcards. Check your connection and try again.");
      setScreen('error');
    }
  }

  async function handleFinish(result: any) {
    const xp = Math.round(result.gotItCount * 10 + (result.gotItCount === result.totalCards ? 50 : 0));
    setXpEarned(xp); setGameResult(result); setScreen('result');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: student } = await supabase.from('students').select('id').eq('profile_id', user.id).single();
        if (student) {
          await supabase.from('funhub_sessions').insert({
            student_id: student.id, game_slug: 'flashcards',
            subject, grade, score: result.gotItCount, xp_earned: xp,
            correct: result.gotItCount, total: result.totalCards, completed: true,
          });
        }
      }
    } catch { /* silent */ }
  }

  function handleReplay() { setCards([]); setGameResult(null); setXpEarned(0); handleStart(subject!, grade!); }
  function handleBack() { router.push('/parent/funhub'); }

  if (screen === 'lobby') return <LobbyScreen onStart={handleStart} />;
  if (screen === 'loading') return <LoadingScreen text="Loading flashcards…" />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return <GameScreen cards={cards} subject={subject!} grade={grade!} onFinish={handleFinish} />;
  if (screen === 'result') return <ResultScreen result={gameResult} subject={subject} grade={grade} xpEarned={xpEarned} onReplay={handleReplay} onBack={handleBack} />;
  return null;
}
