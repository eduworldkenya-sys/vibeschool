"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const PURPLE = '#a855f7';
const PURPLE_DARK = '#7e22ce';
const BG = '#faf5ff';

const SUBJECTS = ['Maths', 'English', 'Science', 'Social Studies', 'General'];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const BALLOON_COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

const LEVELS = [
  {
    id: 1,
    label: 'Level 1',
    tag: 'Warm Up',
    emoji: '🟢',
    timerSecs: 10,
    questions: 5,
    showDecoys: false,
    passRate: 0.6, // 60%
    desc: '5 questions · 10s each · No decoys',
    color: '#16a34a',
    bgLight: '#f0fdf4',
    border: '#bbf7d0',
  },
  {
    id: 2,
    label: 'Level 2',
    tag: 'Challenge',
    emoji: '🟡',
    timerSecs: 7,
    questions: 7,
    showDecoys: false,
    passRate: 0.71, // 5 out of 7
    desc: '7 questions · 7s each · Faster clock',
    color: '#d97706',
    bgLight: '#fef3c7',
    border: '#fde68a',
  },
  {
    id: 3,
    label: 'Level 3',
    tag: 'Expert',
    emoji: '🔴',
    timerSecs: 5,
    questions: 8,
    showDecoys: true,
    passRate: 0.75, // 6 out of 8
    desc: '8 questions · 5s each · Decoy balloons',
    color: '#dc2626',
    bgLight: '#fef2f2',
    border: '#fecaca',
  },
];

function parseOptions(row) {
  if (!row) return [];
  let opts = {};
  try {
    opts = typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || {});
  } catch {
    return [];
  }
  if (Array.isArray(opts)) {
    return opts.map((val, idx) => ({ key: ['A','B','C','D'][idx] || String(idx), text: String(val) }));
  }
  return Object.entries(opts).map(([key, val]) => ({ key, text: String(val) }));
}

function getCorrectText(row) {
  const options = parseOptions(row);
  const correctKey = String(row?.correct || row?.correct_option || '').toUpperCase().trim();
  return options.find(o => o.key === correctKey)?.text ?? '';
}

