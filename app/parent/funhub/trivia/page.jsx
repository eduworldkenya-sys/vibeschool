'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const TEAL = '#0891b2';
const TEAL_DARK = '#0e7490';
const GREEN = '#16a34a';
const RED = '#dc2626';
const GOLD = '#f59e0b';
const BG = '#f9fafb';

const CATEGORIES = ['Sports', 'Nature', 'World Facts', 'Science', 'History', 'CBC'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const TOTAL_Q = 10;
const TIME_PER_Q = 20;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcXP(score, correct, streak) {
  return Math.round(score * 0.4 + correct * 8 + streak * 5);
}

function calcStars(accuracy) {
  if (accuracy >= 80) return 3;
  if (accuracy >= 50) return 2;
  return 1;
}

function normalise(row) {
  const opts = typeof row.options === 'string' ? JSON.parse(row.options) : row.options;
  return {
    id: row.id,
    question: row.question_text,
    options: Array.isArray(opts) ? opts : Object.values(opts),
    correct: row.correct,
    explanation: row.explanation || '',
  };
}

function ProgressBar({ pct, color = TEAL }) {
  return (
    <div style={{ width: '100%', height: 6, background: '#cffafe', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 1s linear' }} />
    </div>
  );
}

function StarRow({ count }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', fontSize: 36 }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ opacity: i <= count ? 1 : 0.2, filter: i <= count ? 'drop-shadow(0 0 6px #f59e0b)' : 'none' }}>⭐</span>
      ))}
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #cffafe', borderTopColor: TEAL, animation: 'spin 0.8s linear infinite' }} />
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
      <button onClick={onBack} style={{ padding: '14px 32px', borderRadius: 16, border: 'none', background: TEAL, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Back to FunHub</button>
    </div>
  );
}

function LobbyScreen({ onStart }) {
  const [category, setCategory] = useState('Sports');
  const [difficulty, setDifficulty] = useState('easy');
  const [pressed, setPressed] = useState(false);

  const chipStyle = (active, color = TEAL) => ({
    padding: '8px 14px', borderRadius: 99,
    border: `2px solid ${active ? color : '#e5e7eb'}`,
    background: active ? '#ecfeff' : '#fff',
    color: active ? color : '#374151',
    fontWeight: active ? 700 : 500, fontSize: 14,
    cursor: 'pointer', transition: 'all 0.15s',
    transform: active ? 'scale(1.04)' : 'scale(1)',
  });

  const diffColor = { easy: GREEN, medium: GOLD, hard: RED };
  const diffLabel = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' };

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>🌍</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: TEAL, margin: 0, letterSpacing: '-0.5px' }}>Trivia</h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>10 questions · 20s each · streak bonus</p>
      </div>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '24px 20px', boxShadow: '0 4px 24px rgba(8,145,178,0.10)', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => <button key={c} onClick={() => setCategory(c)} style={chipStyle(category === c)}>{c}</button>)}
          </div>
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Difficulty</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setDifficulty(d)} style={{ ...chipStyle(difficulty === d, diffColor[d]), background: difficulty === d ? '#f0fdf4' : '#fff', flex: 1 }}>
                {diffLabel[d]}
              </button>
            ))}
          </div>
        </div>
        <button
          onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
          onClick={() => onStart(category, difficulty)}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer', transform: pressed ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.12s', boxShadow: '0 4px 16px rgba(8,145,178,0.35)' }}
        >START TRIVIA →</button>
      </div>
    </div>
  );
}

