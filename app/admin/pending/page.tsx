'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function PendingContent() {
  const params     = useSearchParams()
  const router     = useRouter()
  const fullName   = params.get('name')   ?? ''
  const email      = params.get('email')  ?? ''
  const schoolName = params.get('school') ?? ''
  const waParam    = params.get('wa')     ?? ''
  const waText     = waParam || encodeURIComponent(`Hello, I just registered as a VibeSchool admin.\nName: ${fullName}\nEmail: ${email}\nSchool: ${schoolName}`)
  const mailBody   = encodeURIComponent(`Hello,\n\nI just registered as a VibeSchool admin.\n\nName: ${fullName}\nEmail: ${email}\nSchool: ${schoolName}\n\nPlease activate my account.`)

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'420px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'24px', padding:'48px 40px', textAlign:'center' }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>✅</div>
        <h1 style={{ color:'#ffffff', fontSize:'20px', fontWeight:'700', margin:'0 0 10px' }}>Account Created!</h1>
        <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'13px', lineHeight:'1.6', margin:'0 0 8px' }}>
          Your account for <strong style={{ color:'rgba(255,255,255,0.7)' }}>{schoolName || 'your school'}</strong> is ready.
        </p>
        <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'13px', lineHeight:'1.6', margin:'0 0 32px' }}>Reach out if you need help getting started:</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <a href={`https://wa.me/254720614664?text=${waText}`} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', background:'#25d366', borderRadius:'10px', padding:'14px', color:'#ffffff', fontSize:'14px', fontWeight:'700', textDecoration:'none' }}>
            <span style={{ fontSize:'18px' }}>💬</span> Chat on WhatsApp
          </a>
          <a href={`mailto:eduworldkenya@gmail.com?subject=VibeSchool Admin – ${schoolName}&body=${mailBody}`}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'10px', padding:'14px', color:'rgba(255,255,255,0.8)', fontSize:'14px', fontWeight:'600', textDecoration:'none' }}>
            <span style={{ fontSize:'18px' }}>✉️</span> Email Us
          </a>
        </div>
        <button onClick={() => router.push('/admin/login')}
          style={{ marginTop:'24px', background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:'12px', cursor:'pointer' }}>
          Go to login →
        </button>
      </div>
    </div>
  )
}

export default function AdminPendingPage() {
  return <Suspense><PendingContent /></Suspense>
}