function buildDecoys(currentRow, allQuestions, count = 2) {
  const correctText = getCorrectText(currentRow);
  const pool = allQuestions
    .filter(q => q.id !== currentRow.id)
    .map(q => getCorrectText(q))
    .filter(t => t && t !== correctText);
  
  // Dynamic fallback pool if unique sibling database results are sparse
  const fallbackPool = ['True', 'False', 'None', 'All of above', 'N/A'];
  const unifiedPool = pool.length >= count ? pool : [...pool, ...fallbackPool];
  
  const shuffled = [...unifiedPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((text, i) => ({
    key: `DECOY_${i}_${Math.random().toString(36).substring(2, 7)}`,
    text,
    isDecoy: true,
  }));
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function LoadingScreen({ text }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #e9d5ff', borderTopColor: PURPLE, animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: PURPLE_DARK, fontWeight: 600, fontSize: 15 }}>{text}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function ErrorScreen({ message, onBack }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>🎈</div>
      <h2 style={{ color: PURPLE_DARK, fontWeight: 800, margin: 0 }}>No Data Available</h2>
      <p style={{ color: '#581c87', fontSize: 15, maxWidth: 300 }}>{message}</p>
      <button onClick={onBack} style={{ padding: '14px 32px', borderRadius: 16, border: 'none', background: PURPLE, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Back to FunHub</button>
    </div>
  );
}

function LobbyScreen({ onStart }) {
  const [subject, setSubject] = useState('Maths');
  const [grade, setGrade] = useState(3);
  const [levelId, setLevelId] = useState(1);
  const [pressed, setPressed] = useState(false);

  const chipStyle = (active) => ({
    padding: '8px 14px', borderRadius: 99,
    border: `2px solid ${active ? PURPLE : '#e5e7eb'}`,
    background: active ? '#f3e8ff' : '#fff',
    color: active ? PURPLE_DARK : '#374151',
    fontWeight: active ? 700 : 500, fontSize: 13,
    cursor: 'pointer', transition: 'all 0.15s ease'
  });

  const selectedLevel = LEVELS.find(l => l.id === levelId) || LEVELS[0];

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>🎈</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: PURPLE_DARK, margin: 0, letterSpacing: '-0.5px' }}>Balloon Pop</h1>
        <p style={{ color: '#581c87', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>Unleash swift reactions, watch the clock, protect your streak!</p>
      </div>

      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 24, padding: '24px 20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(168,85,247,0.06)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 12, color: '#4b5563', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Difficulty Level</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LEVELS.map(l => (
              <button
                key={l.id}
                onClick={() => setLevelId(l.id)}
                style={{
                  padding: '11px 14px', borderRadius: 14, cursor: 'pointer',
                  border: `2px solid ${levelId === l.id ? l.color : '#e5e7eb'}`,
                  background: levelId === l.id ? l.bgLight : '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.15s ease', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 18 }}>{l.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: levelId === l.id ? l.color : '#374151' }}>{l.label} · {l.tag}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{l.desc}</div>
                </div>
                {levelId === l.id && (
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: l.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontWeight: 700, fontSize: 12, color: '#4b5563', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUBJECTS.map(s => <button key={s} onClick={() => setSubject(s)} style={chipStyle(subject === s)}>{s}</button>)}
          </div>
        </div>

        <div>
          <p style={{ fontWeight: 700, fontSize: 12, color: '#4b5563', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grade</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GRADES.map(g => <button key={g} onClick={() => setGrade(g)} style={chipStyle(grade === g)}>Grade {g}</button>)}
          </div>
        </div>

        <button
          onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
          onClick={() => onStart(subject, grade, levelId)}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${selectedLevel.color}, ${PURPLE_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressed ? 'scale(0.96)' : 'scale(1)', transition: 'all 0.15s ease', boxShadow: `0 4px 16px ${selectedLevel.color}55` }}
        >INFLATE BALLOONS {selectedLevel.emoji}</button>
      </div>
    </div>
  );
}

function GameScreen({ questions, allQuestions, levelConfig, onFinish }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [rawXp, setRawXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [poppedIndex, setPoppedIndex] = useState(null);
  const [timeLeft, setTimeLeft] = useState(levelConfig.timerSecs);
  const [particles, setParticles] = useState([]);

  const timerRef = useRef(null);
  const lockTransitionRef = useRef(false);
  
  // Memory Cache Refs to preserve runtime state correctness across render ticks
  const scoreRef = useRef(0);
  const xpRef = useRef(0);
  const currentCorrectKeyRef = useRef('');

  const currentQuestion = questions[index] || { question: 'End of session configuration data.' };
  const questionText = currentQuestion?.question_text || currentQuestion?.question || 'Select the correct option.';

  // Synchronize score and xp values directly into references to defeat closing-scopes
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { xpRef.current = rawXp; }, [rawXp]);

  // Compute layout structure on a per-index baseline to avoid asynchronous state drift
  const currentMatrix = useMemo(() => {
    if (!currentQuestion) return { options: [], positions: [], key: '' };
    const base = parseOptions(currentQuestion);
    let opts = base.map(o => ({ ...o, isDecoy: false }));
    const corrKey = String(currentQuestion?.correct || currentQuestion?.correct_option || '').toUpperCase().trim();
    
    currentCorrectKeyRef.current = corrKey;

    if (levelConfig.showDecoys && allQuestions.length > 1) {
      const decoys = buildDecoys(currentQuestion, allQuestions, 2);
      const wrongSlots = opts.filter(o => o.key !== corrKey);
      const replaceable = wrongSlots.slice(0, decoys.length);
      opts = opts.filter(o => !replaceable.find(r => r.key === o.key));
      opts = shuffleArray([...opts, ...decoys]);
    }

    const positions = opts.map(() => ({
      leftOffset: Math.floor(Math.random() * 16) - 8,
      bobDelay: `${(Math.random() * 2).toFixed(2)}s`,
      bobDuration: `${(3 + Math.random() * 1.5).toFixed(2)}s`,
    }));

    return { options: opts, positions, key: corrKey };
  }, [index, currentQuestion, levelConfig.showDecoys, allQuestions]);

  const liveMult = useMemo(() => {
    return streak >= 3 ? 3 : streak === 2 ? 2 : streak === 1 ? 1.5 : 1;
  }, [streak]);

  // Reset clock tick intervals
  useEffect(() => {
    setTimeLeft(levelConfig.timerSecs);
    setFeedback(null);
    setPoppedIndex(null);
    setParticles([]);
    lockTransitionRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [index, levelConfig.timerSecs]);

  // Watch countdown expiry frame via real-time effect bindings
  useEffect(() => {
    if (timeLeft === 0 && !lockTransitionRef.current) {
      lockTransitionRef.current = true;
      clearInterval(timerRef.current);
      setFeedback({ isCorrect: false, reason: 'timeout' });
      setStreak(0);
      
      setTimeout(() => {
        if (index + 1 < questions.length) {
          setIndex(prev => prev + 1);
        } else {
          onFinish({ totalQuestions: questions.length, correctAnswers: scoreRef.current, finalXp: xpRef.current });
        }
      }, 1600);
    }
  }, [timeLeft, index, questions.length, onFinish]);

  function handleBalloonPop(optionKey, optIdx, e) {
    if (lockTransitionRef.current) return;
    lockTransitionRef.current = true;
    clearInterval(timerRef.current);

    const isCorrect = optionKey === currentCorrectKeyRef.current;
    let nextScore = score;
    let nextXp = rawXp;
    let nextStreak = streak;

    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const bursts = Array.from({ length: 10 }).map((_, i) => ({
        id: `p-${optIdx}-${i}-${Math.random()}`,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        angle: (i * 36 * Math.PI) / 180,
        speed: 3 + Math.random() * 3,
        color: BALLOON_COLORS[optIdx % BALLOON_COLORS.length],
      }));
      setParticles(bursts);
    }

    setPoppedIndex(optIdx);

    if (isCorrect) {
      nextStreak += 1;
      const calcMult = nextStreak >= 3 ? 3 : nextStreak === 2 ? 2 : nextStreak === 1 ? 1.5 : 1;
      nextScore += 1;
      nextXp += Math.round(Math.max(1, timeLeft) * 4 * calcMult); // Base score decoupled from lower configurations
      setScore(nextScore);
      setRawXp(nextXp);
      setStreak(nextStreak);
      setFeedback({ isCorrect: true });
    } else {
      setStreak(0);
      setFeedback({ isCorrect: false });
    }

    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex(prev => prev + 1);
      } else {
        onFinish({ totalQuestions: questions.length, correctAnswers: nextScore, finalXp: nextXp });
      }
    }, 1600);
  }

  const timerPct = (timeLeft / levelConfig.timerSecs) * 100;
  const timerDanger = timeLeft <= Math.ceil(levelConfig.timerSecs * 0.3);

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', overflowX: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes floatBob {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1.5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes particleFly {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx),var(--dy)) scale(0); opacity: 0; }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 14px', borderRadius: 16, border: '1px solid #e9d5ff' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Question</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#374151' }}>{index + 1} / {questions.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ background: streak > 0 ? '#fce7f3' : '#f3f4f6', padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 800, color: streak > 0 ? '#be185d' : '#6b7280' }}>
              🔥 {streak}
            </div>
            <div style={{ background: liveMult > 1 ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})` : '#e5e7eb', padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 900, color: liveMult > 1 ? '#fff' : '#4b5563' }}>
              {liveMult}x
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>XP</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>✨ {rawXp}</span>
          </div>
        </div>

        <div style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${timerPct}%`, height: '100%', background: timerDanger ? '#ef4444' : PURPLE, transition: 'width 1s linear, background 0.3s' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: levelConfig.color }}>{levelConfig.emoji} {levelConfig.label} · {levelConfig.tag}</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: timerDanger ? '#ef4444' : PURPLE_DARK }}>
            {timerDanger ? '⚠️' : '⏱'} {timeLeft}s
          </span>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '18px 16px', border: '1px solid #e9d5ff', textAlign: 'center' }}>
          {feedback?.reason === 'timeout' && (
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#ef4444', fontWeight: 800, textTransform: 'uppercase' }}>⏰ TIME EXPIRED</p>
          )}
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1f2937', lineHeight: 1.4 }}>{questionText}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '8px 0', position: 'relative' }}>
          {currentMatrix.options.map((opt, i) => {
            const config = currentMatrix.positions[i] || { leftOffset: 0, bobDelay: '0s', bobDuration: '3s' };
            const color = BALLOON_COLORS[i % BALLOON_COLORS.length];
            const isPopped = poppedIndex === i;
            const isCorrectOpt = opt.key === currentMatrix.key;
            const showCorrect = feedback && !feedback.isCorrect && isCorrectOpt && !opt.isDecoy;

            return (
              <div
                key={`${index}-${opt.key}`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative',
                  marginLeft: config.leftOffset,
                  opacity: isPopped ? 0 : 1,
                  transform: isPopped ? 'scale(0.1)' : 'none',
                  animation: isPopped ? 'none' : `floatBob ${config.bobDuration} ease-in-out ${config.bobDelay} infinite`,
                  transition: 'opacity 0.18s ease, transform 0.18s cubic-bezier(0.6,-0.28,0.735,0.045)',
                }}
              >
                {isPopped && particles.map(p => {
                  const dx = `${Math.cos(p.angle) * p.speed * 14}px`;
                  const dy = `${Math.sin(p.angle) * p.speed * 14}px`;
                  return (
                    <div key={p.id} style={{ position: 'absolute', left: p.x, top: p.y, width: 7, height: 7, borderRadius: '50%', background: p.color, pointerEvents: 'none', '--dx': dx, '--dy': dy, animation: 'particleFly 0.5s forwards ease-out' }} />
                  );
                })}

                <button
                  type="button"
                  onClick={e => handleBalloonPop(opt.key, i, e)}
                  disabled={!!feedback}
                  style={{
                    width: 118, height: 140,
                    borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%',
                    background: showCorrect ? '#10b981' : color,
                    border: 'none', position: 'relative', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px',
                    boxShadow: 'inset -8px -8px 16px rgba(0,0,0,0.12), 0 8px 18px rgba(0,0,0,0.06)',
                    color: '#fff', fontWeight: 800, fontSize: 13, textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word',
                  }}
                >
                  {opt.text}
                  <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `7px solid ${showCorrect ? '#10b981' : color}` }} />
                </button>

                <div style={{ width: 2, height: 36, background: '#d1d5db', marginTop: 3 }} />

                {showCorrect && (
                  <div style={{ position: 'absolute', top: -18, background: '#10b981', color: '#fff', padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 900, zIndex: 30 }}>CORRECT</div>
                )}
                {opt.isDecoy && feedback && isPopped && (
                  <div style={{ position: 'absolute', top: -18, background: '#dc2626', color: '#fff', padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 900, zIndex: 30 }}>DECOY</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ result, levelConfig, onReplay, onNextLevel, onBack, xpEarned }) {
  const [pressedR, setPressedR] = useState(false);
  const [pressedN, setPressedN] = useState(false);
  const [pressedB, setPressedB] = useState(false);

  const finalRate = result.correctAnswers / result.totalQuestions;
  const passed = finalRate >= levelConfig.passRate;
  const nextLevel = LEVELS.find(l => l.id === levelConfig.id + 1);

  const neededCount = Math.ceil(levelConfig.passRate * result.totalQuestions);

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 52, marginBottom: 8 }}>{passed ? '🏆' : '🎈'}</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#1f2937' }}>{passed ? 'Perfect Pop!' : 'Round Done!'}</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontWeight: 500 }}>{levelConfig.emoji} {levelConfig.label} · {levelConfig.tag}</p>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`, borderRadius: 20, padding: '20px 0', boxShadow: '0 6px 24px rgba(168,85,247,0.2)' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#e9d5ff', fontWeight: 700, textTransform: 'uppercase' }}>Correct Pops</p>
          <p style={{ margin: '4px 0 0', fontSize: 44, fontWeight: 900, color: '#fff' }}>{result.correctAnswers} / {result.totalQuestions}</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 10px', border: '1px solid #e9d5ff' }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: PURPLE_DARK }}>{result.correctAnswers === 0 ? '—' : `${Math.round(finalRate * 100)}%`}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Accuracy</p>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 10px', border: '1px solid #e9d5ff' }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#16a34a' }}>+{xpEarned}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>XP Earned</p>
          </div>
        </div>

        {!passed && nextLevel && (
          <p style={{ margin: '4px 0', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
            ⚠️ Pop at least {neededCount} out of {result.totalQuestions} balloons to advance.
          </p>
        )}

        {passed && nextLevel && (
          <button
            onPointerDown={() => setPressedN(true)} onPointerUp={() => setPressedN(false)} onPointerLeave={() => setPressedN(false)}
            onClick={onNextLevel}
            style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${nextLevel.color}, #7e22ce)`, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', transform: pressedN ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease', boxShadow: `0 4px 16px ${nextLevel.color}44` }}
          >{nextLevel.emoji} Advance to {nextLevel.label} →</button>
        )}

        <button
          onPointerDown={() => setPressedR(true)} onPointerUp={() => setPressedR(false)} onPointerLeave={() => setPressedR(false)}
          onClick={onReplay}
          style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: `2px solid ${PURPLE}`, background: '#fff', color: PURPLE_DARK, fontSize: 15, fontWeight: 700, cursor: 'pointer', transform: pressedR ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease' }}
        >🔁 Retry {levelConfig.label}</button>
        <button
          onPointerDown={() => setPressedB(true)} onPointerUp={() => setPressedB(false)} onPointerLeave={() => setPressedB(false)}
          onClick={onBack}
          style={{ width: '100%', padding: '13px 0', borderRadius: 16, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, fontWeight: 700, cursor: 'pointer', transform: pressedB ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease' }}
        >← Back to FunHub</button>
      </div>
    </div>
  );
}

export default function BalloonPopGame() {
  const router = useRouter();
  const [screen, setScreen] = useState('lobby');
  const [subject, setSubject] = useState(null);
  const [grade, setGrade] = useState(null);
  const [levelId, setLevelId] = useState(1);
  const [questions, setQuestions] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [gameResult, setGameResult] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);

  const levelConfig = useMemo(() => {
    return LEVELS.find(l => l.id === levelId) || LEVELS[0];
  }, [levelId]);

  async function handleStart(sub, gr, lvl) {
    setSubject(sub);
    setGrade(gr);
    setLevelId(lvl);
    setScreen('loading');
    const lc = LEVELS.find(l => l.id === lvl) || LEVELS[0];
    try {
      const { data, error } = await supabase
        .from('funhub_questions')
        .select('*')
        .eq('subject', sub)
        .eq('grade', gr)
        .limit(lc.questions + 6);

      if (error) throw error;

      const clean = (data || []).filter(row => parseOptions(row).length >= 2);

      if (clean.length < lc.questions) {
        setErrorMsg(`Need at least ${lc.questions} questions for ${lc.label}. Only ${clean.length} found for ${sub} Grade ${gr}.`);
        setScreen('error');
        return;
      }

      setAllQuestions(clean);
      setQuestions(shuffleArray(clean).slice(0, lc.questions));
      setScreen('game');
    } catch (err) {
      console.error('Supabase fetch failure boundary:', err);
      setErrorMsg('Could not fetch questions. Check network configuration.');
      setScreen('error');
    }
  }

  async function handleFinish(result) {
    const rate = result.correctAnswers / result.totalQuestions;
    const levelBonus = rate >= levelConfig.passRate ? levelConfig.id * 20 : 0;
    const finalTotalScore = result.finalXp + levelBonus;

    setXpEarned(finalTotalScore);
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
          const { error: insertError } = await supabase.from('funhub_sessions').insert({
            student_id: student.id,
            game_slug: `balloon-pop-l${levelConfig.id}`,
            subject,
            grade,
            score: finalTotalScore,
            xp_earned: finalTotalScore,
            correct: result.correctAnswers,
            total: result.totalQuestions,
            completed: rate >= levelConfig.passRate,
          });
          if (insertError) console.error('Session persistence failed:', insertError);
        }
      }
    } catch (err) {
      console.error('Auth sync boundary context error:', err);
    }
    setScreen('result');
  }

  function handleNextLevel() {
    const next = LEVELS.find(l => l.id === levelId + 1);
    if (next) handleStart(subject, grade, next.id);
  }

  function handleBack() { router.push('/parent/funhub'); }

  if (screen === 'lobby') return <LobbyScreen onStart={handleStart} />;
  if (screen === 'loading') return <LoadingScreen text="Blowing up physics helium balloons..." />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return <GameScreen questions={questions} allQuestions={allQuestions} levelConfig={levelConfig} onFinish={handleFinish} />;
  if (screen === 'result') return <ResultScreen result={gameResult} levelConfig={levelConfig} xpEarned={xpEarned} onReplay={() => handleStart(subject, grade, levelId)} onNextLevel={handleNextLevel} onBack={handleBack} />;
  return null;
}
