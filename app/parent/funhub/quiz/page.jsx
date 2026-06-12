"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { saveFunHubSession } from '@/lib/useFunHubSession';

const CRIMSON = '#dc2626';
const CRIMSON_DARK = '#991b1b';
const BG = '#fff5f5';

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

function parseOptions(row) {
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

  return Object.keys(optMap).map(key => ({
    key,
    text: optMap[key],
    isCorrect: key === lookupKey
  })).filter(o => o.text);
}

function LoadingScreen({ text }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #fee2e2', borderTopColor: CRIMSON, animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#991b1b', fontWeight: 600, fontSize: 15 }}>{text}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function ErrorScreen({ message, onBack }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <h2 style={{ color: '#991b1b', fontWeight: 800, margin: 0 }}>Oops!</h2>
      <p style={{ color: '#7f1d1d', fontSize: 15, maxWidth: 300 }}>{message}</p>
      <button onClick={onBack} style={{ padding: '14px 32px', borderRadius: 16, border: 'none', background: CRIMSON, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Back to FunHub</button>
    </div>
  );
}

function LobbyScreen({ onStart }) {
  const [subject, setSubject] = useState('Maths');
  const [grade, setGrade] = useState(4);
  const [pressed, setPressed] = useState(false);

  const chipStyle = (active) => ({
    padding: '8px 14px', borderRadius: 99,
    border: `2px solid ${active ? CRIMSON : '#e5e7eb'}`,
    background: active ? '#fee2e2' : '#fff',
    color: active ? CRIMSON_DARK : '#374151',
    fontWeight: active ? 700 : 500, fontSize: 14,
    cursor: 'pointer', transition: 'all 0.15s ease',
    transform: active ? 'scale(1.04)' : 'scale(1)',
  });

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>⚡</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: CRIMSON_DARK, margin: 0, letterSpacing: '-0.5px' }}>Speed Quiz</h1>
        <p style={{ color: '#7f1d1d', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>Beat the Clock & Ace the Session</p>
      </div>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '24px 20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(220,38,38,0.06)', display: 'flex', flexDirection: 'column', gap: 22 }}>
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
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${CRIMSON}, ${CRIMSON_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressed ? 'scale(0.96)' : 'scale(1)', transition: 'all 0.15s ease', boxShadow: '0 4px 16px rgba(220,38,38,0.25)' }}
        >LAUNCH SPEED QUIZ →</button>
      </div>
    </div>
  );
}

