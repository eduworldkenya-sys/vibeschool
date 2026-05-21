'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const PURPLE = '#7c3aed';
const PURPLE_DARK = '#6d28d9';
const BG = '#f5f3ff';

const SUBJECTS = ['Maths', 'English', 'Science', 'Social Studies', 'General'];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCorrectWord(row) {
  if (!row) return '';
  let opts = {};
  try {
    opts = typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || {});
  } catch { 
    opts = {}; 
  }
  const optMap = Array.isArray(opts)
    ? { A: opts[0], B: opts[1], C: opts[2], D: opts[3] }
    : opts;
  const key = String(row.correct || row.correct_option || '').toUpperCase().trim();
  return (optMap[key] ?? row.correct ?? '').trim();
}

function LoadingScreen({ text }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #ddd6fe', borderTopColor: PURPLE, animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: PURPLE_DARK, fontWeight: 600, fontSize: 15 }}>{text}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function ErrorScreen({ message, onBack }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>🧩</div>
      <h2 style={{ color: PURPLE_DARK, fontWeight: 800, margin: 0 }}>Uh Oh!</h2>
      <p style={{ color: '#4c1d95', fontSize: 15, maxWidth: 300 }}>{message}</p>
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
    background: active ? '#ede9fe' : '#fff',
    color: active ? PURPLE_DARK : '#374151',
    fontWeight: active ? 700 : 500, fontSize: 14,
    cursor: 'pointer', transition: 'all 0.15s ease',
    transform: active ? 'scale(1.04)' : 'scale(1)',
  });

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>🧠</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: PURPLE_DARK, margin: 0, letterSpacing: '-0.5px' }}>Match Mania</h1>
        <p style={{ color: '#4c1d95', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>Flip, Match, and Test Your Memory Matrix</p>
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
        >PLAY MATCH MANIA →</button>
      </div>
    </div>
  );
}

