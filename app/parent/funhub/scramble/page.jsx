'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const INDIGO = '#4f46e5';
const INDIGO_DARK = '#4338ca';
const AMBER = '#f59e0b';
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

function getCorrectWord(row) {
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
  const text = optMap[lookupKey] ?? row.correct ?? '';
  return text.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
}

function LoadingScreen({ text }) {
  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #e0e7ff', borderTopColor: INDIGO, animation: 'spin 0.8s linear infinite' }} />
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
      <button onClick={onBack} style={{ padding: '14px 32px', borderRadius: 16, border: 'none', background: INDIGO, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>← Back to FunHub</button>
    </div>
  );
}

function LobbyScreen({ onStart }) {
  const [subject, setSubject] = useState('Maths');
  const [grade, setGrade] = useState(4);
  const [pressed, setPressed] = useState(false);

  const chipStyle = (active) => ({
    padding: '8px 14px', borderRadius: 99,
    border: `2px solid ${active ? INDIGO : '#e5e7eb'}`,
    background: active ? '#e0e7ff' : '#fff',
    color: active ? INDIGO : '#374151',
    fontWeight: active ? 700 : 500, fontSize: 14,
    cursor: 'pointer', transition: 'all 0.15s ease',
    transform: active ? 'scale(1.04)' : 'scale(1)',
  });

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>🔤</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: INDIGO, margin: 0, letterSpacing: '-0.5px' }}>Word Scramble</h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>Unscramble Terms & Master Vocabulary</p>
      </div>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, padding: '24px 20px', border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(79,70,229,0.06)', display: 'flex', flexDirection: 'column', gap: 22 }}>
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
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressed ? 'scale(0.96)' : 'scale(1)', transition: 'all 0.15s ease', boxShadow: '0 4px 16px rgba(79,70,229,0.25)' }}
        >START WORD GAME →</button>
      </div>
    </div>
  );
}

