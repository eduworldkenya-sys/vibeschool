import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { CapabilityStatus } from '@/components/public/CapabilityStatus'
import { ProductShowcase } from '@/components/public/ProductShowcase'

export const metadata: Metadata = {
  alternates: { canonical: '/product' },
  title: 'Product | VibeSchool',
  description: 'Experience how VibeSchool connects curriculum, teaching, learning, practice, assessment and next actions across teachers, learners, families and schools in Kenya.',
}

export default function ProductPage() {
  return <div>
    <PublicHeader product="Product" />
    <main id="main-content">
      <ProductShowcase />
      <CapabilityStatus />
      <section aria-labelledby="product-visit-title" style={{ background: 'var(--color-void, #05050f)', color: '#fff', padding: '56px 20px', textAlign: 'center' }}>
        <h2 id="product-visit-title" style={{ fontSize: 'clamp(27px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1.12 }}>Find your next learning step.</h2>
        <p style={{ margin: '15px auto 25px', maxWidth: 550, color: '#c3c4d1', lineHeight: 1.7 }}>Explore public learning, experience the product safely, or talk to VibeSchool about a school pilot.</p>
        <nav aria-label="Explore VibeSchool" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/learn" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 19px', background: 'var(--color-gold,#c8a84b)', color: '#14121b', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>Explore learning</Link>
          <Link href="/sandbox" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 19px', background: '#242336', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>Try the experience</Link>
          <Link href="/contact" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 19px', background: '#242336', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 800 }}>Discuss a school pilot</Link>
        </nav>
      </section>
    </main>
    <PublicFooter />
  </div>
}
