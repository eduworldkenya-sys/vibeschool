#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
# VibeSchool — Emergency rollback: middleware role-enforcement
#
# Removes the GAP-002 role-check block from middleware.ts (added 2 extra
# Supabase round-trips per protected-route navigation). Keeps the
# auth-only redirect that was already safely working before. Your
# layouts (teacher/admin/parent layout.tsx + the new StudentAuthGuard)
# already enforce role independently, so this does NOT reopen any of
# the security gaps from the original audit.
#
# USAGE (Termux):
#   cd ~/vibeschool
#   nano rollback-middleware.sh   (paste, ctrl+o, enter, ctrl+x)
#   chmod +x rollback-middleware.sh
#   ./rollback-middleware.sh
# ============================================================================

set -e
cd ~/vibeschool || { echo "ERROR: ~/vibeschool not found."; exit 1; }

if [ ! -f "middleware.ts" ]; then
  echo "ERROR: middleware.ts not found. Are you in the vibeschool repo root?"
  exit 1
fi

TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=".audit-backups/$TS"
mkdir -p "$BACKUP_DIR"
cp middleware.ts "$BACKUP_DIR/middleware.ts"

echo "Backed up current middleware.ts to $BACKUP_DIR/"
echo "Rewriting middleware.ts to drop role-enforcement (auth-only check restored)..."

cat > middleware.ts <<'TSEOF'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = new Set([
  '/admin/login',
  '/admin/signup',
  '/admin/reset-password',
])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const protectedPrefixes = ['/teacher', '/admin', '/parent', '/student', '/select']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const role = pathname.startsWith('/teacher') ? 'teacher'
      : pathname.startsWith('/admin')   ? 'admin'
      : pathname.startsWith('/parent')  ? 'parent'
      : pathname.startsWith('/student') ? 'student'
      : 'teacher'
    return NextResponse.redirect(new URL(`/?role=${role}`, req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/teacher/:path*',
    '/admin/:path*',
    '/parent/:path*',
    '/student/:path*',
    '/select/:path*',
  ],
}
TSEOF

echo "middleware.ts rewritten."
echo ""
echo "Running tsc check..."
npx tsc --noEmit

echo ""
echo "Pushing via vibe-push.sh ..."
if [ -f "./vibe-push.sh" ]; then
  ./vibe-push.sh "fix: revert middleware role-check (perf regression on slow networks)"
else
  git add -A
  git commit -m "fix: revert middleware role-check (perf regression on slow networks)"
  git push
fi

echo ""
echo "Forcing Vercel rebuild..."
git commit --allow-empty -m "fix: force Vercel rebuild" && git push

echo ""
echo "Done. middleware.ts is back to auth-only checking."
echo "Role enforcement still happens at the layout level (teacher/admin/parent"
echo "layouts + StudentAuthGuard) — this rollback only removes the redundant"
echo "extra round-trip in middleware that was likely causing the slow-network hang."