function GameScreen({ questions, category, difficulty, onFinish }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const timerRef = useRef(null);
  const lockRef = useRef(false);
  const stateRef = useRef({ score: 0, correct: 0, streak: 0, bestStreak: 0, multiplier: 1.0 });

  const q = questions[idx];

  const advance = useCallback((nextIdx) => {
    if (nextIdx >= questions.length) {
      const s = stateRef.current;
      onFinish({ score: s.score, correct: s.correct, streak: s.bestStreak });
    } else {
      setIdx(nextIdx);
      setSelected(null);
      setFeedback(null);
      setTimeLeft(TIME_PER_Q);
      lockRef.current = false;
    }
  }, [questions.length, onFinish]);

  useEffect(() => {
    lockRef.current = false;
    setSelected(null);
    setFeedback(null);
    setTimeLeft(TIME_PER_Q);
  }, [idx]);

  useEffect(() => {
    if (feedback !== null) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (!lockRef.current) {
            lockRef.current = true;
            stateRef.current.streak = 0;
            stateRef.current.multiplier = 1.0;
            setStreak(0);
            setMultiplier(1.0);
            setFeedback('wrong');
            setTimeout(() => advance(idx + 1), 1200);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [idx, feedback, advance]);

  function handleSelect(opt) {
    if (lockRef.current || feedback !== null) return;
    lockRef.current = true;
    clearInterval(timerRef.current);
    setSelected(opt);
    const isCorrect = opt === q.correct;
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      const newStreak = stateRef.current.streak + 1;
      const newMult = 1.0 + Math.floor(newStreak / 3) * 0.5;
      const pts = Math.round(100 * newMult);
      const newBest = Math.max(stateRef.current.bestStreak, newStreak);
      stateRef.current = { score: stateRef.current.score + pts, correct: stateRef.current.correct + 1, streak: newStreak, bestStreak: newBest, multiplier: newMult };
      setScore(stateRef.current.score);
      setCorrect(stateRef.current.correct);
      setStreak(newStreak);
      setBestStreak(newBest);
      setMultiplier(newMult);
    } else {
      stateRef.current.streak = 0;
      stateRef.current.multiplier = 1.0;
      setStreak(0);
      setMultiplier(1.0);
    }
    setTimeout(() => advance(idx + 1), 1200);
  }

  const timerPct = (timeLeft / TIME_PER_Q) * 100;
  const timerColor = timeLeft <= 6 ? RED : timeLeft <= 11 ? GOLD : TEAL;

  const optBg = (opt) => {
    if (!feedback) return '#fff';
    if (opt === q.correct) return '#dcfce7';
    if (opt === selected) return '#fee2e2';
    return '#fff';
  };
  const optBorder = (opt) => {
    if (!feedback) return selected === opt ? TEAL : '#e5e7eb';
    if (opt === q.correct) return GREEN;
    if (opt === selected) return RED;
    return '#e5e7eb';
  };

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: TEAL, fontSize: 15 }}>🌍 Trivia</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>{idx + 1} / {questions.length}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 14, padding: '10px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Score</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: TEAL }}>{score}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Streak</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: streak > 0 ? GOLD : '#d1d5db' }}>{streak > 0 ? `🔥 ${streak}` : '—'}</p>
          </div>
          {multiplier > 1 && (
            <div style={{ background: '#fef3c7', borderRadius: 10, padding: '6px 10px', border: '2px solid #f59e0b' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#92400e' }}>{multiplier.toFixed(1)}×</p>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Time</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: timerColor }}>{timeLeft}s</span>
          </div>
          <ProgressBar pct={timerPct} color={timerColor} />
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 18px', boxShadow: '0 4px 20px rgba(8,145,178,0.09)', minHeight: 90, display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1f2937', lineHeight: 1.45, textAlign: 'center', width: '100%' }}>{q.question}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map((opt, i) => {
            const keys = ['A', 'B', 'C', 'D'];
            return (
              <button key={i} onClick={() => handleSelect(opt)} disabled={!!feedback}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 16, border: `2px solid ${optBorder(opt)}`, background: optBg(opt), display: 'flex', alignItems: 'center', gap: 12, cursor: feedback ? 'default' : 'pointer', transition: 'all 0.15s', textAlign: 'left' }}>
                <span style={{ minWidth: 30, height: 30, borderRadius: '50%', background: opt === q.correct && feedback ? '#dcfce7' : (opt === selected && feedback ? '#fee2e2' : '#f3f4f6'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#374151', flexShrink: 0 }}>{keys[i]}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', lineHeight: 1.3 }}>{opt}</span>
                {feedback && opt === q.correct && <span style={{ marginLeft: 'auto', fontSize: 18 }}>✅</span>}
                {feedback === 'wrong' && opt === selected && opt !== q.correct && <span style={{ marginLeft: 'auto', fontSize: 18 }}>❌</span>}
              </button>
            );
          })}
        </div>

        {feedback && q.explanation ? (
          <div style={{ background: '#ecfeff', borderRadius: 14, padding: '12px 16px', border: `1px solid ${TEAL}` }}>
            <p style={{ margin: 0, fontSize: 13, color: '#164e63', lineHeight: 1.5, fontWeight: 500 }}>💡 {q.explanation}</p>
          </div>
        ) : null}

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>{category} · {difficulty}</span>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ result, category, difficulty, onReplay, onBack, xpEarned }) {
  const { score, correct, total, streak } = result;
  const wrong = total - correct;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const stars = calcStars(accuracy);
  const [pressedR, setPressedR] = useState(false);
  const [pressedB, setPressedB] = useState(false);

  const statBox = (label, value, color = '#1f2937') => (
    <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 10px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <StarRow count={stars} />
          <h1 style={{ margin: '12px 0 4px', fontSize: 26, fontWeight: 900, color: '#1f2937' }}>
            {accuracy >= 80 ? 'Brilliant! 🎉' : accuracy >= 50 ? 'Good effort! 👍' : 'Keep going! 💪'}
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontWeight: 500, fontSize: 14 }}>{category} · {difficulty}</p>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, borderRadius: 20, padding: '20px 0', textAlign: 'center', boxShadow: '0 6px 24px rgba(8,145,178,0.3)' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#a5f3fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Final Score</p>
          <p style={{ margin: '4px 0 0', fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{score}</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {statBox('Correct', correct, GREEN)}
          {statBox('Wrong', wrong, RED)}
          {statBox('Accuracy', `${accuracy}%`, TEAL)}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {statBox('Best Streak', streak > 0 ? `🔥 ${streak}` : '—', GOLD)}
          {statBox('XP Earned', `+${xpEarned}`, '#7c3aed')}
        </div>

        <button
          onPointerDown={() => setPressedR(true)} onPointerUp={() => setPressedR(false)} onPointerLeave={() => setPressedR(false)}
          onClick={onReplay}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressedR ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.12s', boxShadow: '0 4px 16px rgba(8,145,178,0.35)' }}
        >🌍 Play Again</button>
        <button
          onPointerDown={() => setPressedB(true)} onPointerUp={() => setPressedB(false)} onPointerLeave={() => setPressedB(false)}
          onClick={onBack}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: `2px solid ${TEAL}`, background: '#fff', color: TEAL, fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: pressedB ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.12s' }}
        >← Back to FunHub</button>
      </div>
    </div>
  );
}

