'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase';

const INDIGO = '#4f46e5';
const INDIGO_DARK = '#3730a3';
const GREEN = '#16a34a';
const RED = '#dc2626';
const GOLD = '#f59e0b';
const BG = '#f9fafb';

const SUBJECTS = ['Maths', 'English', 'Kiswahili', 'Science', 'Social Studies', 'General'];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TOTAL_Q = 10;
const TIME_PER_Q = 15;

/* ─── tiny helpers ─── */
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

/* ─── subcomponents ─── */
function ProgressBar({ pct, color = INDIGO }) {
  return (
    <div style={{ width: '100%', height: 6, background: '#e0e7ff', borderRadius: 99, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 99,
          transition: 'width 1s linear',
        }}
      />
    </div>
  );
}

function StarRow({ count }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', fontSize: 36 }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ opacity: i <= count ? 1 : 0.2, filter: i <= count ? 'drop-shadow(0 0 6px #f59e0b)' : 'none' }}>
          ⭐
        </span>
      ))}
    </div>
  );
}

/* ─── screens ─── */
function LobbyScreen({ onStart }) {
  const [grade, setGrade] = useState(4);
  const [subject, setSubject] = useState('Maths');
  const [pressed, setPressed] = useState(false);

  const chipStyle = (active) => ({
    padding: '8px 14px',
    borderRadius: 99,
    border: `2px solid ${active ? INDIGO : '#e5e7eb'}`,
    background: active ? '#eef2ff' : '#fff',
    color: active ? INDIGO : '#374151',
    fontWeight: active ? 700 : 500,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s',
    transform: active ? 'scale(1.04)' : 'scale(1)',
  });

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      {/* hero */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>⚡</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: INDIGO, margin: 0, letterSpacing: '-0.5px' }}>Quiz Blitz</h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>10 questions · 15s each · streak bonus</p>
      </div>

      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '24px 20px', boxShadow: '0 4px 24px rgba(79,70,229,0.10)', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* grade */}
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Grade</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GRADES.map(g => (
              <button key={g} onClick={() => setGrade(g)} style={chipStyle(grade === g)}>Grade {g}</button>
            ))}
          </div>
        </div>

        {/* subject */}
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Subject</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => setSubject(s)} style={chipStyle(subject === s)}>{s}</button>
            ))}
          </div>
        </div>

        {/* start */}
        <button
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          onClick={() => onStart(grade, subject)}
          style={{
            width: '100%',
            padding: '16px 0',
            borderRadius: 16,
            border: 'none',
            background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_DARK})`,
            color: '#fff',
            fontSize: 17,
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.02em',
            transform: pressed ? 'scale(0.96)' : 'scale(1)',
            transition: 'transform 0.12s',
            boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
          }}
        >
          START BLITZ →
        </button>
      </div>
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: `4px solid #e0e7ff`,
        borderTopColor: INDIGO,
        animation: 'spin 0.8s linear infinite',
      }} />
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
      <button
        onClick={onBack}
        style={{ padding: '14px 32px', borderRadius: 16, border: 'none', background: INDIGO, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
      >
        ← Back to FunHub
      </button>
    </div>
  );
}

