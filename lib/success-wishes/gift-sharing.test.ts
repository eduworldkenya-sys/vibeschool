import test from 'node:test'
import assert from 'node:assert/strict'
import {giftWhatsAppUrl,giftShareMessage} from './gift-sharing'

test('WhatsApp receives the exact private fragment through encoded text',()=>{
  for(const path of ['gift','invitation']){
    const link='https://vibeschool.co.ke/success-wishes/'+path+'#token='+'a'.repeat(64)
    const url=new URL(giftWhatsAppUrl(link)!)
    assert.equal(url.origin,'https://wa.me')
    assert.equal(url.hash,'')
    assert.equal(url.searchParams.get('text'),`Success Wishes 2026\n\nOpen your card:\n${link}`)
  }
})
test('untrusted, malformed, or extra-content URLs cannot become private sharing actions',()=>{
  const token='b'.repeat(64)
  for(const link of ['javascript:alert(1)','https://evil.example/#token='+token,
    'https://vibeschool.co.ke.evil.example/success-wishes/gift#token='+token,
    'http://vibeschool.co.ke/success-wishes/gift#token='+token,
    'https://vibeschool.co.ke/success-wishes/gift#token=short',
    'https://vibeschool.co.ke/success-wishes/gift#token='+token+'&extra=1']){
    assert.equal(giftWhatsAppUrl(link),null)
  }
})

test('sharing includes both sender and recipient while keeping the complete private link',()=>{
 const link='https://vibeschool.co.ke/success-wishes/gift#token='+'a'.repeat(64)
 const url=new URL(giftWhatsAppUrl(link,'Mary','Uncle John')!)
 assert.equal(url.searchParams.get('text'),`Success Wishes 2026\nFrom Uncle John to Mary\n\nOpen your card:\n${link}`)
 assert.equal(url.searchParams.size,1)
})

test('missing sender or recipient never invents a name',()=>{
 const link='https://vibeschool.co.ke/success-wishes/gift#token='+'a'.repeat(64)
 assert.equal(giftShareMessage(link,'Mary'),`Success Wishes 2026\nFor Mary\n\nOpen your card:\n${link}`)
 assert.equal(giftShareMessage(link,undefined,'Uncle John'),`Success Wishes 2026\nFrom Uncle John\n\nOpen your card:\n${link}`)
})
