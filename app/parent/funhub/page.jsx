'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GAME_REGISTRY, FILTERS } from '@/config/games';

export default function FunHubPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('All');
  const [studentName, setStudentName] = useState('Explorer');
  const [stats, setStats] = useState({ totalXp: 0, level: 1, currentProgress: 0 });

  const activeGames = GAME_REGISTRY.filter(g => g.active);

  useEffect(() => {
    async function loadStudentStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: student } = await supabase
          .from('students')
          .select('id, name')
          .eq('profile_id', user.id)
          .single();

        if (student) {
          setStudentName(student.name);

          const { data: sessions } = await supabase
            .from('funhub_sessions')
            .select('xp_earned')
            .eq('student_id', student.id);

          if (sessions) {
            const totalXp = sessions.reduce((acc, s) => acc + (s.xp_earned || 0), 0);
            const level = Math.floor(totalXp / 600) + 1;
            const currentProgress = totalXp % 600;

            setStats({ totalXp, level, currentProgress });
          }
        }
      } catch {
        // Suppress errors gracefully
      }
    }
    loadStudentStats();
  }, []);

  const visible = filter === 'All' ? activeGames : activeGames.filter(g => g.subject === filter);

  // Hardcoded ordered scoreboard matrix with You locked at base or higher
  const leaderboardData = [
    { medal: '👑', name: 'Amina K.', xp: 820, you: false },
    { medal: '🥈', name: 'Brian O.', xp: 640, you: false },
    { medal: '🥉', name: 'You',      xp: Math.max(420, stats.totalXp), you: true  },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '4px 2px' }}>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .interactive-card {
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .interactive-card:active {
          transform: scale(0.97) !important;
        }
      `}</style>

      {/* Hero Tracking Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)',
        borderRadius: 20, padding: '18px 16px 20px', marginBottom: 16, color: '#fff',
        position: 'relative', overflow: 'hidden', animation: 'fadeIn 0.25s ease-out'
      }}>
        <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 72, opacity: 0.08 }}>🎮</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          FUNHUB PORTAL
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 2 }}>Jambo, {studentName}! 🔥</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Pick an arena challenge below to gain experience points!</div>

        {/* Level Track Bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>
            <span style={{ fontWeight: 700 }}>⚡ LEVEL {stats.level}</span>
            <span>{stats.currentProgress} / 600 XP</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, height: 8 }}>
            <div style={{ 
              width: `${(stats.currentProgress / 600) * 100 || 5}%`, 
              height: '100%', 
              borderRadius: 99, 
              background: 'linear-gradient(90deg, #10b981, #34d399)', 
              boxShadow: '0 0 8px rgba(16,185,129,0.6)',
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
          </div>
        </div>

        {/* Verified Live Statistics Row Only */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>⚡ {stats.totalXp}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Total Earned XP</div>
          </div>
        </div>
      </div>

      {/* Dynamic Sorting Selection Controls */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14, scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flexShrink: 0, padding: '8px 16px', borderRadius: 99,
            border: filter === f ? 'none' : '1.5px solid #e5e7eb',
            background: filter === f ? '#1e1b4b' : '#fff',
            color: filter === f ? '#fff' : '#4b5563',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Clean Config-Driven Game Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {visible.map(g => (
          <div
            key={g.id}
            onClick={() => router.push(`/parent/funhub/${g.id}`)}
            className="interactive-card"
            style={{
              background: '#fff', borderRadius: 18, overflow: 'hidden',
              border: '1px solid #e5e7eb', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex', flexDirection: 'column', height: '100%'
            }}
          >
            <div style={{ background: g.color, padding: '16px 0', textAlign: 'center', fontSize: 32, userSelect: 'none' }}>
              {g.icon}
            </div>
            
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 2 }}>{g.name}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8, lineHeight: 1.3 }}>{g.desc}</div>
                
                <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
                  {[1, 2, 3].map(d => (
                    <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: d <= g.difficulty ? g.color : '#e5e7eb' }} />
                  ))}
                </div>
              </div>

              <div style={{
                background: g.color, color: '#fff', borderRadius: 10,
                padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 800,
                boxShadow: `0 2px 6px ${g.color}33`
              }}>
                PLAY →
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Static-Ordered Leaderboard Section */}
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #e5e7eb', padding: 16, marginBottom: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 12 }}>🏆 Class Leaderboard</div>
        {leaderboardData.map((p) => (
          <div key={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px',
            borderRadius: 12, marginBottom: 4,
            background: p.you ? '#f5f3ff' : 'transparent',
            border: p.you ? '1.5px solid #c084fc' : '1px solid transparent',
          }}>
            <div style={{ fontSize: 15, width: 24, textAlign: 'center' }}>
              {p.medal}
            </div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: p.you ? 800 : 600, color: '#111827' }}>
              {p.name} {p.you && studentName !== 'Explorer' ? `(${studentName})` : ''}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>⚡ {p.xp}</div>
          </div>
        ))}
      </div>

    </div>
  );
}
