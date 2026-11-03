const PATHS = {
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.2-4.2',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zm0 0V21m0 0a2.5 2.5 0 0 1 2.5-2H20M8 7h8m-8 4h8',
  user: 'M20 21a8 8 0 0 0-16 0m8-10a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7 9v-1.5a3.5 3.5 0 0 0-2.5-3.35M14.5 4.2a3.5 3.5 0 0 1 0 6.6',
  plus: 'M12 5v14M5 12h14',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.9z',
  pin: 'M12 21s-6.5-5.7-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.3-6.5 11-6.5 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5 10 17l9-10',
  sunrise: 'M3 17h18M7 17a5 5 0 0 1 10 0M12 4v3M4.9 10.9l2.1 2.1M19.1 10.9l-2.1 2.1',
  sun: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
  sunset: 'M3 17h18M7 17a5 5 0 0 1 10 0M12 9V6M9 9l-1.5-1.5M15 9l1.5-1.5',
  moon: 'M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z',
} as const

export type IconName = keyof typeof PATHS

export default function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  const filled = name === 'star'
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  )
}
