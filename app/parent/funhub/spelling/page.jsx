'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const AMBER = '#d97706';
const AMBER_DARK = '#b45309';
const BG = '#fef3c7';

const SUBJECTS = ['English', 'General'];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getTargetWord(row) {
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
  return (optMap[key] ?? row.correct ?? '').toUpperCase().replace(/[^A-Z]/g, '').trim();
}

function LoadingScreen({ text }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #fde68a', borderTopColor: AMBER, animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: AMBER_DARK, fontWeight: 600, fontSize: 15 }}>{text}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function ErrorScreen({ message, onBack }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>🐝</div>
      <h2 style={{ color: AMBER_DARK, fontWeight: 800, margin: 0 }}>Oh Honey!</h2>
      <p style={{ color: '#78350f', fontSize: 15, maxWidth: 300 }}>{message}</p>
      <button onClick={onBack} style={{ padding: '14px 32px', borderRadius: 16, border: 'none', background: AMBER, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Back to FunHub</button>
    </div>
  );
}

function LobbyScreen({ onStart }) {
  const [subject, setSubject] = useState('English');
  const [grade, setGrade] = useState(4);
  const [pressed, setPressed] = useState(false);

  const chipStyle = (active) => ({
    padding: '8px 14px', borderRadius: 99,
    border: `2px solid ${active ? AMBER : '#e5e7eb'}`,
    background: active ? '#fef3c7' : '#fff',
    color: active ? AMBER_DARK : '#374151',
    fontWeight: active ? 700 : 500, fontSize: 14,
    cursor: 'pointer', transition: 'all 0.15s ease',
    transform: active ? 'scale(1.04)' : 'scale(1)',
  });

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>🐝</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: AMBER_DARK, margin: 0, letterSpacing: '-0.5px' }}>Spelling Bee</h1>
        <p style={{ color: '#78350f', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>Listen, Think, and Construct the Word</p>
      </div>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '24px 20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(217,119,6,0.06)', display: 'flex', flexDirection: 'column', gap: 22 }}>
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
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${AMBER}, ${AMBER_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressed ? 'scale(0.96)' : 'scale(1)', transition: 'all 0.15s ease', boxShadow: '0 4px 16px rgba(217,119,6,0.25)' }}
        >START SPELLING →</button>
      </div>
    </div>
  );
}

