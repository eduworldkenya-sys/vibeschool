import ReceiverShell from '@/components/success-wishes/ReceiverShell'
import './receiver-theme.css'
export default function SuccessWishesLayout({ children }: { children: React.ReactNode }) {
  return <ReceiverShell>{children}</ReceiverShell>
}
