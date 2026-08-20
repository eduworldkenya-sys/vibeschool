"use client";

import { useEffect } from "react";

const REPLACEMENTS:Record<string,string>={
  "Search readable units...":"Search this book",
  "Curriculum alignment claimed by publisher":"Matches your syllabus",
  "Verified curriculum alignment":"Matches your syllabus",
  "Alignment under review":"Syllabus match being checked",
  "No verified alignment":"Syllabus details unavailable",
  "Alignment not verified":"Syllabus match not confirmed",
  "CHECK YOUR UNDERSTANDING":"CHECK YOURSELF",
  "Revision tools":"Practice",
  "Revise tools":"Practice",
  "Learn with this unit":"Help me learn this",
  "Test me on this unit":"Check myself",
};

function humanize(root:ParentNode){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes:Text[]=[];let node:Node|null;
  while((node=walker.nextNode()))nodes.push(node as Text);
  for(const textNode of nodes){const value=textNode.nodeValue;if(!value)continue;let next=value;for(const [from,to] of Object.entries(REPLACEMENTS))next=next.split(from).join(to);if(next!==value)textNode.nodeValue=next;}
  root.querySelectorAll<HTMLElement>("input[placeholder='Search readable units...']").forEach(el=>el.setAttribute("placeholder","Search this book"));
}

export function ReaderHumanFirstPolish(){
  useEffect(()=>{
    const root=document.getElementById("vibetextbook-reader-shell");if(!root)return;
    humanize(root);
    const observer=new MutationObserver(()=>humanize(root));observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["placeholder"]});
    return()=>observer.disconnect();
  },[]);
  return <style jsx global>{`
    /* The book owns the screen; controls are supporting actors. */
    #vibetextbook-reading-content{padding-bottom:96px!important}
    .reader-excellence-bar{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    .reader-excellence-bar>button:last-child{display:none!important}
    .reader-excellence-bar>button:nth-child(2){font-size:0!important}
    .reader-excellence-bar>button:nth-child(2)::after{content:"Text";font-size:12px}
    .reader-excellence-panel{max-height:min(56dvh,500px)!important}
    #vibetextbook-reader-shell [role="dialog"]{overscroll-behavior:contain}
    #vibetextbook-reader-shell[data-reader-focus="true"] .reader-excellence-bar>button:not(:nth-child(3)){display:none!important}
    #vibetextbook-reader-shell[data-reader-focus="true"] .reader-excellence-bar{grid-template-columns:1fr!important;width:min(180px,100%)!important;margin-inline:auto}
    @media(max-width:520px){
      .reader-excellence-ui{width:min(calc(100vw - 20px),520px)!important;bottom:max(8px,env(safe-area-inset-bottom))!important}
      .reader-excellence-bar{border-radius:16px!important;padding:4px!important}
      .reader-excellence-action{min-height:44px!important}
      .reader-practice-button{top:58px!important;right:10px!important}
      #vibetextbook-reading-content #reader-active-unit{width:min(calc(100% - 28px),var(--reader-column-width))!important}
    }
  `}</style>;
}