function GameScreen({ questions, subject, grade, onFinish }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentGuess, setCurrentGuess] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [answerStatus, setAnswerStatus] = useState(null);
  const [time, setTime] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const timeRef = useRef(0);
  const currentQuestion = questions[currentIdx];
  
  const targetWord = getTargetWord(currentQuestion);
  const clues = currentQuestion?.question_text || currentQuestion?.question || 'Listen closely to the phonetic structures to form your word answer.';

  useEffect(() => {
    setCurrentGuess('');
    setAnswerStatus(null);
    setIsTransitioning(false);
    if (targetWord) {
      speakWord(targetWord);
    }
  }, [currentIdx, questions, targetWord]);

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

  function speakWord(wordStr) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(wordStr.toLowerCase());
      utterance.rate = 0.85;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function handleKeyPress(char) {
    if (isTransitioning) return;
    if (currentGuess.length < targetWord.length) {
      setCurrentGuess(prev => prev + char);
    }
  }

  function handleBackspace() {
    if (isTransitioning) return;
    setCurrentGuess(prev => prev.slice(0, -1));
  }

  function handleSubmit() {
    if (isTransitioning || !currentGuess) return;
    setIsTransitioning(true);

    const isCorrect = currentGuess.trim() === targetWord;
    setAnswerStatus(isCorrect ? 'correct' : 'wrong');

    let nextCorrect = correctCount;
    if (isCorrect) {
      nextCorrect += 1;
      setCorrectCount(nextCorrect);
    }

    setTimeout(() => {
      if (currentIdx + 1 >= questions.length) {
        onFinish({ timeTaken: timeRef.current, correctCount: nextCorrect, totalQuestions: questions.length });
      } else {
        setCurrentIdx(prev => prev + 1);
      }
    }, 1500);
  }

  const rows = [['Q','W','E','R','T','Y','U','I','O','P'], ['A','S','D','F','G','H','J','K','L'], ['Z','X','C','V','B','N','M']];

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', padding: '12px 16px', borderRadius: 16, border: '1px solid #fde68a' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Timer</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: AMBER_DARK }}>{formatTime(time)}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Word</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1f2937' }}>{currentIdx + 1} / {questions.length}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Score</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{correctCount * 25} XP</p>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 24, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <button 
            onClick={() => speakWord(targetWord)}
            disabled={isSpeaking}
            style={{ padding: '12px 24px', borderRadius: 99, background: '#fffbeb', border: `2px solid ${AMBER}`, color: AMBER_DARK, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transform: isSpeaking ? 'scale(0.98)' : 'scale(1)', opacity: isSpeaking ? 0.7 : 1, transition: 'all 0.1s ease' }}
          >
            <span>{isSpeaking ? '🔊 Speaking...' : '📢 Pronounce Word'}</span>
          </button>
          
          <p style={{ margin: 0, fontSize: 13, color: '#78350f', fontWeight: 600, fontStyle: 'italic', lineHeight: 1.4 }}>
            Clue: {clues}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, minHeight: 46, padding: '12px 0' }}>
          {Array.from({ length: targetWord.length || 1 }).map((_, i) => {
            const char = currentGuess[i] || '';
            let boxBg = '#fff';
            let boxBorder = '2px solid #e5e7eb';
            let boxColor = '#1f2937';

            if (answerStatus === 'correct') {
              boxBg = '#dcfce7'; boxBorder = '2px solid #16a34a'; boxColor = '#15803d';
            } else if (answerStatus === 'wrong') {
              boxBg = '#fee2e2'; boxBorder = '2px solid #dc2626'; boxColor = '#991b1b';
            } else if (char) {
              boxBg = '#fffbeb'; boxBorder = `2px solid ${AMBER}`;
            }

            return (
              <div key={i} style={{ width: 32, height: 42, background: boxBg, border: boxBorder, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: boxColor, transition: 'all 0.15s ease' }}>
                {char}
              </div>
            );
          })}
        </div>

        <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 24, padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((row, rIdx) => (
            <div key={rIdx} style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {row.map((char) => (
                <button
                  key={char}
                  disabled={isTransitioning}
                  onClick={() => handleKeyPress(char)}
                  style={{ flex: 1, maxWidth: 42, height: 40, background: '#f3f4f6', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 800, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >{char}</button>
              ))}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              disabled={isTransitioning}
              onClick={handleBackspace}
              style={{ flex: 1, height: 42, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >⌫ DELETE</button>
            <button
              disabled={isTransitioning || !currentGuess}
              onClick={handleSubmit}
              style={{ flex: 2, height: 42, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >SUBMIT WORD ✓</button>
          </div>
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
    <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 10px', textAlign: 'center', border: '1px solid #fde68a' }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#78350f', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>{'⭐'.repeat(stars)}</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 26, fontWeight: 900, color: '#78350f' }}>Session Complete!</h1>
          <p style={{ margin: 0, color: '#b45309', fontWeight: 500, fontSize: 14 }}>{subject} · Grade {grade}</p>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${AMBER}, ${AMBER_DARK})`, borderRadius: 20, padding: '20px 0', textAlign: 'center', boxShadow: '0 6px 24px rgba(217,119,6,0.2)' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#fef3c7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Spelled Correctly</p>
          <p style={{ margin: '4px 0 0', fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{result.correctCount} / {total}</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {statBox('Duration', `${Math.floor(result.timeTaken / 60)}:${result.timeTaken % 60 < 10 ? '0' : ''}${result.timeTaken % 60}`, AMBER_DARK)}
          {statBox('XP Earned', `+${xpEarned}`, '#16a34a')}
        </div>

        <button
          onPointerDown={() => setPressedR(true)} onPointerUp={() => setPressedR(false)} onPointerLeave={() => setPressedR(false)}
          onClick={onReplay}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${AMBER}, ${AMBER_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressedR ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease', boxShadow: '0 4px 16px rgba(217,119,6,0.25)' }}
        >🐝 Spell More Words</button>
        <button
          onPointerDown={() => setPressedB(true)} onPointerUp={() => setPressedB(false)} onPointerLeave={() => setPressedB(false)}
          onClick={onBack}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: `2px solid ${AMBER}`, background: '#fff', color: AMBER_DARK, fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: pressedB ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease' }}
        >← Back to FunHub</button>
      </div>
    </div>
  );
}

export default function SpellingBeeGame() {
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
      if (!data || data.length === 0) {
        setErrorMsg(`No word banks found matching ${sub} for Grade ${gr}. Try English or General standard modules!`);
        setScreen('error');
        return;
      }

      setQuestions(shuffle(data));
      setScreen('game');
    } catch {
      setErrorMsg('Could not establish data link stream. Check configuration settings.');
      setScreen('error');
    }
  }

  async function handleFinish(result) {
    const accuracy = result.correctCount / result.totalQuestions;
    const baseXP = result.correctCount * 25;
    const bonusXP = accuracy === 1 ? 50 : accuracy >= 0.5 ? 20 : 0;
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
            game_slug: 'spelling-bee',
            subject,
            grade,
            score: totalXP,
            xp_earned: totalXP,
            correct: result.correctCount,
            total: result.totalQuestions,
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
  if (screen === 'loading') return <LoadingScreen text="Gathering sweet word vectors..." />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return <GameScreen questions={questions} subject={subject} grade={grade} onFinish={handleFinish} />;
  if (screen === 'result') return <ResultScreen result={gameResult} subject={subject} grade={grade} xpEarned={xpEarned} onReplay={() => handleStart(subject, grade)} onBack={handleBack} />;
  return null;
}
