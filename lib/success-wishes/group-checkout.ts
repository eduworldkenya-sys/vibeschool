import {createHash} from 'node:crypto'
import {object,WishError} from './contracts'
import {guestTextWishQuote} from './guest-checkout-contract'

/** Immutable per-student snapshots; pricing never comes from the browser. */
export function groupWishQuote(input:unknown,key:string){
 const b=object(input)
 if(!Array.isArray(b.students)||b.students.length<2||b.students.length>4)
  throw new WishError(400,'Add two, three or four students.')
 for(const name of ['amountKes','price','paid','currency','paymentStatus','providerReceipt','checkoutRequestId','merchantRequestId','paymentAttemptId'])
  if(Object.hasOwn(b,name))throw new WishError(400,'Payment details cannot be supplied by the sender.')
 const quotes=b.students.map(raw=>guestTextWishQuote({...object(raw),version:'text',sender:b.sender,payerPhone:b.payerPhone,idempotencyKey:key}))
 const cards=quotes.map(q=>q.card)
 return {cards,payerPhone:quotes[0].payerPhone,amountKes:100,
  digest:createHash('sha256').update('vibeschool:group-wishes:v1:').update(JSON.stringify(cards)).digest('hex')}
}
