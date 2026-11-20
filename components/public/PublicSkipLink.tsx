'use client'
export function PublicSkipLink({className}:{className:string}){
 return <a href="#main-content" className={className} onClick={event=>{
  const main=document.getElementById('main-content')
  if(!main)return
  event.preventDefault()
  if(location.hash!=='#main-content')history.pushState(null,'','#main-content')
  if(!main.hasAttribute('tabindex'))main.setAttribute('tabindex','-1')
  main.focus({preventScroll:true})
  main.scrollIntoView({block:'start'})
 }}>Skip to content</a>
}
