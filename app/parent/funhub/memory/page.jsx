"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const PURPLE = '#7c3aed';
const PURPLE_DARK = '#6d28d9';
const BG = '#f9fafb';

const SUBJECTS = ['Maths', 'English', 'Kiswahili', 'Science', 'Social Studies', 'General'];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseAnswerText(row) {
  let opts = {};
  try {
    opts = typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || {});
  } catch (e) {
    opts = {};
  }
  const optMap = Array.isArray(opts)
    ? { A: opts[0], B: opts[1], C: opts[2], D: opts[3] }
    : opts;

  const lookupKey = String(row.correct || row.correct_option || '').toUpperCase().trim();
  return optMap[lookupKey] ?? row.correct ?? 'Answer';
}

function LoadingScreen({ text }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #f3e8ff', borderTopColor: PURPLE, animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6b7280', fontWeight: 600, fontSize: 15 }}>{text}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function ErrorScreen({ message, onBack }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <h2 style={{ color: '#374151', fontWeight: 800, margin: 0 }}>Oops!</h2>
      <p style={{ color: '#6b7280', fontSize: 15, maxWidth: 300 }}>{message}</p>
      <button onClick={onBack} style={{ padding: '14px 32px', borderRadius: 16, border: 'none', background: PURPLE, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Back to FunHub</button>
    </div>
  );
}

function LobbyScreen({ onStart }) {
  const [subject, setSubject] = useState('Maths');
  const [grade, setGrade] = useState(4);
  const [pressed, setPressed] = useState(false);

  const chipStyle = (active) => ({
    padding: '8px 14px', borderRadius: 99,
    border: `2px solid ${active ? PURPLE : '#e5e7eb'}`,
    background: active ? '#f5f3ff' : '#fff',
    color: active ? PURPLE : '#374151',
    fontWeight: active ? 700 : 500, fontSize: 14,
    cursor: 'pointer', transition: 'all 0.15s ease',
    transform: active ? 'scale(1.04)' : 'scale(1)',
  });

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAling: 'center', marginBottom: 28, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>🧩</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: PURPLE, margin: 0, letterSpacing: '-0.5px' }}>Memory Match</h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>Pair Questions & Answers</p>
      </div>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '24px 20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(124,58,237,0.06)', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUBJECTS.map(s => <button key={s} onClick={() => setSubject(s)} style={chipStyle(subject === s)}>{s}</button>)}
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
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressed ? 'scale(0.96)' : 'scale(1)', transition: 'all 0.15s ease', boxShadow: '0 4px 16px rgba(124,58,237,0.25)' }}
        >START MATCHING →</button>
      </div>
    </div>
  );
}

