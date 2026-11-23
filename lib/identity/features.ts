/**
 * Additive identity rollout switch. OFF unless explicitly configured after
 * Supabase migration, authorization tests and browser verification.
 * Signup and legacy school/parent entry remain available when disabled.
 */
export const unifiedIdentityEnabled =
  process.env.NEXT_PUBLIC_UNIFIED_IDENTITY_ENABLED === 'true'
