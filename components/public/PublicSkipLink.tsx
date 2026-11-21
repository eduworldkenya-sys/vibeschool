'use client'

/**
 * Keep native anchor navigation intact so keyboard activation also works before
 * React hydration. Enhance the native jump by giving the destination focus.
 */
export function PublicSkipLink({className,children}:{className:string;children:string}) {
 return <a href="#main-content" className={className} onClick={()=>{
  const main=document.getElementById('main-content')
  if(!main)return
  if(!main.hasAttribute('tabindex'))main.setAttribute('tabindex','-1')
  main.focus({preventScroll:true})
 }}>{children}</a>
}
