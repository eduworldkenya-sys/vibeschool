import { PublicFooter } from '@/components/public/PublicFooter'
import { WishesNavigation } from '@/components/public/WishesNavigation'

export default function SuccessWishesLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#07111f', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
    <WishesNavigation />
    {children}
    <PublicFooter />
  </div>
}
