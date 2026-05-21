'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const SYSTEM_GAMES_REGISTRY = [
  { slug: 'pop',      icon: '🎈', name: 'Balloon Pop',   subjects: ['Maths', 'English', 'Science', 'Kiswahili'], desc: 'Fast reactions & decoy evasion', color: '#a855f7', difficulty: 3 },
  { slug: 'quiz',     icon: '🧠', name: 'Quiz Blitz',    subjects: ['Maths'],                                    desc: '10 questions · 15s each',       color: '#4f46e5', difficulty: 3 },
  { slug: 'flash',    icon: '🃏', name: 'Flashcards',    subjects: ['English'],                                  desc: 'Flip & master terms',           color: '#0891b2', difficulty: 1 },
  { slug: 'math',     icon: '🔢', name: 'Math Sprint',   subjects: ['Maths'],                                    desc: '60s speed arithmetic',          color: '#059669', difficulty: 2 },
  { slug: 'scramble', icon: '🔤', name: 'Word Scramble', subjects: ['Kiswahili'],                                desc: 'Unscramble the word',          color: '#d97706', difficulty: 2 },
  { slug: 'match',    icon: '🧩', name: 'Memory Match',  subjects: ['Science'],                                  desc: 'Match terms & defs',            color: '#7c3aed', difficulty: 2 },
  { slug: 'spelling', icon: '🔊', name: 'Spelling Bee',  subjects: ['English'],                                  desc: 'Spell it right',                color: '#db2777', difficulty: 3 },
];

const FIXED_SUBJECT_FILTERS = ['All', 'Maths', 'English', 'Kiswahili', 'Science'];
const SUBJECT_ABBREVIATIONS = { Maths: 'MAT', English: 'ENG', Kiswahili: 'KISW', Science: 'SCI' };
const XP_PER_LEVEL = 500;
const REFRESH_THROTTLE_MS = 60000;

