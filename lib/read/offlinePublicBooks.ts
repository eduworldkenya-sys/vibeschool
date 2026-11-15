import type { ReaderPayload } from '@/app/read/textbook/[publicationId]/ReaderClient'
import type { ContentBlock, PublicationFormat } from '@/lib/publishTypes'

export const OFFLINE_BOOKS_DB = 'vibeschool-public-books-v1'
const STORE = 'books'
const DB_VERSION = 1
export type OfflineBook = {
  id: string
  title: string
  format: PublicationFormat
  savedAt: number
  chapters: { id:string; number:number; title:string; blocks:ContentBlock[] }[]
}
export function publicBookSnapshot(payload: ReaderPayload): OfflineBook {
  // Only content already served to anonymous visitors may be downloaded.
  // Never store personalized resume/progress or authenticated chapter payloads.
  const pub = payload.publication
  if (!payload.ok || pub.status !== 'published' || pub.pricing.type !== 'free')
    throw new Error('This book is not available for public offline download.')
  const chapters = payload.chapters
    .filter(c => c.status === 'published' && c.can_read && Array.isArray(c.blocks))
    .map(c => ({
      id:c.id, number:c.number, title:c.title || `Unit ${c.number}`,
      blocks:(c.blocks || []).filter(b => typeof b.id==='string' && typeof b.type==='string' && typeof b.content==='string')
        .map(b => ({id:b.id,type:b.type,content:b.content, ...(b.meta?{meta:b.meta}:{})})),
    }))
  if (!chapters.length) throw new Error('This book has no downloadable public chapters.')
  return {id:pub.id,title:pub.title || 'VibeSchool Book',format:pub.format,savedAt:Date.now(),chapters}
}
function openDatabase():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if (typeof indexedDB==='undefined') {reject(new Error('This browser does not support offline book storage.'));return}
    const request=indexedDB.open(OFFLINE_BOOKS_DB,DB_VERSION)
    request.onupgradeneeded=()=>{if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE,{keyPath:'id'})}
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error||new Error('Cannot open offline book library.'))
    request.onblocked=()=>reject(new Error('Close other VibeSchool tabs and try again.'))
  })
}
async function operation<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore,resolve:(value:T)=>void)=>IDBRequest|void):Promise<T>{
  const db=await openDatabase()
  return new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(STORE,mode)
    let result:T
    tx.oncomplete=()=>{db.close();resolve(result)}
    tx.onerror=()=>{db.close();reject(tx.error||new Error('Offline book storage failed.'))}
    tx.onabort=()=>{db.close();reject(tx.error||new Error('Offline book storage was interrupted.'))}
    try {
      const request=run(tx.objectStore(STORE),value=>{result=value})
      if (request) {
        request.onsuccess=()=>{result=request.result as T}
      }
    } catch(error){try{tx.abort()}catch{}reject(error)}
  })
}
export const saveOfflineBook=(book:OfflineBook)=>operation<void>('readwrite',store=>store.put(book))
export const listOfflineBooks=()=>operation<OfflineBook[]>('readonly',store=>store.getAll())
export const getOfflineBook=(id:string)=>operation<OfflineBook|undefined>('readonly',store=>store.get(id))
export const deleteOfflineBook=(id:string)=>operation<void>('readwrite',store=>store.delete(id))
