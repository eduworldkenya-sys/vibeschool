'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ForceLearnCompilationHub() {
  const router = useRouter();

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 16px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>🚀</div>
      <h2 style={{ fontWeight: 800, color: '#111827', margin: '0 0 8px 0' }}>Initializing Learn Domain</h2>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>
        Setting up premium features and syncing live databases...
      </p>
      <button 
        onClick={() => router.refresh()} 
        style={{ padding: '12px 24px', background: '#111827', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
      >
        Enter Portal Workspace
      </button>
    </div>
  );
}
