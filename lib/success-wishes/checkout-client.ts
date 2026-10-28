export type CheckoutState='created'|'submitting'|'awaiting_customer'|'reconciliation_required'|'settled'|'failed'|'refunded'
export type CheckoutCard={theme:'heritage'|'botanical'|'nightfall'|'sunrise';candidate:string;sender:string;message:string;examYear:string;school:string;deliveryPhone?:string}
export type CheckoutOrder={id:string;state:CheckoutState;amountKes:50;payerPhone:string;card:CheckoutCard;receipt:string|null;invitationUrl:string|null;backupCode:string|null}
export const CHECKOUT_STORAGE_KEY='vs-success-wish-checkout-v1'
export const newCheckoutKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')
export function recipientRequestToken(value:string){
 if(/^[a-f0-9]{64}$/.test(value.trim()))return value.trim()
 try{const u=new URL(value.trim());if(u.origin!=='https://vibeschool.co.ke')return '';const h=new URLSearchParams(u.hash.slice(1));const t=h.get('token')||h.get('request')||'';return /^[a-f0-9]{64}$/.test(t)?t:''}catch{return ''}
}
export const pendingCheckout=(s:CheckoutState)=>['submitting','awaiting_customer','reconciliation_required'].includes(s)
export function checkoutMessage(s:CheckoutState){
 switch(s){
 case 'created':return ''
 case 'submitting':return 'Sending your M-Pesa prompt…'
 case 'awaiting_customer':return 'Enter your PIN on the M-Pesa prompt.'
 case 'reconciliation_required':return 'Checking payment. Do not pay again.'
 case 'settled':return 'Payment confirmed.'
 case 'failed':return 'Payment wasn’t completed.'
 case 'refunded':return 'Payment refunded.'
 }
}

export function maskedPayerPhone(value:string){
 const digits=value.replace(/\D/g,'')
 const local=digits.startsWith('254')?'0'+digits.slice(3):digits
 return local.length===10?local.slice(0,4)+' ••• '+local.slice(-3):'Your M-Pesa number'
}
export function canPay(state:CheckoutState|undefined,uncertain:boolean){return state==='created'&&!uncertain}
