import Link from 'next/link'
import RecoveryActions from './RecoveryActions'

const COPY: Record<string, { title: string; body: string }> = {
  missing_code: { title: 'Sign-in link is incomplete', body: 'Start the sign-in process again. The previous provider response cannot be used.' },
  invalid_intent: { title: 'Sign-in request is invalid', body: 'Start again from VibeSchool so we can verify the account journey safely.' },
  exchange_failed: { title: 'Sign-in session expired', body: 'The sign-in or recovery response could not be completed. Start again.' },
  session_failed: { title: 'Session could not be established', body: 'Your provider returned successfully, but VibeSchool could not establish a secure session.' },
  profile_missing: { title: 'Account profile needs repair', body: 'Your sign-in identity exists, but the VibeSchool profile is missing. Access was stopped rather than guessing a role.' },
  profile_resolution_failed: { title: 'Account could not be resolved', body: 'VibeSchool could not safely resolve this account. No role or dashboard was guessed.' },
  account_inactive: { title: 'Account is not active', body: 'This account cannot enter VibeSchool until its account status is restored.' },
  account_unregistered: { title: 'No VibeSchool account yet', body: 'This Google account is not registered with a VibeSchool role. Create an account instead of signing in.' },
  role_required: { title: 'Choose the account you want to create', body: 'Start from the appropriate VibeSchool sign-up page.' },
  role_claim_failed: { title: 'Account setup could not be completed', body: 'VibeSchool stopped before assigning a role because the account state was not safe to change.' },
  role_unresolved: { title: 'Account role needs attention', body: 'VibeSchool could not determine an authoritative role for this account.' },
  onboarding_resolution_failed: { title: 'Account setup state is unavailable', body: 'VibeSchool could not safely determine your next step. No dashboard was guessed. You can retry safely.' },
  onboarding_invalid: { title: 'Account setup state is inconsistent', body: 'VibeSchool stopped the sign-in journey because the account state needs repair.' },
  authority_resolution_failed: { title: 'Account authority could not be verified', body: 'Access was stopped because VibeSchool could not safely verify your role and onboarding state.' },
  recovery_session_missing: { title: 'Recovery session expired', body: 'This password-reset session is no longer valid. Start password recovery again.' },
  account_unavailable: { title: 'Account is unavailable', body: 'This account cannot currently enter VibeSchool. Contact support if you believe this is a mistake.' },
  admin_membership_missing: { title: 'School administrator access needs repair', body: 'Your account does not currently have a verified administrator membership. Access was stopped safely.' },
  identity_conflict: { title: 'Learner identity needs review', body: 'VibeSchool found conflicting learner identity evidence and stopped rather than choosing the wrong learner.' },
}

export default function AuthErrorPage({ searchParams }: { searchParams?: { reason?: string } }) {
  const reason = typeof searchParams?.reason === 'string' ? searchParams.reason : ''
  const copy = COPY[reason] ?? {
    title: 'Sign-in could not be completed',
    body: 'VibeSchool stopped the authentication journey safely. Start again or contact support if the problem continues.',
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#05050f', color: '#fff', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 480 }}>
        <a href="/" aria-label="VibeSchool home" style={{ color: '#fff', textDecoration: 'none', fontSize: 28, fontWeight: 800 }}>Vibe<span style={{ color: '#c8a84b' }}>School</span></a>
        <p style={{ marginTop: 32, color: '#c8a84b', fontSize: 11, fontWeight: 800, letterSpacing: '.14em' }}>SECURE SIGN-IN</p>
        <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: '8px 0 12px' }}>{copy.title}</h1>
        <p style={{ color: 'rgba(255,255,255,.65)', lineHeight: 1.6 }}>{copy.body}</p>
        <RecoveryActions />
        <div style={{ marginTop: 16 }}>
          <Link href="/auth/forgot-password" style={{ color: '#fff', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontWeight: 700 }}>Reset password</Link>
        </div>
        <p style={{ marginTop: 24, color: 'rgba(255,255,255,.4)', fontSize: 12 }}>Reference: {reason || 'auth_error'}</p>
      </section>
    </main>
  )
}