function GameScreen({ questions, grade, subject, onFinish }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);   // 'A'|'B'|'C'|'D'
  const [feedback, setFeedback] = useState(null);   // 'correct'|'wrong'
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const timerRef = useRef(null);
  const lockRef = useRef(false);

  const q = questions[idx];
  const options = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d },
  ];

  const advance = useCallback((wasCorrect, basePoints) => {
    const newIdx = idx + 1;
    if (newIdx >= questions.length) {
      onFinish({ score, correct, streak: bestStreak });
    } else {
      setIdx(newIdx);
      setSelected(null);
      setFeedback(null);
      setTimeLeft(TIME_PER_Q);
      lockRef.current = false;
    }
  }, [idx, questions.length, onFinish, score, correct, bestStreak]);

  // timer
  useEffect(() => {
    if (feedback !== null) return; // paused during feedback
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (!lockRef.current) {
            lockRef.current = true;
            // time out = wrong
            setFeedback('wrong');
            setStreak(0);
            setMultiplier(1.0);
            setTimeout(() => advance(false, 0), 800);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [idx, feedback, advance]);

  function handleSelect(key) {
    if (lockRef.current || feedback !== null) return;
    lockRef.current = true;
    clearInterval(timerRef.current);
    setSelected(key);
    const isCorrect = key === q.correct_option;
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      const newStreak = streak + 1;
      const newMult = 1.0 + Math.floor(newStreak / 3) * 0.5;
      const pts = Math.round(100 * newMult);
      setScore(s => s + pts);
      setCorrect(c => c + 1);
      setStreak(newStreak);
      setMultiplier(newMult);
      setBestStreak(b => Math.max(b, newStreak));
    } else {
      setStreak(0);
      setMultiplier(1.0);
    }

    setTimeout(() => advance(isCorrect, 0), 800);
  }

  const timerPct = (timeLeft / TIME_PER_Q) * 100;
  const timerColor = timeLeft <= 5 ? RED : timeLeft <= 9 ? GOLD : INDIGO;

  const optionBg = (key) => {
    if (feedback === null) return '#fff';
    if (key === q.correct_option) return '#dcfce7';
    if (key === selected && selected !== q.correct_option) return '#fee2e2';
    return '#fff';
  };
  const optionBorder = (key) => {
    if (feedback === null) return selected === key ? INDIGO : '#e5e7eb';
    if (key === q.correct_option) return GREEN;
    if (key === selected) return RED;
    return '#e5e7eb';
  };

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: INDIGO, fontSize: 15 }}>⚡ Quiz Blitz</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>{idx + 1} / {questions.length}</span>
        </div>

        {/* score + multiplier */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 14, padding: '10px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Score</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: INDIGO }}>{score}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Streak</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: streak > 0 ? GOLD : '#d1d5db' }}>
              {streak > 0 ? `🔥 ${streak}` : '—'}
            </p>
          </div>
          {multiplier > 1 && (
            <div style={{ background: '#fef3c7', borderRadius: 10, padding: '6px 10px', border: '2px solid #f59e0b' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#92400e' }}>{multiplier.toFixed(1)}×</p>
            </div>
          )}
        </div>

        {/* timer */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Time</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: timerColor }}>{timeLeft}s</span>
          </div>
          <ProgressBar pct={timerPct} color={timerColor} />
        </div>

        {/* question card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 18px', boxShadow: '0 4px 20px rgba(79,70,229,0.09)', minHeight: 90, display: 'flex', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1f2937', lineHeight: 1.45, textAlign: 'center', width: '100%' }}>
            {q.question}
          </p>
        </div>

        {/* options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {options.map(({ key, text }) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              disabled={feedback !== null}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 16,
                border: `2px solid ${optionBorder(key)}`,
                background: optionBg(key),
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: feedback !== null ? 'default' : 'pointer',
                transition: 'all 0.15s',
                transform: selected === key ? 'scale(0.97)' : 'scale(1)',
                textAlign: 'left',
              }}
            >
              <span style={{
                minWidth: 30, height: 30, borderRadius: '50%',
                background: key === q.correct_option && feedback ? '#dcfce7' : (selected === key && feedback ? (feedback === 'wrong' ? '#fee2e2' : '#dcfce7') : '#f3f4f6'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13, color: '#374151',
              }}>
                {key}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', lineHeight: 1.3 }}>{text}</span>
              {feedback && key === q.correct_option && <span style={{ marginLeft: 'auto', fontSize: 18 }}>✅</span>}
              {feedback === 'wrong' && key === selected && key !== q.correct_option && <span style={{ marginLeft: 'auto', fontSize: 18 }}>❌</span>}
            </button>
          ))}
        </div>

        {/* subject/grade tag */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>{subject} · Grade {grade}</span>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ result, grade, subject, onReplay, onBack, xpEarned }) {
  const { score, correct, total, bestStreak } = result;
  const wrong = total - correct;
  const accuracy = Math.round((correct / total) * 100);
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

        {/* header */}
        <div style={{ textAlign: 'center' }}>
          <StarRow count={stars} />
          <h1 style={{ margin: '12px 0 4px', fontSize: 26, fontWeight: 900, color: '#1f2937' }}>
            {accuracy >= 80 ? 'Brilliant! 🎉' : accuracy >= 50 ? 'Good effort! 👍' : 'Keep going! 💪'}
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontWeight: 500, fontSize: 14 }}>{subject} · Grade {grade}</p>
        </div>

        {/* score big */}
        <div style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_DARK})`, borderRadius: 20, padding: '20px 0', textAlign: 'center', boxShadow: '0 6px 24px rgba(79,70,229,0.3)' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#c7d2fe', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Final Score</p>
          <p style={{ margin: '4px 0 0', fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{score}</p>
        </div>

        {/* stats */}
        <div style={{ display: 'flex', gap: 10 }}>
          {statBox('Correct', correct, GREEN)}
          {statBox('Wrong', wrong, RED)}
          {statBox('Accuracy', `${accuracy}%`, INDIGO)}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {statBox('Best Streak', bestStreak > 0 ? `🔥 ${bestStreak}` : '—', GOLD)}
          {statBox('XP Earned', `+${xpEarned}`, '#7c3aed')}
        </div>

        {/* buttons */}
        <button
          onPointerDown={() => setPressedR(true)}
          onPointerUp={() => setPressedR(false)}
          onPointerLeave={() => setPressedR(false)}
          onClick={onReplay}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 16, border: 'none',
            background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_DARK})`,
            color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
            transform: pressedR ? 'scale(0.96)' : 'scale(1)',
            transition: 'transform 0.12s',
            boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
          }}
        >
          ⚡ Play Again
        </button>

        <button
          onPointerDown={() => setPressedB(true)}
          onPointerUp={() => setPressedB(false)}
          onPointerLeave={() => setPressedB(false)}
          onClick={onBack}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 16,
            border: `2px solid ${INDIGO}`,
            background: '#fff', color: INDIGO, fontSize: 16, fontWeight: 700, cursor: 'pointer',
            transform: pressedB ? 'scale(0.96)' : 'scale(1)',
            transition: 'transform 0.12s',
          }}
        >
          ← Back to FunHub
        </button>
      </div>
    </div>
  );
}