function GameScreen({ puzzles, subject, grade, onFinish }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [scrambledLetters, setScrambledLetters] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState(false);

  const timeRef = useRef(0);
  const currentPuzzle = puzzles[currentIdx];

  useEffect(() => {
    if (currentPuzzle) {
      const letters = currentPuzzle.word.replace(/\s/g, '').split('');
      let shuffled = shuffle(letters);
      while (shuffled.join('') === currentPuzzle.word.replace(/\s/g, '') && letters.length > 1) {
        shuffled = shuffle(letters);
      }
      setScrambledLetters(shuffled.map((char, index) => ({ id: index, char })));
      setSelectedIndices([]);
    }
  }, [currentIdx, puzzles]);

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

  function handleTileClick(tileIndex) {
    if (selectedIndices.includes(tileIndex)) return;
    const nextSelected = [...selectedIndices, tileIndex];
    setSelectedIndices(nextSelected);

    const cleanWordLength = currentPuzzle.word.replace(/\s/g, '').length;
    if (nextSelected.length === cleanWordLength) {
      const userGuess = nextSelected.map(idx => scrambledLetters[idx].char).join('');
      const targetWord = currentPuzzle.word.replace(/\s/g, '');

      if (userGuess === targetWord) {
        const nextScore = score + 1;
        setScore(nextScore);

        if (currentIdx + 1 >= puzzles.length) {
          setTimeout(() => {
            onFinish({ timeTaken: timeRef.current, solvedCount: nextScore, totalWords: puzzles.length });
          }, 400);
        } else {
          setTimeout(() => {
            setCurrentIdx(prev => prev + 1);
          }, 400);
        }
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setSelectedIndices([]);
        }, 500);
      }
    }
  }

  function handleRemoveTile(positionIndex) {
    const nextSelected = [...selectedIndices];
    nextSelected.splice(positionIndex, 1);
    setSelectedIndices(nextSelected);
  }

  function handleClear() {
    setSelectedIndices([]);
  }

  function handleSkip() {
    if (currentIdx + 1 >= puzzles.length) {
      onFinish({ timeTaken: timeRef.current, solvedCount: score, totalWords: puzzles.length });
    } else {
      setCurrentIdx(prev => prev + 1);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: INDIGO, fontSize: 15 }}>🔤 Word Scramble</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Word {currentIdx + 1} of {puzzles.length}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', padding: '12px 16px', borderRadius: 16, border: '1px solid #e5e7eb' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Timer</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: INDIGO }}>{formatTime(time)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Score</span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{score} XP</p>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: AMBER, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CLUE / HINT</span>
          <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 700, color: '#374151', lineHeight: 1.45 }}>{currentPuzzle?.clue}</p>
        </div>

        <div className={shake ? 'shake-anim' : ''} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', minHeight: 52, padding: '12px 0', borderBottom: '2px dashed #cbd5e1', alignItems: 'center' }}>
          {currentPuzzle?.word.split('').map((char, index) => {
            if (char === ' ') {
              return <div key={`space-${index}`} style={{ width: 16 }} />;
            }
            const letterPos = currentPuzzle.word.substring(0, index).replace(/ /g, '').length;
            const selectedTileIdx = selectedIndices[letterPos];
            const displayChar = selectedTileIdx !== undefined ? scrambledLetters[selectedTileIdx]?.char : '';

            return (
              <div
                key={`slot-${index}`}
                onClick={() => selectedTileIdx !== undefined && handleRemoveTile(letterPos)}
                style={{
                  width: 38, height: 44, borderRadius: 10,
                  background: displayChar ? '#eff6ff' : '#fff',
                  border: `2px solid ${displayChar ? INDIGO : '#cbd5e1'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: INDIGO, cursor: displayChar ? 'pointer' : 'default',
                  boxShadow: displayChar ? '0 2px 6px rgba(79,70,229,0.1)' : 'none',
                  transition: 'all 0.1s ease'
                }}
              >{displayChar}</div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', padding: '10px 0' }}>
          {scrambledLetters.map((tile, idx) => {
            const isUsed = selectedIndices.includes(idx);
            return (
              <button
                key={tile.id}
                disabled={isUsed}
                onClick={() => handleTileClick(idx)}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: 'none',
                  background: isUsed ? '#e5e7eb' : `linear-gradient(135deg, ${INDIGO}, ${INDIGO_DARK})`,
                  color: isUsed ? '#9ca3af' : '#fff',
                  fontSize: 18, fontWeight: 800, cursor: isUsed ? 'default' : 'pointer',
                  boxShadow: isUsed ? 'none' : '0 4px 10px rgba(79,70,229,0.2)',
                  transform: isUsed ? 'scale(0.9)' : 'scale(1)',
                  transition: 'all 0.15s ease'
                }}
              >{tile.char}</button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <button
            onClick={handleClear}
            style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: '2px solid #cbd5e1', background: '#fff', color: '#6b7280', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >🗑️ Clear</button>
          <button
            onClick={handleSkip}
            style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', background: '#f3f4f6', color: '#374151', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >⏭️ Skip Word</button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>{subject} · Grade {grade}</span>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .shake-anim { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}

function ResultScreen({ result, subject, grade, onReplay, onBack, xpEarned }) {
  const [pressedR, setPressedR] = useState(false);
  const [pressedB, setPressedB] = useState(false);

  const starRating = result.solvedCount === result.totalWords ? 3 : result.solvedCount >= Math.floor(result.totalWords / 2) ? 2 : 1;

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
          <div style={{ fontSize: 44, marginBottom: 6 }}>{'⭐'.repeat(starRating)}</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 26, fontWeight: 900, color: '#1f2937' }}>Scramble Finished!</h1>
          <p style={{ margin: 0, color: '#6b7280', fontWeight: 500, fontSize: 14 }}>{subject} · Grade {grade}</p>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_DARK})`, borderRadius: 20, padding: '20px 0', textAlign: 'center', boxShadow: '0 6px 24px rgba(79,70,229,0.2)' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#c7d2fe', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Solved</p>
          <p style={{ margin: '4px 0 0', fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{result.solvedCount} / {result.totalWords}</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {statBox('Time Taken', `${Math.floor(result.timeTaken / 60)}:${result.timeTaken % 60 < 10 ? '0' : ''}${result.timeTaken % 60}`, INDIGO)}
          {statBox('XP Awarded', `+${xpEarned}`, '#16a34a')}
        </div>

        <button
          onPointerDown={() => setPressedR(true)} onPointerUp={() => setPressedR(false)} onPointerLeave={() => setPressedR(false)}
          onClick={onReplay}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_DARK})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', transform: pressedR ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease', boxShadow: '0 4px 16px rgba(79,70,229,0.25)' }}
        >🔤 Play Again</button>
        <button
          onPointerDown={() => setPressedB(true)} onPointerUp={() => setPressedB(false)} onPointerLeave={() => setPressedB(false)}
          onClick={onBack}
          style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: `2px solid ${INDIGO}`, background: '#fff', color: INDIGO, fontSize: 16, fontWeight: 700, cursor: 'pointer', transform: pressedB ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.1s ease' }}
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
  const [puzzles, setPuzzles] = useState([]);
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
        setErrorMsg(`No available spelling terms matching ${sub} for Grade ${gr}. Try another subject deck combo.`);
        setScreen('error');
        return;
      }

      const processed = data.map(row => {
        const cleanWord = getCorrectWord(row);
        return {
          clue: row.question_text || row.question || 'Spell the matching term correctly.',
          word: cleanWord
        };
      }).filter(p => p.word.length >= 3 && p.word.length <= 15);

      if (processed.length === 0) {
        setErrorMsg('The matching definitions contain answers too long or short to properly scramble. Try another filter!');
        setScreen('error');
        return;
      }

      setPuzzles(processed);
      setScreen('game');
    } catch {
      setErrorMsg('Could not fetch glossary files. Verify system network links.');
      setScreen('error');
    }
  }

  async function handleFinish(result) {
    const baseXP = result.solvedCount * 25;
    const completionBonus = result.solvedCount === result.totalWords ? 50 : 10;
    const totalXP = baseXP + completionBonus;
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
            game_slug: 'word-scramble',
            subject,
            grade,
            score: totalXP,
            xp_earned: totalXP,
            correct: result.solvedCount,
            total: result.totalWords,
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
  if (screen === 'loading') return <LoadingScreen text="Jumbling character strings..." />;
  if (screen === 'error') return <ErrorScreen message={errorMsg} onBack={handleBack} />;
  if (screen === 'game') return <GameScreen puzzles={puzzles} subject={subject} grade={grade} onFinish={handleFinish} />;
  if (screen === 'result') return <ResultScreen result={gameResult} subject={subject} grade={grade} xpEarned={xpEarned} onReplay={() => handleStart(subject, grade)} onBack={handleBack} />;
  return null;
}
