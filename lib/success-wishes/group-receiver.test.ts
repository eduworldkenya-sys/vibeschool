import test from 'node:test'
import assert from 'node:assert/strict'
import {savedGift,savedGroupGift} from './receiver-collection'
const card={kind:'success_wish_text',candidate:'Mary',sender:'Mum',message:'Private wish',theme:'heritage',examYear:'2026',school:''}
const expiry=new Date(Date.now()+86400000).toISOString()
const row=()=>({id:'item',card,item_index:0,expires_at:expiry,revoked_at:null,inbox_opened_at:null,success_wish_guest_orders:{state:'settled',amount_kes:100,refunded_at:null,provider_receipt:'SYNTHETIC',provider_verified_at:new Date().toISOString(),settled_at:new Date().toISOString(),group_cards:[card]}})
test('each group receiver gets only their sealed snapshot; refunds, stale links and mismatches are unavailable',()=>{
 const g=row(),sealed=savedGroupGift(g)!;assert.equal(sealed.sender,null);assert.equal('message' in sealed,false);assert.equal(sealed.source,'group')
 assert.equal(savedGroupGift(g,true)?.message,'Private wish')
 for(const change of [{state:'created'},{amount_kes:50},{refunded_at:expiry},{provider_receipt:null},{provider_verified_at:null},{settled_at:null},{group_cards:[{...card,candidate:'Brian'}]}])assert.equal(savedGroupGift({...g,success_wish_guest_orders:{...g.success_wish_guest_orders,...change}}),null)
 assert.equal(savedGroupGift({...g,revoked_at:expiry}),null)
 assert.equal(savedGroupGift({...g,expires_at:'2020-01-01'}),null)
})
test('single-card expiry and revocation survive the one-to-many relation change',()=>{
 const g={id:'single',card,state:'settled',amount_kes:50,provider_receipt:'SYNTHETIC',provider_verified_at:expiry,settled_at:new Date().toISOString(),success_wish_guest_gifts:[{expires_at:expiry,revoked_at:expiry as string|null}]}
 assert.equal(savedGift(g,'paid'),null)
 g.success_wish_guest_gifts[0].revoked_at=null
 assert(savedGift(g,'paid'))
})
