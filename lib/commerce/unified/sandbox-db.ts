/**
 * Validate and normalize isolated Daraja SANDBOX database connection URLs.
 *
 * Supabase's built-in SUPABASE_DB_URL can contain driver query options. Never
 * forward those options to postgres.js: URL query parameters can override
 * connection behavior, while hostname, username and db path MUST prove the
 * correct isolated project. The caller explicitly requires TLS.
 */
export type SandboxDbVerdict =
  | {ok:true;connectionString:string}
  | {ok:false;reason:'invalid_url'|'invalid_project'|'invalid_protocol'|
    'wrong_database_host'|'wrong_database_user'|'missing_password'|
    'wrong_database_name'|'unsupported_port'|'url_fragment'}

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

  // Strip ALL query parameters. Only the verified authority/database are passed
  // to postgres.js. This prevents embedded host/user/SSL overrides. Callers
  // enforce ssl:'require' instead of trusting a URL-provided sslmode.
  url.search=''
  return {ok:true,connectionString:url.toString()}
}
