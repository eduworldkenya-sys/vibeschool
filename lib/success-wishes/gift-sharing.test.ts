import test from 'node:test'
import assert from 'node:assert/strict'
import {giftWhatsAppUrl} from './gift-sharing'

test('WhatsApp receives the exact private fragment through encoded text',()=>{
  for(const path of ['gift','invitation']){
    const link='https://vibeschool.co.ke/success-wishes/'+path+'#token='+'a'.repeat(64)
    const url=new URL(giftWhatsAppUrl(link)!)
    assert.equal(url.origin,'https://wa.me')
    assert.equal(url.hash,'')
    assert.equal(url.searchParams.get('text'),'A special Success Wish is waiting for you. Open your private card: '+link)
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
