"use client"
import {useEffect,useRef,useState} from "react"
type Props={label:string;onReveal:()=>void}
export default function ScratchSurface({label,onReveal}:Props){
 const canvasRef=useRef<HTMLCanvasElement>(null)
 const last=useRef<{x:number;y:number}|null>(null)
 const distance=useRef(0)
 const [progress,setProgress]=useState(0)
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return
  const bounds=canvas.getBoundingClientRect();const width=Math.max(280,Math.round(bounds.width));const height=Math.max(205,Math.round(bounds.height))
  const ratio=Math.min(2,window.devicePixelRatio||1);canvas.width=width*ratio;canvas.height=height*ratio
  const ctx=canvas.getContext("2d");if(!ctx)return
  ctx.scale(ratio,ratio)
  const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,"#c3c9dc");gradient.addColorStop(.5,"#788bab");gradient.addColorStop(1,"#e1e8f1")
  ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height)
  ctx.fillStyle="#25385d";ctx.font="900 25px Arial";ctx.textAlign="center";ctx.fillText("SCRATCH TO REVEAL",width/2,height/2)
  ctx.font="600 13px Arial";ctx.fillText("Drag your finger or mouse",width/2,height/2+33)
 },[label])
 function scratch(e:React.PointerEvent<HTMLCanvasElement>){
  if(!last.current)return;const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return
  const r=canvas.getBoundingClientRect();const next={x:e.clientX-r.left,y:e.clientY-r.top}
  ctx.save();ctx.globalCompositeOperation="destination-out";ctx.strokeStyle="rgba(0,0,0,1)";ctx.lineWidth=42;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(last.current.x,last.current.y);ctx.lineTo(next.x,next.y);ctx.stroke();ctx.restore()
  distance.current+=Math.hypot(next.x-last.current.x,next.y-last.current.y);last.current=next
  const estimated=Math.min(100,Math.round(distance.current*42/(r.width*r.height)*100))
  setProgress(estimated)
  if(estimated>=65){last.current=null;onReveal()}
 }
 return <div className="scratchSurface">
  <div className="scratchBoard"><div className="scratchTreasure"><span>VIBESCHOOL MYSTERY</span><strong>{label}</strong><small>Keep playing to reveal the answer</small></div><canvas ref={canvasRef} aria-label="Scratch away the silver surface to uncover the mystery" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect();last.current={x:e.clientX-r.left,y:e.clientY-r.top}}} onPointerMove={scratch} onPointerUp={()=>{last.current=null}} onPointerCancel={()=>{last.current=null}}/></div>
  <div className="scratchFooter"><span>{progress}% uncovered</span><button type="button" onClick={onReveal}>Reveal instantly</button></div>
 </div>
}