export default function TriviaGame() {
  const router = useRouter();
  const [screen, setScreen] = useState('lobby');
  const [category, setCategory] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [gameResult, setGameResult] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);

  async function getStudentId() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('students').select('id').eq('profile_id', user.id).single();
      return data?.id ?? null;
    } catch { return null; }
  }

  async function handleStart(cat, diff) {
    setCategory(cat);
    setDifficulty(diff);
    setScreen('loading');
    try {
      const { data, error } = await supabase
        .from('funhub_trivia')
        .select('*')
        .eq('category', cat)
        .eq('difficulty', diff);
      if (error) throw error;
      if (!data || data.length === 0) {
        setErrorMsg(`No ${diff} questions found for ${cat}. Try a different category or difficulty!`);
        setScreen('error');
        return;
      }
      const picked = shuffle(data).slice(0, TOTAL_Q).map(normalise);
      setQuestions(picked);
      setScreen('game');
    } catch {
      setErrorMsg('Could not load questions. Check your connection and try again.');
      setScreen('error');
    }
  }

  async function handleFinish(result) {
    const total = questions.length;
    const xp = calcXP(result.score, result.correct, result.streak);
    setXpEarned(xp);
    setGameResult({ ...result, total });
    setScreen('result');
    try {
      const studentId = await getStudentId();
      await supabase.from('funhub_sessions').insert({
        student_id: studentId,
        game_slug: 'trivia',
        subject: null,
        grade: null,
        score: result.score,
        xp_earned: xp,
        correct: result.correct,
        total,
        streak_max: result.streak,
        completed: true,
      });
    } catch { /* silent */ }
  }

  function handleReplay() {
    setQuestions([]);
    setGameResult(null);
    setXpEarned(0);
    handleStart(category, difficulty);
  }

  function handleBack() { router.push('/parent/funhub'); }

  if (screen === 'lobby') return <LobbyScreen onStart={handleStart} />;
  if (screen === 'loading') return <LoadingScreen text="Loading trivia…" />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return <GameScreen questions={questions} category={category} difficulty={difficulty} onFinish={handleFinish} />;
  if (screen === 'result') return <ResultScreen result={gameResult} category={category} difficulty={difficulty} xpEarned={xpEarned} onReplay={handleReplay} onBack={handleBack} />;
  return null;
}
