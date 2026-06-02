"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const AMBER = '#d97706';
const AMBER_DARK = '#b45309';
const BG = '#fffbeb';

const SUBJECTS = ['Maths', 'English', 'Kiswahili', 'Science', 'General'];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function scrambleString(word) {
  const arr = word.toUpperCase().split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const scrambled = arr.join('');
  if (scrambled === word.toUpperCase() && arr.length > 1) {
    [arr[0], arr[1]] = [arr[1], arr[0]];
    return arr.join('');
  }
  return scrambled;
}

function getCorrectWord(row) {
  if (!row) return '';
  let opts = {};
  try {
    opts = typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || {});
  } catch { 
    opts = {}; 
  }
  const optMap = Array.isArray(opts) ? { A: opts[0], B: opts[1], C: opts[2], D: opts[3] } : opts;
  const key = String(row.correct || row.correct_option || '').toUpperCase().trim();
  return (optMap[key] ?? row.correct ?? '').trim();
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
      <div style={{ fontSize: 48 }}>🔤</div>
      <h2 style={{ color: AMBER_DARK, fontWeight: 800, margin: 0 }}>No Words Found</h2>
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
    cursor: 'pointer', transition: 'all 0.15s ease'
  });

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>🔤</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: AMBER_DARK, margin: 0, letterSpacing: '-0.5px' }}>Word Scramble</h1>
        <p style={{ color: '#78350f', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>Unscramble Letters to Build the Target Answer Word</p>
      </div>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '24px 20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(217,119,6,0.06)', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject Source</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUBJECTS.map(s => <button key={s} onClick={() => setSubject(s)} style={chipStyle(subject === s)}>{s}</button>)}
          </div>
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grade Tier</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GRADES.map(g => <button key={g} onClick={() => setGrade(g)} style={chipStyle(grade === g)}>Grade {g}</button>)}
          </div>
        </div>
        <button
          onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
          onClick={() => onStart(subject, grade)}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${AMBER}, ${AMBER_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressed ? 'scale(0.96)' : 'scale(1)', transition: 'all 0.15s ease', boxShadow: '0 4px 16px rgba(217,119,6,0.25)' }}
        >START UNSCRAMBLING →</button>
      </div>
    </div>
  );
}

