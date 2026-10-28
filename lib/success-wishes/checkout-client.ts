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
 case 'created':return 'Your exact card is saved. Confirm below to request payment.'
 case 'submitting':return 'Sending the M-Pesa prompt. Keep this order open and do not pay again.'
 case 'awaiting_customer':return 'Check your phone and enter your M-Pesa PIN. We are waiting for Safaricom to confirm payment.'
 case 'reconciliation_required':return 'We are checking this payment. Do not pay again. Keep your order reference and check its status here.'
 case 'settled':return 'Payment confirmed. Your private card is ready.'
 case 'failed':return 'Safaricom did not complete this payment. Review your number before starting another checkout.'
 case 'refunded':return 'This payment was refunded. Its private card is unavailable.'
 }
}