function GameScreen({ questions, subject, grade, onFinish }) {
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  const movesRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const deck = [];
    questions.forEach((q) => {
      deck.push({
        id: `q-${q.id}`,
        matchId: q.id,
        text: q.question_text || q.question || 'Question Text',
        type: 'question'
      });
      deck.push({
        id: `a-${q.id}`,
        matchId: q.id,
        text: parseAnswerText(q),
        type: 'answer'
      });
    });
    setCards(shuffle(deck));
    movesRef.current = 0;
    timeRef.current = 0;
  }, [questions]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(t => {
        const nextTime = t + 1;
        timeRef.current = nextTime;
        return nextTime;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function handleCardClick(index) {
    if (isChecking || flipped.includes(index) || matched.has(cards[index].matchId)) return;

    const nextFlipped = [...flipped, index];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      const nextMoves = moves + 1;
      movesRef.current = nextMoves;
      setMoves(nextMoves);

      const [firstIdx, secondIdx] = nextFlipped;
      const c1 = cards[firstIdx];
      const c2 = cards[secondIdx];

      if (c1.matchId === c2.matchId && c1.type !== c2.type) {
        const newMatched = new Set(matched);
        newMatched.add(c1.matchId);
        setMatched(newMatched);
        setFlipped([]);

        if (newMatched.size === questions.length) {
          setTimeout(() => {
            onFinish({ timeTaken: timeRef.current, totalMoves: movesRef.current });
          }, 600);
        }
      } else {
        setIsChecking(true);
        setTimeout(() => {
          setFlipped([]);
          setIsChecking(false);
        }, 800);
      }
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: 16, border: '1px solid #e5e7eb' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Timer</span>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: PURPLE }}>{formatTime(time)}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Matches</span>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1f2937' }}>{matched.size} / {questions.length}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Moves</span>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1f2937' }}>{moves}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '8px 0' }}>
          {cards.map((card, idx) => {
            const isFlipped = flipped.includes(idx);
            const isMatched = matched.has(card.matchId);
            const isOpen = isFlipped || isMatched;

            return (
              <div
                key={card.id}
                onClick={() => handleCardClick(idx)}
                style={{
                  height: 105,
                  background: isMatched ? '#f5f3ff' : isOpen ? '#fff' : `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
                  border: isMatched ? `2px solid ${PURPLE}` : isOpen ? '2px solid #e5e7eb' : '2px solid transparent',
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 8,
                  cursor: 'pointer',
                  userSelect: 'none',
                  boxSizing: 'border-box',
                  transform: isOpen ? 'rotateY(0deg)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                  boxShadow: isOpen ? 'none' : '0 4px 10px rgba(124,58,237,0.15)'
                }}
              >
                {isOpen ? (
                  <p style={{
                    margin: 0,
                    fontSize: card.text.length > 40 ? '11px' : card.text.length > 20 ? '12px' : '13px',
                    fontWeight: 700,
                    color: isMatched ? PURPLE : '#374151',
                    textAlign: 'center',
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>{card.text}</p>
                ) : (
                  <span style={{ fontSize: 24, color: '#fff', fontWeight: 800 }}>❓</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>{subject} · Grade {grade}</span>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ result, subject, grade, onReplay, onBack, xpEarned }) {
  const [pressedR, setPressedR] = useState(false);
  const [pressedB, setPressedB] = useState(false);

  const stars = result.totalMoves <= 12 ? 3 : result.totalMoves <= 18 ? 2 : 1;

  const statBox = (label, value, color = '#1f2937') => (
    <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 10px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>{'⭐'.repeat(stars)}</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 26, fontWeight: 900, color: '#1f2937' }}>Grid Cleared!</h1>
          <p style={{ margin: 0, color: '#6b7280', fontWeight: 500, fontSize: 14 }}>{subject} · Grade {grade}</p>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, borderRadius: 20, padding: '20px 0', textAlign: 'center', boxShadow: '0 6px 24px rgba(124,58,237,0.2)' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#ddd6fe', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time Taken</p>
          <p style={{ margin: '4px 0 0', fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
            {Math.floor(result.timeTaken / 60)}:{result.timeTaken % 60 < 10 ? '0' : ''}{result.timeTaken % 60}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {statBox('Total Moves', result.totalMoves, PURPLE)}
          {statBox('Pairs Found', '6/6', '#2563eb')}
          {statBox('XP Earned', `+${xpEarned}`, '#16a34a')}
        </div>

        <button
          onPointerDown={() => setPressedR(true)} onPointerUp={() => setPressedR(false)} onPointerLeave={() => setPressedR(false)}
          onClick={onReplay}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressedR ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease', boxShadow: '0 4px 16px rgba(124,58,237,0.25)' }}
        >🧩 Play Again</button>
        <button
          onPointerDown={() => setPressedB(true)} onPointerUp={() => setPressedB(false)} onPointerLeave={() => setPressedB(false)}
          onClick={onBack}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: `2px solid ${PURPLE}`, background: '#fff', color: PURPLE, fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: pressedB ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease' }}
        >← Back to FunHub</button>
      </div>
    </div>
  );
}

export default function MemoryMatchGame() {
  const router = useRouter();
  const [screen, setScreen] = useState('lobby');
  const [subject, setSubject] = useState(null);
  const [grade, setGrade] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [gameResult, setGameResult] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);

  async function handleStart(sub, gr) {
    setSubject(sub);
    setGrade(gr);
    setScreen('loading');
    try {
      const { data, error } = await supabase
        .from('funhub_questions')
        .select('*')
        .eq('subject', sub)
        .eq('grade', gr)
        .limit(6);

      if (error) throw error;
      if (!data || data.length < 6) {
        setErrorMsg(`Need at least 6 matrix questions matching ${sub} Grade ${gr} to form pairs. Try another option!`);
        setScreen('error');
        return;
      }
      setQuestions(data);
      setScreen('game');
    } catch {
      setErrorMsg('Could not fetch grid variables. Check database links.');
      setScreen('error');
    }
  }

  async function handleFinish(result) {
    const speedBonus = Math.max(0, 90 - result.timeTaken) * 2;
    const xp = Math.round(100 + speedBonus);
    setXpEarned(xp);
    setGameResult(result);
    setScreen('loading');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', user.id)
          .single();
        if (student) {
          await supabase.from('funhub_sessions').insert({
            student_id: student.id,
            game_slug: 'memory-match',
            subject,
            grade,
            score: xp,
            xp_earned: xp,
            correct: 6,
            total: 6,
            duration_secs: result.timeTaken,
            completed: true,
          });
        }
      }
    } catch { /* Fail silently */ }
    setScreen('result');
  }

  function handleBack() { router.push('/parent/funhub'); }

  if (screen === 'lobby') return <LobbyScreen onStart={handleStart} />;
  if (screen === 'loading') return <LoadingScreen text="Constructing 4x3 puzzle map layout..." />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return <GameScreen questions={questions} subject={subject} grade={grade} onFinish={handleFinish} />;
  if (screen === 'result') return <ResultScreen result={gameResult} subject={subject} grade={grade} xpEarned={xpEarned} onReplay={() => handleStart(subject, grade)} onBack={handleBack} />;
  return null;
}
