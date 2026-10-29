import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto'
import {WishError} from './contracts'
export const PIN_COOKIE='vs_wishes_keepsake'
export const PIN_AGE=90*86400
export const secret=()=>randomBytes(32).toString('hex')
export const validSecret=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
export const nameKey=(v:string)=>v.trim().replace(/\s+/g,' ').toLowerCase()
export function derive(label:string,env:Record<string,string|undefined>=process.env){const key=env.SUCCESS_WISHES_VERIFICATION_SECRET||env.SUPABASE_SERVICE_ROLE_KEY;if(!key||key.length<16)throw new WishError(503,'Private access is temporarily unavailable.');return createHmac('sha256',key).update('success-wishes:pin:'+label).digest('hex')}
export function protectPin(pin:unknown,salt=randomBytes(16).toString('hex'),env:Record<string,string|undefined>=process.env){if(typeof pin!=='string'||!/^\d{4}$/.test(pin))throw new WishError(400,'Choose a four-digit PIN.');return salt+':'+scryptSync(derive('pin:'+pin,env),salt,32).toString('hex')}
export function verifyPin(pin:unknown,stored:string,env:Record<string,string|undefined>=process.env){if(typeof pin!=='string'||!/^\d{4}$/.test(pin)||!/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(stored))return false;return timingSafeEqual(Buffer.from(protectPin(pin,stored.slice(0,32),env)),Buffer.from(stored))}