function GameScreen({ cards, rawQuestionsCount, subject, grade, onFinish }) {
  const [grid, setGrid] = useState([]);
  const [selected, setSelected] = useState([]);
  const [matched, setMatched] = useState([]);
  const [time, setTime] = useState(0);
  const [turns, setTurns] = useState(0);

  const timeRef = useRef(0);
  const turnsRef = useRef(0);
  const isLockedRef = useRef(false);

  useEffect(() => {
    setGrid(shuffle(cards));
  }, [cards]);

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

  function handleCardClick(index) {
    if (isLockedRef.current || selected.includes(index) || matched.includes(grid[index].id)) return;

    const nextSelected = [...selected, index];
    setSelected(nextSelected);

    if (nextSelected.length === 2) {
      turnsRef.current += 1;
      setTurns(turnsRef.current);
      
      const firstCard = grid[nextSelected[0]];
      const secondCard = grid[nextSelected[1]];

      if (firstCard.id === secondCard.id && firstCard.type !== secondCard.type) {
        setMatched(prev => {
          const updated = [...prev, firstCard.id];
          if (updated.length === rawQuestionsCount) {
            setTimeout(() => {
              onFinish({ timeTaken: timeRef.current, turnsCount: turnsRef.current, totalPairs: rawQuestionsCount });
            }, 800);
          }
          return updated;
        });
        setSelected([]);
      } else {
        isLockedRef.current = true;
        setTimeout(() => {
          setSelected([]);
          isLockedRef.current = false;
        }, 1000);
      }
    }
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', padding: '12px 16px', borderRadius: 16, border: '1px solid #ddd6fe' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Time</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: PURPLE_DARK }}>{formatTime(time)}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Turns</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1f2937' }}>{turns}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Matches</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{matched.length} / {rawQuestionsCount}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 6 }}>
          {grid.map((card, idx) => {
            const isFlipped = selected.includes(idx) || matched.includes(card.id);
            
            return (
              <button
                key={idx}
                onClick={() => handleCardClick(idx)}
                style={{
                  aspectRatio: '3 / 2',
                  background: isFlipped ? '#fff' : `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
                  border: isFlipped ? '2px solid #ddd6fe' : 'none',
                  borderRadius: 16,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isFlipped ? 13 : 24,
                  fontWeight: isFlipped ? 700 : 800,
                  color: isFlipped ? '#374151' : '#fff',
                  cursor: isFlipped ? 'default' : 'pointer',
                  boxShadow: isFlipped ? 'none' : '0 4px 12px rgba(124,58,237,0.15)',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  lineHeight: 1.3
                }}
              >
                {isFlipped ? card.text : '❓'}
              </button>
            );
          })}
        </div>

        <div style={{ textHeading: 'center', marginTop: 12, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: PURPLE_DARK, fontWeight: 600 }}>{subject} · Grade {grade}</span>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ result, subject, grade, onReplay, onBack, xpEarned }) {
  const [pressedR, setPressedR] = useState(false);
  const [pressedB, setPressedB] = useState(false);

  const efficiency = result.totalPairs / result.turnsCount;
  const stars = efficiency >= 0.7 ? 3 : efficiency >= 0.4 ? 2 : 1;

  const statBox = (label, value, color = '#1f2937') => (
    <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 10px', textAlign: 'center', border: '1px solid #ddd6fe' }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6d28d9', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
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
          <p style={{ margin: 0, fontSize: 13, color: '#ddd6fe', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Turns Used</p>
          <p style={{ margin: '4px 0 0', fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{result.turnsCount}</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {statBox('Duration', `${Math.floor(result.timeTaken / 60)}:${result.timeTaken % 60 < 10 ? '0' : ''}${result.timeTaken % 60}`, PURPLE_DARK)}
          {statBox('XP Awarded', `+${xpEarned}`, '#16a34a')}
        </div>

        <button
          onPointerDown={() => setPressedR(true)} onPointerUp={() => setPressedR(false)} onPointerLeave={() => setPressedR(false)}
          onClick={onReplay}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressedR ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease', boxShadow: '0 4px 16px rgba(124,58,237,0.25)' }}
        >🧠 Match Another Grid</button>
        <button
          onPointerDown={() => setPressedB(true)} onPointerUp={() => setPressedB(false)} onPointerLeave={() => setPressedB(false)}
          onClick={onBack}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: `2px solid ${PURPLE}`, background: '#fff', color: PURPLE_DARK, fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: pressedB ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease' }}
        >← Back to FunHub</button>
      </div>
    </div>
  );
}

export default function MatchManiaGame() {
  const router = useRouter();
  const [screen, setScreen] = useState('lobby');
  const [subject, setSubject] = useState(null);
  const [grade, setGrade] = useState(null);
  const [cards, setCards] = useState([]);
  const [rawQuestionsCount, setRawQuestionsCount] = useState(0);
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
        .limit(4);

      if (error) throw error;
      if (!data || data.length === 0) {
        setErrorMsg(`No data matrices matching ${sub} for Grade ${gr}. Try Maths or Science standard entries!`);
        setScreen('error');
        return;
      }

      let gameCards = [];
      data.forEach((row) => {
        const answerText = getCorrectWord(row);
        const questionText = row.question_text || row.question || 'Prompt';
        
        gameCards.push({ id: row.id, type: 'Q', text: questionText });
        gameCards.push({ id: row.id, type: 'A', text: answerText });
      });

      setRawQuestionsCount(data.length);
      setCards(gameCards);
      setScreen('game');
    } catch {
      setErrorMsg('Could not establish data link stream. Check configuration settings.');
      setScreen('error');
    }
  }

  async function handleFinish(result) {
    const baseXP = 100;
    const bonusXP = result.turnsCount <= result.totalPairs + 2 ? 50 : result.turnsCount <= result.totalPairs + 5 ? 20 : 0;
    const totalXP = baseXP + bonusXP;

    setXpEarned(totalXP);
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
            game_slug: 'match-mania',
            subject,
            grade,
            score: totalXP,
            xp_earned: totalXP,
            correct: result.totalPairs,
            total: result.totalPairs,
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
  if (screen === 'loading') return <LoadingScreen text="Constructing twin memory blocks..." />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return <GameScreen cards={cards} rawQuestionsCount={rawQuestionsCount} subject={subject} grade={grade} onFinish={handleFinish} />;
  if (screen === 'result') return <ResultScreen result={gameResult} subject={subject} grade={grade} xpEarned={xpEarned} onReplay={() => handleStart(subject, grade)} onBack={handleBack} />;
  return null;
}
