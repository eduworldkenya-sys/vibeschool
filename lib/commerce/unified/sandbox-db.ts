/**
 * Validate database URLs used by isolated Daraja SANDBOX functions.
 *
 * No connection is permitted to the production VibeSchool database or to
 * a different Supabase project. A single conventional SSL mode query
 * parameter is allowed: Supabase's platform URL can include sslmode=require.
 * Keep this guard independent of payment/provider credentials.
 */
export type SandboxDbVerdict =
  | {ok:true}
  | {ok:false;reason:'invalid_url'|'invalid_project'|'invalid_protocol'|
    'wrong_database_host'|'wrong_database_user'|'missing_password'|
    'wrong_database_name'|'unsupported_port'|'unsupported_parameters'|'url_fragment'}

export function validateIsolatedSandboxDatabaseUrl(
  raw: string, projectRef: string,
): SandboxDbVerdict {
  if (!/^[a-z0-9]{12,32}$/.test(projectRef)
    || projectRef === 'yauqsxggtuxuykcbrtzf') {
    return {ok:false, reason:'invalid_project'}
  }
  let url:URL
  try {url=new URL(raw)} catch {return {ok:false,reason:'invalid_url'}}
  if (!['postgres:','postgresql:'].includes(url.protocol))
    return {ok:false,reason:'invalid_protocol'}

  const direct=url.hostname === `db.${projectRef}.supabase.co`
  const pooler=url.hostname.endsWith('.pooler.supabase.com')
  if (!direct && !pooler)
    return {ok:false,reason:'wrong_database_host'}

  if (url.username !== (direct ? 'postgres' : `postgres.${projectRef}`))
    return {ok:false,reason:'wrong_database_user'}
  if (!url.password) return {ok:false,reason:'missing_password'}
  if (url.pathname !== '/postgres')
    return {ok:false,reason:'wrong_database_name'}
  if (url.port && (direct ? url.port !== '5432'
      : !['5432','6543'].includes(url.port)))
    return {ok:false,reason:'unsupported_port'}
  if (url.hash) return {ok:false,reason:'url_fragment'}

  const query=[...url.searchParams.entries()]
  if (query.length!==0 && !(query.length===1 && query[0][0]==='sslmode'
    && ['require','verify-full'].includes(query[0][1])))
    return {ok:false,reason:'unsupported_parameters'}
  return {ok:true}
}