export default function FunHubPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('All');
  const [pressingId, setPressingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // 'AUTH' | 'NO_STUDENT' | null
  const [lastUpdatedText, setLastUpdatedText] = useState('');

  const lastFetchTimeRef = useRef(0);

  const [profile, setProfile] = useState({
    studentId: null,
    name: 'Student',
    grade: 3,
    totalXp: 0,
    currentLevel: 1,
    relativeXp: 0,
    xpPercent: 0,
    streak: 0,
    classRank: '—'
  });

  const [leaderboard, setLeaderboard] = useState([]);
  const [myLeaderboardRow, setMyLeaderboardRow] = useState(null);

  // Memoized layout calculation engine - completely decoupled from lifecycle hoisting anomalies
  const visibleGames = useMemo(() => {
    if (filter === 'All') return SYSTEM_GAMES_REGISTRY;
    return SYSTEM_GAMES_REGISTRY.filter(game => game.subjects.includes(filter));
  }, [filter]);

  const loadDynamicHubState = useCallback(async (forcedCall = false) => {
    const now = Date.now();
    if (!forcedCall && now - lastFetchTimeRef.current < REFRESH_THROTTLE_MS) {
      return; // Suppress redundant database roundtrips on tab switching
    }

    if (forcedCall) setLoading(true);

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        setErrorState('AUTH');
        setLoading(false);
        return;
      }

      const { data: studentRow, error: studentErr } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (studentErr || !studentRow) {
        setErrorState('NO_STUDENT');
        setLoading(false);
        return;
      }

      setErrorState(null);
      const studentId = studentRow.id;

      // Parallelization Step: Fetch matching classmate logs simultaneously
      const [classmatesResponse, sessionsResponse] = await Promise.all([
        supabase.from('students').select('id, first_name, last_name').eq('grade', studentRow.grade),
        supabase.from('funhub_sessions').select('student_id, xp_earned, created_at').eq('grade', studentRow.grade)
      ]);

      if (classmatesResponse.error || sessionsResponse.error || !classmatesResponse.data) {
        setLoading(false);
        return;
      }

      const classmates = classmatesResponse.data;
      const safeSessions = sessionsResponse.data || [];

      // Extract Current User Logs
      const mySessions = safeSessions.filter(s => s.student_id === studentId);
      const accruedXp = mySessions.reduce((acc, row) => acc + (row.xp_earned || 0), 0);
      
      const computedLevel = Math.max(1, Math.floor(accruedXp / XP_PER_LEVEL) + 1);
      const relativeXp = accruedXp % XP_PER_LEVEL;
      const progressPct = Math.min(100, Math.round((relativeXp / XP_PER_LEVEL) * 100));

      // Rolling Calendar Streak Calculation 
      let dynamicStreak = 0;
      if (mySessions.length > 0) {
        const uniqueDates = Array.from(
          new Set(mySessions.map(s => new Date(s.created_at).toDateString()))
        ).map(d => new Date(d));

        uniqueDates.sort((a, b) => b.getTime() - a.getTime());

        const today = new Date(new Date().toDateString());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (uniqueDates[0] >= yesterday) {
          dynamicStreak = 1;
          let expectedCompareDate = new Date(uniqueDates[0]);

          for (let i = 1; i < uniqueDates.length; i++) {
            expectedCompareDate.setDate(expectedCompareDate.getDate() - 1);
            if (uniqueDates[i].toDateString() === expectedCompareDate.toDateString()) {
              dynamicStreak++;
            } else {
              break;
            }
          }
        }
      }

      // Secure Ranking Engine Processing
      const fullRankings = classmates.map(mate => {
        const mateXp = safeSessions
          .filter(s => s.student_id === mate.id)
          .reduce((sum, s) => sum + (s.xp_earned || 0), 0);
        
        const formattedName = `${mate.first_name} ${mate.last_name ? mate.last_name[0] + '.' : ''}`.trim();
        
        return {
          id: mate.id,
          name: mate.id === studentId ? `${formattedName} (You)` : formattedName,
          xp: mateXp,
          isSelf: mate.id === studentId
        };
      }).sort((a, b) => b.xp - a.xp);

      let dynamicRank = '—';
      const selfIndex = fullRankings.findIndex(item => item.isSelf);
      if (selfIndex !== -1) {
        dynamicRank = `#${selfIndex + 1}`;
      }

      // Context Isolation: Map Top 5 and isolate out-of-bounds rows smoothly
      const topFiveList = fullRankings.slice(0, 5);
      const isSelfInTopFive = selfIndex >= 0 && selfIndex < 5;

      if (!isSelfInTopFive && selfIndex !== -1) {
        setMyLeaderboardRow({
          ...fullRankings[selfIndex],
          displayRank: selfIndex + 1
        });
      } else {
        setMyLeaderboardRow(null);
      }

      setLeaderboard(topFiveList);
      lastFetchTimeRef.current = now;

      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastUpdatedText(`Synced at ${timeString}`);

      setProfile({
        studentId,
        name: studentRow.first_name || 'Student',
        grade: studentRow.grade || 3,
        totalXp: accruedXp,
        currentLevel: computedLevel,
        relativeXp,
        xpPercent: progressPct,
        streak: dynamicStreak,
        classRank: dynamicRank
      });

    } catch (err) {
      console.error('Core FunHub data state layer failure:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Structural Window Cache Event Handlers
  useEffect(() => {
    loadDynamicHubState(true);

    const handleWindowFocus = () => loadDynamicHubState(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadDynamicHubState(false);
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadDynamicHubState]);

  if (loading) {
    return (
      <div style={{ minHeight: '50dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', animation: 'spinHub 0.8s linear infinite' }} />
        <p style={{ color: '#4f46e5', fontSize: 13, fontWeight: 700 }}>Loading FunHub Playground...</p>
        <style>{`@keyframes spinHub { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (errorState === 'AUTH') {
    return (
      <div style={{ minHeight: '50dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 14 }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1f2937' }}>Profile Disconnected</div>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', maxWidth: 280, lineHeight: 1.4 }}>Please sign in again to unlock your learning metrics card.</p>
        <button type="button" onClick={() => router.push('/parent/login')} style={{ padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Go to Login</button>
      </div>
    );
  }

  if (errorState === 'NO_STUDENT') {
    return (
      <div style={{ minHeight: '50dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 14 }}>
        <div style={{ fontSize: 40 }}>📝</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1f2937' }}>Setup Incomplete</div>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', maxWidth: 280, lineHeight: 1.4 }}>Your authenticated account hasn't been assigned a student profile yet.</p>
        <button type="button" onClick={() => router.push('/parent/onboarding')} style={{ padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Complete Profile Setup</button>
      </div>
    );
  }

  return (
    <div style={{ animation: 'slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .funhub-card-btn {
          font-family: inherit;
          text-align: left;
          background: #fff;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          padding: 0;
          display: flex;
          flex-direction: column;
          transition: transform 0.1s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.15s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        .funhub-card-btn:focus-visible {
          outline: 3px solid #4f46e5;
          outline-offset: 2px;
        }
      `}</style>

      {/* Main Adaptive Header Block */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)',
        borderRadius: 24, padding: '20px 20px 24px', marginBottom: 18, color: '#fff',
        position: 'relative', overflow: 'hidden', boxShadow: '0 10px 25px rgba(49,46,129,0.18)'
      }}>
        <div style={{ position: 'absolute', top: -15, right: -15, fontSize: 88, opacity: 0.08 }}>🎮</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 800, letterSpacing: '1.5px', marginBottom: 4, textTransform: 'uppercase' }}>
          FunHub Arena · Grade {profile.grade}
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Play. Learn. Win, {profile.name}! 🔥</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Complete challenges to rise on the leaderboard</div>

        {/* Dynamic XP Progress Bar */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 700 }}>
            <span>⚡ LEVEL {profile.currentLevel} PROGRESS</span>
            <span>{profile.relativeXp} / {XP_PER_LEVEL} XP</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 99, height: 8 }}>
            <div style={{ 
              width: `${profile.xpPercent}%`, 
              minWidth: profile.xpPercent > 0 ? '8px' : 0,
              height: '100%', 
              borderRadius: 99, 
              background: 'linear-gradient(90deg, #10b981, #34d399)', 
              boxShadow: '0 0 10px rgba(16,185,129,0.45)', 
              transition: 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' 
            }} />
          </div>
        </div>

        {/* Row Counters */}
        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          {[
            { value: profile.streak > 0 ? `🔥 ${profile.streak} Days` : '🌱 First Day', label: 'Streak' },
            { value: `👑 ${profile.classRank}`, label: 'Class Rank' },
            { value: `✨ ${profile.totalXp}`, label: 'Total XP' }
          ].map(stat => (
            <div key={stat.label} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '11px 6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.3px' }}>{stat.value}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontWeight: 700, textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Horizontal Category Control Node */}
      <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 14, scrollbarWidth: 'none' }}>
        {FIXED_SUBJECT_FILTERS.map(subj => {
          const isSelected = filter === subj;
          return (
            <button
              key={subj}
              type="button"
              onClick={() => setFilter(subj)}
              style={{
                flexShrink: 0, padding: '8px 18px', borderRadius: 99,
                border: isSelected ? 'none' : '1.5px solid #e5e7eb',
                background: isSelected ? '#1e1b4b' : '#fff',
                color: isSelected ? '#fff' : '#4b5563',
                fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.12s ease',
              }}
            >
              {subj}
            </button>
          );
        })}
      </div>

      {/* Grid Selection Component */}
      {visibleGames.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 18, padding: '36px 16px', border: '1px solid #e5e7eb', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1f2937' }}>More Games Coming!</div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>No games added for {filter} yet. Try another subject!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {visibleGames.map(game => {
            const isPressed = pressingId === game.slug;
            return (
              <button
                key={game.slug}
                type="button"
                className="funhub-card-btn"
                onPointerDown={() => setPressingId(game.slug)}
                onPointerLeave={() => setPressingId(null)}
                onClick={() => {
                  setPressingId(null);
                  router.push(`/parent/funhub/${game.slug}`);
                }}
                style={{
                  transform: isPressed ? 'scale(0.95)' : 'scale(1)',
                }}
              >
                <div style={{ width: '100%', background: game.color, padding: '20px 0', textAlign: 'center', fontSize: 36, position: 'relative' }}>
                  {game.icon}
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 3 }}>
                    {game.subjects.map(s => (
                      <span key={s} style={{ background: 'rgba(0,0,0,0.2)', color: '#fff', padding: '2px 5px', borderRadius: 5, fontSize: 8, fontWeight: 900, textTransform: 'uppercase' }}>
                        {SUBJECT_ABBREVIATIONS[s] || s.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '12px', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 2 }}>{game.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.2, flex: 1 }}>{game.desc}</div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', width: '100%' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[1, 2, 3].map(dot => (
                        <div key={dot} style={{ width: 6, height: 6, borderRadius: '50%', background: dot <= game.difficulty ? game.color : '#e5e7eb' }} />
                      ))}
                    </div>
                  </div>
                  
                  <div style={{
                    marginTop: 10, width: '100%', background: game.color, color: '#fff', borderRadius: 10,
                    padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 900,
                    boxShadow: `0 3px 8px ${game.color}33`
                  }}>
                    LAUNCH GAME →
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Secure Class Standings Leaderboard Element */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e5e7eb', padding: 16, marginBottom: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>🏆 Class Standings (Grade {profile.grade})</div>
            {lastUpdatedText && <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1, fontWeight: 500 }}>{lastUpdatedText}</div>}
          </div>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
        </div>

        {leaderboard.length === 0 ? (
          <p style={{ margin: 0, padding: '12px 0', fontSize: 12, color: '#6b7280', textAlign: 'center', fontWeight: 600 }}>No one has played yet—be the first to score! 🚀</p>
        ) : (
          <>
            {leaderboard.map((player, rankIdx) => (
              <div key={player.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 12, marginBottom: 5,
                background: player.isSelf ? '#f3e8ff' : 'transparent',
                border: player.isSelf ? '1.5px solid #c084fc' : '1px solid #f3f4f6',
              }}>
                <div style={{ fontSize: 15, width: 24, fontWeight: 900, textAlign: 'center' }}>
                  {rankIdx === 0 ? '👑' : rankIdx === 1 ? '🥈' : rankIdx === 2 ? '🥉' : `${rankIdx + 1}`}
                </div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: player.isSelf ? 800 : 600, color: '#111827' }}>
                  {player.name}
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: player.isSelf ? '#7e22ce' : '#4b5563' }}>
                  ⚡ {player.xp} XP
                </div>
              </div>
            ))}

            {/* Context Anchor: Out of Bounds Trailing Rank Row */}
            {myLeaderboardRow && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, margin: '8px 0' }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#d1d5db' }} />
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#d1d5db' }} />
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 12, background: '#f3e8ff', border: '1.5px solid #c084fc'
                }}>
                  <div style={{ fontSize: 13, width: 24, fontWeight: 900, color: '#7e22ce', textAlign: 'center' }}>
                    #{myLeaderboardRow.displayRank}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#111827' }}>
                    {myLeaderboardRow.name}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#7e22ce' }}>
                    ⚡ {myLeaderboardRow.xp} XP
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
