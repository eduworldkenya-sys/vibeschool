'use client'
import {useEffect,useId,useRef,type ReactNode} from 'react'
import styles from './LiveClassroom.module.css'

export function ExecutiveDialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null)
 const id=useId()
 useEffect(()=>{const node=ref.current;if(!node)return;const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;node.showModal();return()=>{if(node.open)node.close();if(previous?.isConnected)previous.focus()}},[])
 return <dialog ref={ref} aria-labelledby={id} className={styles.executiveDialog} onCancel={e=>{e.preventDefault();onClose()}}><header><h2 id={id}>{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog">×</button></header>{children}</dialog>
}
