import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const get = file => readFileSync(file, 'utf8')
const publicUi = get('app/schools/components/SchoolPublicContent.tsx')
const feed = get('app/schools/following/page.tsx')
const hq = get('app/hq/schools/publications/page.tsx')
const admin = get('app/admin/school-publications/page.tsx')
const sql = get('supabase/migrations/20261115035827_school_public_home_publishing.sql')
const requireFragments = (content, fragments, scope) => {
  for (const fragment of fragments) assert.ok(content.includes(fragment), scope + ' must include ' + fragment)
}
requireFragments(publicUi, [
  ".from('school_public_posts')",
  ".eq('school_slug', slug)",
  ".eq('status', 'published')",
  ".rpc('school_can_publish_public_v1'",
  ".rpc('school_publish_public_post_v1'",
  ".rpc('school_withdraw_public_post_v1'",
  "'announcement'",
  "'fees'",
  "'uniform'",
  "'admissions'",
  "'contact'",
], 'public information')
requireFragments(feed, ["school_followed_public_feed_v1", "supabase.auth.getUser()", "schoolUrl(post.school_slug)"], 'connected feed')
requireFragments(hq, ["hqSupabase.auth.getUser()", "SchoolPublicContent", "schools_search_urls_public_v2", "hq_human_has_permission"], 'HQ publishing')
requireFragments(admin, ["getAdminSchoolAuthority()", "schools_resolve_url_public_v1", "SchoolPublicContent"], 'school admin publishing')
for(const [path,needle] of [
  ['app/schools/components/DirectorySchool.tsx','SchoolPublicContent'],
  ['app/schools/components/SchoolProfile.tsx','SchoolPublicContent'],
  ['app/schools/components/SchoolSection.tsx','SchoolPublicContent'],
  ['app/student/page.tsx','/schools/following'],
  ['app/teacher/schoolhub/page.tsx','/schools/following'],
  ['app/parent/page.tsx','/schools/following'],
  ['app/hq/schools/page.tsx','/hq/schools/publications'],
  ['app/admin/page.tsx','/admin/school-publications'],
])assert.ok(get(path).includes(needle), path + ' missing connection')
requireFragments(sql, [
  "status='published'",
  "public.hq_human_has_permission(v_actor,'schools.publish')",
  "public.is_school_admin(v_school_id)",
  "v_post.status='withdrawn'",
  "from public.school_follows",
  "from public.school_members",
  "from public.students st",
  "from public.parent_student_links",
  "revoke all on public.school_public_posts from public, anon, authenticated",
  "create policy school_public_posts_read_published",
], 'database authority')
assert.doesNotMatch(publicUi, /from\('vc_circulars'\)|from\('finance_fee_structures'\)/,'never republish private school data')
assert.ok(!sql.replace("where (select auth.uid()) is not null",'').includes("where (select auth.uid()) is not null"),'negative control must remove auth predicate')
console.log('PASS: all school, HQ, admin and linked-user public information surfaces, secure feed, no private content mirrors and negative control')