function GameScreen({ questions, subject, grade, onFinish }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [options, setOptions] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [correctKey, setCorrectKey] = useState(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [correctCount, setCorrectCount] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const timeRef = useRef(0);
  const currentQuestion = questions[currentIdx];

  useEffect(() => {
    if (currentQuestion) {
      const parsed = parseOptions(currentQuestion);
      setOptions(shuffle(parsed));
      setSelectedKey(null);
      setCorrectKey(null);
      setTimeLeft(15);
      setIsTransitioning(false);
    }
  }, [currentIdx, questions]);

  useEffect(() => {
    const totalTimer = setInterval(() => {
      timeRef.current += 1;
    }, 1000);

    return () => clearInterval(totalTimer);
  }, []);

  useEffect(() => {
    if (isTransitioning) return;

    const questionTimer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(questionTimer);
          handleTimeOut();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(questionTimer);
  }, [currentIdx, isTransitioning]);

  function handleTimeOut() {
    setIsTransitioning(true);
    const correctOpt = options.find(o => o.isCorrect);
    if (correctOpt) setCorrectKey(correctOpt.key);

    setTimeout(() => {
      advanceGame(correctCount);
    }, 1200);
  }

  function advanceGame(currentScore) {
    if (currentIdx + 1 >= questions.length) {
      onFinish({ timeTaken: timeRef.current, correctCount: currentScore, totalQuestions: questions.length });
    } else {
      setCurrentIdx(prev => prev + 1);
    }
  }

  function handleOptionClick(opt) {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setSelectedKey(opt.key);

    const correctOpt = options.find(o => o.isCorrect);
    if (correctOpt) setCorrectKey(correctOpt.key);

    let nextCorrect = correctCount;
    if (opt.isCorrect) {
      nextCorrect += 1;
      setCorrectCount(nextCorrect);
    }

    setTimeout(() => {
      advanceGame(nextCorrect);
    }, 1200);
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', padding: '12px 16px', borderRadius: 16, border: '1px solid #fee2e2' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Time Left</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: timeLeft <= 5 ? CRIMSON : '#1f2937' }}>{timeLeft}s</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Progress</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1f2937' }}>{currentIdx + 1} / {questions.length}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Score</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{correctCount * 20} XP</p>
          </div>
        </div>

        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(timeLeft / 15) * 100}%`, background: timeLeft <= 5 ? CRIMSON : '#ef4444', transition: 'width 1s linear' }} />
        </div>

        <div style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: 24, padding: '24px 16px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1f2937', lineHeight: 1.45 }}>
            {currentQuestion?.question_text || currentQuestion?.question || 'Question Prompt'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {options.map((opt) => {
            const isSelected = selectedKey === opt.key;
            const isCorrectAnswer = correctKey === opt.key;
            
            let btnBg = '#fff';
            let btnBorder = '1px solid #e5e7eb';
            let btnColor = '#374151';

            if (isTransitioning) {
              if (isCorrectAnswer) {
                btnBg = '#dcfce7';
                btnBorder = '2px solid #16a34a';
                btnColor = '#15803d';
              } else if (isSelected) {
                btnBg = '#fee2e2';
                btnBorder = '2px solid #dc2626';
                btnColor = '#991b1b';
              }
            }

            return (
              <button
                key={opt.key}
                disabled={isTransitioning}
                onClick={() => handleOptionClick(opt)}
                style={{
                  width: '100%', padding: '16px', borderRadius: 16, background: btnBg, border: btnBorder, color: btnColor,
                  fontSize: 14, fontWeight: 700, textAlign: 'left', cursor: isTransitioning ? 'default' : 'pointer',
                  transition: 'all 0.15s ease', display: 'flex', gap: 12, alignItems: 'center'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: isCorrectAnswer ? '#16a34a' : isSelected ? '#dc2626' : '#f3f4f6', color: isCorrectAnswer || isSelected ? '#fff' : '#6b7280', fontSize: 12, fontWeight: 800 }}>
                  {opt.key}
                </span>
                <span style={{ flex: 1 }}>{opt.text}</span>
              </button>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>{subject} · Grade {grade}</span>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ result, subject, grade, onReplay, onBack, xpEarned }) {
  const [pressedR, setPressedR] = useState(false);
  const [pressedB, setPressedB] = useState(false);

  const total = result.totalQuestions;
  const stars = result.correctCount === total ? 3 : result.correctCount >= Math.floor(total / 2) ? 2 : 1;

  const statBox = (label, value, color = '#1f2937') => (
    <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 10px', textAlign: 'center', border: '1px solid #fee2e2' }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>{'⭐'.repeat(stars)}</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 26, fontWeight: 900, color: '#1f2937' }}>Quiz Completed!</h1>
          <p style={{ margin: 0, color: '#6b7280', fontWeight: 500, fontSize: 14 }}>{subject} · Grade {grade}</p>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${CRIMSON}, ${CRIMSON_DARK})`, borderRadius: 20, padding: '20px 0', textAlign: 'center', boxShadow: '0 6px 24px rgba(220,38,38,0.2)' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Accuracy Ratio</p>
          <p style={{ margin: '4px 0 0', fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{result.correctCount} / {total}</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {statBox('Duration', `${Math.floor(result.timeTaken / 60)}:${result.timeTaken % 60 < 10 ? '0' : ''}${result.timeTaken % 60}`, CRIMSON_DARK)}
          {statBox('XP Earned', `+${xpEarned}`, '#16a34a')}
        </div>

        <button
          onPointerDown={() => setPressedR(true)} onPointerUp={() => setPressedR(false)} onPointerLeave={() => setPressedR(false)}
          onClick={onReplay}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${CRIMSON}, ${CRIMSON_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressedR ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease', boxShadow: '0 4px 16px rgba(220,38,38,0.25)' }}
        >⚡ Play Again</button>
        <button
          onPointerDown={() => setPressedB(true)} onPointerUp={() => setPressedB(false)} onPointerLeave={() => setPressedB(false)}
          onClick={onBack}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: `2px solid ${CRIMSON}`, background: '#fff', color: CRIMSON_DARK, fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: pressedB ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease' }}
        >← Back to FunHub</button>
      </div>
    </div>
  );
}

export default function SpeedQuizGame() {
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
        .limit(10);

      if (error) throw error;
      if (!data || data.length === 0) {
        setErrorMsg(`No quiz entries found matching ${sub} for Grade ${gr}. Try another standard category!`);
        setScreen('error');
        return;
      }

      setQuestions(data);
      setScreen('game');
    } catch {
      setErrorMsg('Could not establish data link stream. Check configuration settings.');
      setScreen('error');
    }
  }

  async function handleFinish(result) {
    const accuracy = result.correctCount / result.totalQuestions;
    const baseXP = result.correctCount * 20;
    const bonusXP = accuracy === 1 ? 50 : accuracy >= 0.5 ? 20 : 0;
    const totalXP = baseXP + bonusXP;

    setXpEarned(totalXP);
    setGameResult(result);
    setScreen('loading');
    try {
      await saveFunHubSession({
        game_slug:     'speed-quiz',
        subject,
        grade,
        score:         totalXP,
        xp_earned:     totalXP,
        correct:       result.correctCount,
        total:         result.totalQuestions,
        duration_secs: result.timeTaken,
      });
    } catch { /* Fail silently */ }
    setScreen('result');
  }

  function handleBack() { router.push('/parent/funhub'); }

  if (screen === 'lobby') return <LobbyScreen onStart={handleStart} />;
  if (screen === 'loading') return <LoadingScreen text="Loading quick fire questions..." />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return <GameScreen questions={questions} subject={subject} grade={grade} onFinish={handleFinish} />;
  if (screen === 'result') return <ResultScreen result={gameResult} subject={subject} grade={grade} xpEarned={xpEarned} onReplay={() => handleStart(subject, grade)} onBack={handleBack} />;
  return null;
}
