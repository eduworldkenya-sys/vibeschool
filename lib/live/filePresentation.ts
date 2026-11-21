// Only opaque asset identifiers are ever recorded in the shared Live timeline.
// File titles, MIME claims and object URLs are resolved again under current RLS.
const PREFIX='VFILE1:'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function encodeLiveFileRef(id:string):string {
  return UUID.test(id)?PREFIX+id.toLowerCase():''
}
export function decodeLiveFileRef(body:unknown):string|null {
  if(typeof body!=='string'||!body.startsWith(PREFIX)||body.length!==PREFIX.length+36)return null
  const id=body.slice(PREFIX.length)
  return UUID.test(id)?id:null
}