function GameScreen({ questions, onFinish }) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null); 
  const [scrambled, setScrambled] = useState('');
  const [usedIndices, setUsedIndices] = useState([]);

  const currentQuestion = questions[index];
  const targetWord = getCorrectWord(currentQuestion);
  const clueText = currentQuestion?.question_text || currentQuestion?.question || 'Unscramble the character matrix.';

  useEffect(() => {
    if (targetWord) {
      setScrambled(scrambleString(targetWord));
    }
    setInput('');
    setFeedback(null);
    setUsedIndices([]);
  }, [index, targetWord]);

  function handleSubmissionCheck() {
    if (!input.trim() || feedback) return;

    const isCorrect = input.trim().toLowerCase() === targetWord.toLowerCase();
    let nextScore = score;

    if (isCorrect) {
      setFeedback('correct');
      nextScore += 1;
      setScore(nextScore);
    } else {
      setFeedback('wrong');
    }

    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex(index + 1);
      } else {
        onFinish({ totalQuestions: questions.length, correctAnswers: nextScore });
      }
    }, 1800);
  }

  function handleLetterTap(letter, tileIdx) {
    if (feedback || usedIndices.includes(tileIdx)) return;
    setInput(prev => prev + letter);
    setUsedIndices(prev => [...prev, tileIdx]);
  }

  function clearInput() {
    if (feedback) return;
    setInput('');
    setUsedIndices([]);
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: 16, border: '1px solid #fde68a' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4b5563' }}>Word {index + 1} of {questions.length}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: AMBER_DARK }}>✨ Score: {score}</span>
        </div>

        <div style={{ background: '#fff', borderRadius: 24, padding: '24px 20px', border: '1px solid #fde68a', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: AMBER_DARK, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scrambled Letters</p>
          
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
            {scrambled.split('').map((char, i) => {
              const isUsed = usedIndices.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => handleLetterTap(char, i)}
                  disabled={!!feedback || isUsed}
                  style={{ 
                    padding: '10px 16px', 
                    background: isUsed ? '#f3f4f6' : '#fff3c7', 
                    border: `2px solid ${isUsed ? '#e5e7eb' : '#fcd34d'}`, 
                    color: isUsed ? '#9ca3af' : AMBER_DARK, 
                    borderRadius: 12, 
                    fontSize: 20, 
                    fontWeight: 900, 
                    cursor: isUsed ? 'default' : 'pointer', 
                    transition: 'all 0.1s ease', 
                    transform: 'scale(1)',
                    opacity: isUsed ? 0.45 : 1
                  }}
                  onPointerDown={(e) => { if (!isUsed) e.currentTarget.style.transform = 'scale(0.9)'; }}
                  onPointerUp={(e) => { if (!isUsed) e.currentTarget.style.transform = 'scale(1)'; }}
                >{char}</button>
              );
            })}
          </div>

          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#4b5563', fontStyle: 'italic', lineHeight: 1.4 }}>Clue: "{clueText}"</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={input}
              readOnly
              disabled={!!feedback}
              placeholder="Tap letters above to answer..."
              autoFocus
              style={{ width: '100%', padding: '16px 54px 16px 16px', borderRadius: 16, border: `2px solid ${feedback === 'correct' ? '#10b981' : feedback === 'wrong' ? '#ef4444' : '#e5e7eb'}`, fontSize: 18, fontWeight: 700, textAlign: 'center', outline: 'none', background: feedback === 'correct' ? '#ecfdf5' : feedback === 'wrong' ? '#fef2f2' : '#fff', color: '#1f2937', transition: 'all 0.15s ease' }}
            />
            {input && !feedback && (
              <button 
                onClick={clearInput}
                style={{ position: 'absolute', right: 14, background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 28, height: 28, fontSize: 12, fontWeight: 700, color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            )}
          </div>

          {!feedback ? (
            <button
              type="button"
              onClick={handleSubmissionCheck}
              style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: AMBER, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
            >VERIFY WORD</button>
          ) : (
            <div style={{ padding: '14px 0', borderRadius: 16, textAlign: 'center', color: '#fff', fontWeight: 800, background: feedback === 'correct' ? '#10b981' : '#ef4444', fontSize: 15 }}>
              {feedback === 'correct' ? '🎉 Brilliant! Correct.' : `❌ Correct solution: ${targetWord.toUpperCase()}`}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function ResultScreen({ result, onReplay, onBack, xpEarned }) {
  const [pressedR, setPressedR] = useState(false);
  const [pressedB, setPressedB] = useState(false);

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#1f2937' }}>Scramble Master!</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontWeight: 500 }}>All words sorted successfully</p>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${AMBER}, ${AMBER_DARK})`, borderRadius: 20, padding: '24px 0', boxShadow: '0 6px 24px rgba(217,119,6,0.2)' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#fde68a', fontWeight: 700, textTransform: 'uppercase' }}>Correct Unscrambled Words</p>
          <p style={{ margin: '4px 0 0', fontSize: 44, fontWeight: 900, color: '#fff' }}>{result.correctAnswers} / {result.totalQuestions}</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '14px', border: '1px solid #fde68a' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#16a34a' }}>+{xpEarned}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: AMBER_DARK, fontWeight: 700, textTransform: 'uppercase' }}>Total XP Credited</p>
        </div>

        <button
          onPointerDown={() => setPressedR(true)} onPointerUp={() => setPressedR(false)} onPointerLeave={() => setPressedR(false)}
          onClick={onReplay}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${AMBER}, ${AMBER_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressedR ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease', boxShadow: '0 4px 16px rgba(217,119,6,0.25)' }}
        >🔤 Unscramble Another Set</button>
        <button
          onPointerDown={() => setPressedB(true)} onPointerUp={() => setPressedB(false)} onPointerLeave={() => setPressedB(false)}
          onClick={onBack}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: `2px solid ${AMBER}`, background: '#fff', color: AMBER_DARK, fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: pressedB ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease' }}
        >← Back to FunHub</button>
      </div>
    </div>
  );
}

export default function WordScrambleGame() {
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
        .limit(5);

      if (error) throw error;
      
      const cleanQuestions = (data || []).filter(row => getCorrectWord(row).length > 0);

      if (cleanQuestions.length === 0) {
        setErrorMsg(`No unscrambleable answer data metrics found for ${sub} Grade ${gr}. Try English or Science standard fields!`);
        setScreen('error');
        return;
      }

      setQuestions(cleanQuestions);
      setScreen('game');
    } catch {
      setErrorMsg('Could not fetch questions. Check network connection settings.');
      setScreen('error');
    }
  }

  async function handleFinish(result) {
    const gainedXp = result.correctAnswers * 25; 
    setXpEarned(gainedXp);
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
            game_slug: 'word-scramble',
            subject,
            grade,
            score: gainedXp,
            xp_earned: gainedXp,
            correct: result.correctAnswers,
            total: result.totalQuestions,
            completed: true,
          });
        }
      }
    } catch { /* Suppress silently */ }
    setScreen('result');
  }

  function handleBack() { router.push('/parent/funhub'); }

  if (screen === 'lobby') return <LobbyScreen onStart={handleStart} />;
  if (screen === 'loading') return <LoadingScreen text="Constructing scrambled matrix sets..." />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return <GameScreen questions={questions} onFinish={handleFinish} />;
  if (screen === 'result') return <ResultScreen result={gameResult} xpEarned={xpEarned} onReplay={() => handleStart(subject, grade)} onBack={handleBack} />;
  return null;
}
