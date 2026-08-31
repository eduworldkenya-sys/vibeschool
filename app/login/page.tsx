import Link from 'next/link'
import styles from './login.module.css'

const ROLES = [
  { href: '/login/teacher', title: 'Teacher', body: 'Teaching workspace, classes, lessons and school tools.' },
  { href: '/login/parent', title: 'Parent', body: 'Your children, school updates, progress and communication.' },
  { href: '/login/student', title: 'Learner', body: 'Learning, assignments, revision and your VibeSchool journey.' },
  { href: '/login/global', title: 'Global learner', body: 'Explore VibeSchool learning outside a school account.' },
] as const

export default function LoginPage({ searchParams }: { searchParams?: { redirect?: string } }) {
  const redirect = typeof searchParams?.redirect === 'string' && searchParams.redirect.startsWith('/') && !searchParams.redirect.startsWith('//')
    ? searchParams.redirect
    : ''
  const withRedirect = (href: string) => redirect ? `${href}?redirect=${encodeURIComponent(redirect)}` : href
  return (
    <main className={styles.shell}>
      <section className={styles.panel} aria-labelledby="login-title">
        <Link className={styles.brand} href="/" aria-label="VibeSchool home">
          Vibe<span>School</span>
        </Link>
        <p className={styles.eyebrow}>SECURE SIGN-IN</p>
        <h1 className={styles.title} id="login-title">Choose your account</h1>
        <p className={styles.lead}>Select how you use VibeSchool. We will open the correct secure sign-in for your account.</p>

        <div className={styles.roles} aria-label="Choose account type">
          {ROLES.map((role) => (
            <Link key={role.href} href={withRedirect(role.href)} className={styles.role}>
              <strong>{role.title}</strong>
              <span>{role.body}</span>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </div>

        <div className={styles.actions}>
          <Link href="/auth/forgot-password">Forgot password?</Link>
          <Link href="/">Back to VibeSchool</Link>
        </div>
      </section>
    </main>
  )
}
