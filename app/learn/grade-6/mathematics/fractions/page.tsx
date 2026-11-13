import type { Metadata } from 'next'
import Grade6FractionsContentReader from '@/components/learn/Grade6FractionsContentReader'

export const metadata: Metadata = {
  title: 'Grade 6 Mathematics — Adding Fractions',
  description: 'Learn to add fractions with different denominators using fraction bars, worked examples, guided practice and revision.',
  alternates: { canonical: '/learn/grade-6/mathematics/fractions' },
}

export default function Grade6FractionsPage() {
  return <Grade6FractionsContentReader />
}
