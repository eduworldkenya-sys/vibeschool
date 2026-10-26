import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET, POST } from '../../app/api/success-wishes/receiver/provision/route'

const url='https://vibeschool.example/api/success-wishes/receiver/provision'
test('receiver provisioning stays fail-closed even with valid student and school IDs', async () => {
  const old=process.env.SUCCESS_WISHES_RECEIVER_PROVISIONING_ENABLED
  try {
    delete process.env.SUCCESS_WISHES_RECEIVER_PROVISIONING_ENABLED
    const schoolId='11111111-1111-4111-8111-111111111111'
    const studentId='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const getResponse=await GET(new NextRequest(url+'?schoolId='+schoolId+'&studentId='+studentId))
    assert.equal(getResponse.status,503)
    assert.equal(Object.hasOwn(await getResponse.json(),'guardians'),false)
    const postResponse=await POST(new NextRequest(url,{
      method:'POST',headers:{origin:'https://vibeschool.example','content-type':'application/json'},
      body:JSON.stringify({schoolId,studentId,guardianLinkId:'70000000-0000-4000-8000-000000000001',
        schoolRecordReference:'TEST-RECORD-ONLY',schoolRecordChecked:true}),
    }))
    assert.equal(postResponse.status,503)
    assert.equal(Object.hasOwn(await postResponse.json(),'receiverId'),false)
  } finally {
    if(old===undefined)delete process.env.SUCCESS_WISHES_RECEIVER_PROVISIONING_ENABLED
    else process.env.SUCCESS_WISHES_RECEIVER_PROVISIONING_ENABLED=old
  }
})
