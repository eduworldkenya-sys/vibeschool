import Link from 'next/link'

const items = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Discover', href: '/global', icon: 'discover' },
  { label: 'Create', href: '/global/signup', icon: 'create' },
  { label: 'Activity', href: '/global/activity', icon: 'activity' },
  { label: 'Profile', href: '/global/profile', icon: 'profile' },
] as const

function NavIcon({ name }: { name: (typeof items)[number]['icon'] }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  switch (name) {
    case 'home': return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></svg>
    case 'discover': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z"/></svg>
    case 'create': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>
    case 'activity': return <svg {...common}><path d="M3 12h4l2.2-6 4.1 12 2.2-6H21"/></svg>
    case 'profile': return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.5-4 3-6 7-6s6.5 2 7 6"/></svg>
  }
}

export function PublicBottomNav() {
  return (
    <nav aria-label="Main navigation" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 80,
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'rgba(255,255,255,.97)', borderTop: '1px solid #e5e7eb',
      boxShadow: '0 -5px 22px rgba(17,24,39,.08)', backdropFilter: 'blur(14px)',
    }}>
      <div style={{ width: 'min(640px, 100%)', height: 64, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', alignItems: 'center' }}>
        {items.map((item) => {
          const isCreate = item.icon === 'create'
          const color = item.icon === 'home' ? '#172033' : '#6b7280'
          return (
            <Link key={item.label} href={item.href} aria-label={item.label} aria-current={item.icon === 'home' ? 'page' : undefined}
              style={{ minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color, textDecoration: 'none', fontSize: 10, fontWeight: item.icon === 'home' ? 800 : 650 }}>
              <span style={isCreate ? { width: 38, height: 38, marginTop: -18, borderRadius: 14, display: 'grid', placeItems: 'center', background: '#172033', color: '#fff', boxShadow: '0 4px 12px rgba(23,32,51,.2)' } : { display: 'grid', placeItems: 'center', height: 22 }}>
                <NavIcon name={item.icon}/>
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