/* ─── main page ─── */
export default function QuizBlitz() {
  const router = useRouter();
  const supabase = createClient();

  const [screen, setScreen] = useState('lobby'); // lobby | loading | error | game | result
  const [grade, setGrade] = useState(null);
  const [subject, setSubject] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [gameResult, setGameResult] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);

  async function getStudentId() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .single();
      return data?.id ?? null;
    } catch {
      return null;
    }
  }

  async function handleStart(g, s) {
    setGrade(g);
    setSubject(s);
    setScreen('loading');

    try {
      const { data, error } = await supabase
        .from('funhub_questions')
        .select('*')
        .eq('grade', g)
        .eq('subject', s);

      if (error) throw error;

      if (!data || data.length === 0) {
        setErrorMsg(`No questions found for ${s} Grade ${g}. Ask your teacher to add questions!`);
        setScreen('error');
        return;
      }

      const picked = shuffle(data).slice(0, TOTAL_Q);
      setQuestions(picked);
      setScreen('game');
    } catch (e) {
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

    // save session — fire and forget, don't block UI
    try {
      const studentId = await getStudentId();
      await supabase.from('funhub_sessions').insert({
        student_id: studentId,
        game_slug: 'quiz-blitz',
        subject,
        grade,
        score: result.score,
        xp_earned: xp,
        correct: result.correct,
        total,
        streak_max: result.streak,
        completed: true,
      });
    } catch {
      // silent — game result already shown
    }
  }

  function handleReplay() {
    setQuestions([]);
    setGameResult(null);
    setXpEarned(0);
    handleStart(grade, subject);
  }

  function handleBack() {
    router.push('/parent/funhub');
  }

  if (screen === 'lobby') return <LobbyScreen onStart={handleStart} />;
  if (screen === 'loading') return <LoadingScreen text="Loading questions…" />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return (
    <GameScreen
      questions={questions}
      grade={grade}
      subject={subject}
      onFinish={handleFinish}
    />
  );
  if (screen === 'result') return (
    <ResultScreen
      result={gameResult}
      grade={grade}
      subject={subject}
      xpEarned={xpEarned}
      onReplay={handleReplay}
      onBack={handleBack}
    />
  );

  return null;
}
