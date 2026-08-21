import fs from 'node:fs'
const migration=fs.readFileSync('supabase/migrations/20260821210000_hq_workroom_operating_system.sql','utf8')
const access=fs.readFileSync('app/api/hq/access/route.ts','utf8')
const page=fs.readFileSync('app/hq/workroom/page.tsx','utf8')
const detail=fs.readFileSync('app/hq/workroom/[id]/page.tsx','utf8')
const checks={
  granularPermissions:['workroom.view','workroom.update','workroom.coordinate','workroom.verify','workroom.authorize','workroom.cancel'].every(x=>migration.includes(x)),
  founderNotPartnerShortcut:!access.includes('["founder", "partner_admin", "hq_admin"]'),
  concurrency:migration.includes('workroom_stale_item')&&detail.includes('data.item.version'),
  truthfulLifecycle:['blocked','verifying','delivered','failed'].every(x=>migration.includes(x)),
  personaJourney:page.includes('Journeys at risk')&&migration.includes('affected_persona'),
  roleAware:page.includes('actor.display_name')&&detail.includes('actor.can_authorize'),
  deliveryProof:detail.includes('Confirm user outcome')&&migration.includes('delivery_status'),
  noLegacyOwnerBridge:access.length>0&&migration.includes("delete from public.platform_owners")
}
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name)
if(failed.length){console.error(JSON.stringify({result:'FAIL',failed,checks},null,2));process.exit(1)}
console.log(JSON.stringify({result:'PASS',checks},null,2))
