"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase'
import { saveFunHubSession } from '@/lib/useFunHubSession';

const LEVELS = [
  { id: 1, label: 'Level 1: Beginner', pairs: 4, xpPerPair: 20, timer: null, title: 'Warm Up' },
  { id: 2, label: 'Level 2: Scholar',  pairs: 6, xpPerPair: 20, timer: 90,   title: 'Speed Matching' },
  { id: 3, label: 'Level 3: Master',   pairs: 8, xpPerPair: 25, timer: 60,   title: 'Grandmaster Grid' }
];

const DEFAULT_LEVEL_FALLBACK = LEVELS[0];

function shuffleArray(array: any[]) {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

// 1. ISOLATE CORE GAME RUNTIME ENGINE
function MemoryMatchGameCore() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get('subject') || 'Maths';
  const grade = parseInt(searchParams.get('grade') || '3', 10);
  const explicitLevelId = parseInt(searchParams.get('level') || '1', 10);

  const [levelId, setLevelId] = useState(explicitLevelId);
  const [gameState, setGameState] = useState('LOBBY'); // 'LOBBY' | 'PLAYING' | 'RESULT'
  const [gameCards, setGameCards] = useState<any[]>([]);
  const [gameInstanceId, setGameInstanceId] = useState('');
  const [finalResult, setFinalResult] = useState<any | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  const levelConfig = useMemo(() => {
    return LEVELS.find(l => l.id === levelId) || DEFAULT_LEVEL_FALLBACK;
  }, [levelId]);

  async function initializeGameSession(targetSubject: string, targetGrade: number, targetLevelId: number) {
    try {
      setDbLoading(true);
      
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('subject', targetSubject)
        .eq('grade', targetGrade);

      if (error || !data || data.length === 0) {
        alert('No questions found for this configuration. Loading backup dataset...');
        setDbLoading(false);
        return;
      }

      const generatedPairs = [];
      let uniqueIdCounter = 0;

      const itemsWithAnswers = data.filter(q => q.question_text && q.correct_answer);
      const shuffledSource = shuffleArray(itemsWithAnswers);

      for (const item of shuffledSource) {
        if (generatedPairs.length >= levelConfig.pairs) break;
        
        const currentPairId = `pair_${uniqueIdCounter++}`;
        generatedPairs.push(
          { id: `${currentPairId}_q`, pairId: currentPairId, content: item.question_text, type: 'QUESTION' },
          { id: `${currentPairId}_a`, pairId: currentPairId, content: item.correct_answer, type: 'ANSWER' }
        );
      }

      if (generatedPairs.length < levelConfig.pairs * 2) {
        alert('Insufficient valid matching data blocks present for this module config.');
        setDbLoading(false);
        return;
      }

      setGameCards(shuffleArray(generatedPairs));
      setGameInstanceId(`${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
      setGameState('PLAYING');
    } catch (err) {
      console.error('Fatal initialization halt during match parsing:', err);
    } finally {
      setDbLoading(false);
    }
  }

  async function commitSessionResults(payload: any) {
    setDbLoading(true);
    setFinalResult(payload);
    setGameState('RESULT');

    try {
      await saveFunHubSession({
        game_slug: `memory-match-l${levelConfig.id}`,
        subject:   subject,
        grade:     grade,
        score:     payload.xpEarned,
        xp_earned: payload.xpEarned,
        correct:   payload.matchedPairsCount,
        total:     levelConfig.pairs,
      });
    } catch (err) {
      console.error('Failed to commit results transactionally to cloud registry:', err);
    } finally {
      setDbLoading(false);
    }
  }

  if (gameState === 'LOBBY') {
    return (
      <div style={{ padding: 20, textAlign: 'center', fontFamily: 'inherit' }}>
        <h2 style={{ fontWeight: 900, color: '#1e1b4b' }}>🧠 Memory Match</h2>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Select your target challenge tier:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
          {LEVELS.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => { setLevelId(l.id); }}
              style={{
                padding: '14px 16px', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: 13,
                border: levelId === l.id ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                background: levelId === l.id ? '#f3e8ff' : '#fff',
                color: levelId === l.id ? '#7c3aed' : '#374151',
                textAlign: 'left',
                outline: 'none'
              }}
            >
              <div>{l.label}</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', marginTop: 2 }}>
                {l.pairs} pairs · {l.timer ? `${l.timer}s limit` : 'No time limit'}
              </div>
            </button>
          ))}
          <button
            type="button"
            disabled={dbLoading}
            onClick={() => initializeGameSession(subject, grade, levelId)}
            style={{
              marginTop: 10, padding: 14, background: '#7c3aed', color: '#fff', borderRadius: 14,
              border: 'none', fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,0.2)',
              outline: 'none'
            }}
          >
            {dbLoading ? 'Preparing Grid Data...' : 'START GAME PLAYGROUND'}
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'PLAYING') {
    return (
      <GameScreen
        key={gameInstanceId}
        cards={gameCards}
        levelConfig={levelConfig}
        onFinish={commitSessionResults}
      />
    );
  }

  if (gameState === 'RESULT' && finalResult) {
    const nextLevelAvailable = LEVELS.find(l => l.id === levelConfig.id + 1);
    const isPerfect = finalResult.matchedPairsCount === levelConfig.pairs;

    return (
      <div style={{ padding: 24, textTransform: 'none', textAlign: 'center', fontFamily: 'inherit' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>{isPerfect ? '👑' : '⏰'}</div>
        <h3 style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: 0 }}>
          {isPerfect ? 'Level Completed Perfect!' : 'Time Ran Out!'}
        </h3>
        
        <div style={{ background: '#f9fafb', borderRadius: 16, padding: 16, margin: '20px 0', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <span style={{ color: '#6b7280', fontWeight: 600 }}>Pairs Matched:</span>
            <span style={{ fontWeight: 800, color: '#111827' }}>{finalResult.matchedPairsCount} / {levelConfig.pairs}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <span style={{ color: '#6b7280', fontWeight: 600 }}>Total Flips:</span>
            <span style={{ fontWeight: 800, color: '#111827' }}>{finalResult.totalMoves} moves</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
            <span style={{ color: '#7c3aed', fontWeight: 700 }}>XP Tokens Earned:</span>
            <span style={{ fontWeight: 900, color: '#7c3aed' }}>+ {finalResult.xpEarned} XP</span>
          </div>
        </div>

        {!isPerfect && (
          <p style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700, margin: '12px 0', background: '#fef2f2', padding: '10px', borderRadius: 10 }}>
            ⚠️ Complete all {levelConfig.pairs} card pairs before time expires to advance!
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 280, margin: '0 auto' }}>
          {isPerfect && nextLevelAvailable ? (
            <button
              type="button"
              onClick={() => {
                setLevelId(nextLevelAvailable.id);
                initializeGameSession(subject, grade, nextLevelAvailable.id);
              }}
              style={{
                padding: 14, background: '#059669', color: '#fff', border: 'none', borderRadius: 12,
                fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.2)', outline: 'none'
              }}
            >
              ADVANCE TO LEVEL {nextLevelAvailable.id} →
            </button>
          ) : isPerfect && !nextLevelAvailable ? (
            <div style={{ fontSize: 12, color: '#059669', fontWeight: 800, margin: '6px 0' }}>🎉 Grandmaster tier fully complete!</div>
          ) : null}

          <button
            type="button"
            onClick={() => initializeGameSession(subject, grade, levelConfig.id)}
            style={{ padding: 14, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, cursor: 'pointer', outline: 'none' }}
          >
            RETRY THIS LEVEL
          </button>

          <button
            type="button"
            onClick={() => router.push('/parent/funhub')}
            style={{ padding: 14, background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', borderRadius: 12, fontWeight: 800, cursor: 'pointer', outline: 'none' }}
          >
            RETURN TO HUB
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// 2. INNER CARD MATRIX MONITOR VIEW SCREEN
function GameScreen({ cards, levelConfig, onFinish }: { cards: any[], levelConfig: any, onFinish: (p: any) => void }) {
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(levelConfig.timer || 0);
  const [timedOut, setTimedOut] = useState(false);

  const lockGridRef = useRef(false);
  const onFinishExecutedRef = useRef(false);
  const timerRef = useRef<any>(null);

  const totalPairsCount = useMemo(() => cards.length / 2, [cards]);

  const cols = useMemo(() => {
    if (totalPairsCount <= 4) return 'repeat(2, 1fr)';
    if (totalPairsCount <= 6) return 'repeat(3, 1fr)';
    return 'repeat(4, 1fr)';
  }, [totalPairsCount]);

  useEffect(() => {
    if (levelConfig.timer === null) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimedOut(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [levelConfig.timer]);

  // FIXED: Properly bound callback reference tracking hooks safely to avoid crash loops
  const executeTerminalStateFlush = useCallback((overrideTimedOut = false) => {
    if (onFinishExecutedRef.current) return;
    onFinishExecutedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);

    const activeTimeoutFlag = overrideTimedOut || timedOut;
    const finalMatchedCount = matchedPairIds.length;
    
    let calculatedRewardXp = finalMatchedCount * levelConfig.xpPerPair;
    if (!activeTimeoutFlag && finalMatchedCount === totalPairsCount) {
      const efficiencyBonus = Math.max(0, (totalPairsCount * 2 + 4 - moves) * 5);
      calculatedRewardXp += efficiencyBonus;
    }

    onFinish({
      matchedPairsCount: finalMatchedCount,
      totalMoves: moves,
      xpEarned: calculatedRewardXp,
      hasTimedOut: activeTimeoutFlag
    });
  }, [timedOut, matchedPairIds, moves, levelConfig, totalPairsCount, onFinish]);

  useEffect(() => {
    if (cards.length > 0 && matchedPairIds.length === totalPairsCount) {
      const delayVictoryTrigger = setTimeout(() => {
        executeTerminalStateFlush(false);
      }, 500);
      return () => clearTimeout(delayVictoryTrigger);
    } else {
      return undefined;
    }
  }, [matchedPairIds, totalPairsCount, cards.length, executeTerminalStateFlush]);

  useEffect(() => {
    if (timedOut) {
      executeTerminalStateFlush(true);
    }
  }, [timedOut, executeTerminalStateFlush]);

  function handleCardFlipSelection(idx: number) {
    if (lockGridRef.current || timedOut) return;
    if (flippedIndices.includes(idx) || matchedPairIds.includes(cards[idx].pairId)) return;

    const nextFlipped = [...flippedIndices, idx];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      lockGridRef.current = true;
      setMoves(m => m + 1);

      const [firstIdx, secondIdx] = nextFlipped;
      const isMatch = cards[firstIdx].pairId === cards[secondIdx].pairId;

      if (isMatch) {
        setMatchedPairIds(prev => [...prev, cards[firstIdx].pairId]);
        setFlippedIndices([]);
        lockGridRef.current = false;
      } else {
        setTimeout(() => {
          setFlippedIndices([]);
          lockGridRef.current = false;
        }, 1000);
      }
    }
  }

  const timerPercentage = levelConfig.timer ? (timeLeft / levelConfig.timer) * 100 : 100;

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: '0 auto', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, background: '#7c3aed', color: '#fff', padding: '3px 8px', borderRadius: 6, fontWeight: 800 }}>
            {levelConfig.title.toUpperCase()}
          </span>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginTop: 4 }}>Flips: {moves}</div>
        </div>
        {levelConfig.timer && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: timeLeft <= 10 ? '#dc2626' : '#111827' }}>⏱️ {timeLeft}s</div>
            <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700 }}>REMAINING</div>
          </div>
        )}
      </div>

      {levelConfig.timer && (
        <div style={{ background: '#e5e7eb', height: 6, borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{
            width: `${timerPercentage}%`, height: '100%',
            background: timeLeft <= 10 ? '#dc2626' : '#7c3aed',
            transition: 'width 1s linear'
          }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, width: '100%' }}>
        {cards.map((card, idx) => {
          const isFlipped = flippedIndices.includes(idx);
          const isMatched = matchedPairIds.includes(card.pairId);
          const showContent = isFlipped || isMatched;

          return (
            <button
              key={card.id}
              type="button"
              disabled={showContent || timedOut}
              onClick={() => handleCardFlipSelection(idx)}
              style={{
                aspectRatio: '1/1', borderRadius: 14, cursor: showContent ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: showContent ? 10 : 20, fontWeight: 800,
                border: isMatched ? '1.5px solid #10b981' : isFlipped ? '1.5px solid #7c3aed' : '1px solid #d1d5db',
                background: isMatched ? '#ecfdf5' : isFlipped ? '#fff' : 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
                color: isMatched ? '#065f46' : '#111827',
                padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: showContent ? 'none' : '0 4px 8px rgba(124,58,237,0.15)',
                wordBreak: 'break-word', transition: 'all 0.15s ease', outline: 'none'
              }}
            >
              {showContent ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                  <span style={{ fontSize: 7, fontWeight: 900, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {card.type}
                  </span>
                  <span style={{ lineHeight: 1.2 }}>{card.content}</span>
                </div>
              ) : (
                <span style={{ color: '#fff', opacity: 0.85 }}>❓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 3. MASTER ENTRY POINT WRAPPED WITH SUSPENSE BOUNDARY SAFEGUARDS
export default function SafeMemoryMatchPageWrapper() {
  return (
    <Suspense 
      fallback={
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 16px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ width: '28px', height: '28px', border: '3px solid #e5e7eb', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 1s infinite linear', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: '600' }}>Initializing FunHub Match Session...</p>
          <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}} />
        </div>
      }
    >
      <MemoryMatchGameCore />
    </Suspense>
  );
}
