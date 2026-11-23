import { PublicSkipFocus } from './PublicSkipFocus'

// Native server-rendered fragment navigation works before JavaScript hydrates.
// Optional client enhancement moves focus to the main landmark after activation.
export function PublicSkipLink({ className, children }: { className: string; children: string }) {
  return <>
    <a href="#main-content" data-vs-public-skip className={className}>{children}</a>
    <PublicSkipFocus />
  </>
}
