"use client"
import {useCallback,useEffect,useRef,useState} from "react"
import styles from "./follow-ball-3d.module.css"

type Phase="ready"|"preview"|"shuffle"|"guess"|"reveal"
type View="front"|"left"|"right"|"top"|"free"
type Finish=(message:string)=>void
type Props={onFinish:Finish;reducedMotion:boolean;disco:boolean;lasers:boolean;theme:string}
const START_CUPS=[0,1,2]
const VIEW_ANGLES:Record<Exclude<View,"free">,{x:number;z:number}>={front:{x:54,z:0},left:{x:59,z:-32},right:{x:59,z:32},top:{x:0,z:0}}
function sample(max:number){if(max<=1)return 0;const v=new Uint32Array(1);if(typeof crypto!=="undefined"&&crypto.getRandomValues){const maxInt=4294967296,cap=Math.floor(maxInt/max)*max;do{crypto.getRandomValues(v)}while(v[0]>=cap;return v[0]%max}return Math.floor(Math.random()*max)}
function range(min:number,max:number,v:number){return Math.max(min,Math.min(max,v))}
const THEMES=[["luxury","Luxury Gold"],["neon","Neon Arcade"],["football","Football Stadium"],["mystery","Mystery Stage"],["minimal","Minimal Studio"],["disco","Disco Party"]] as const
export default function FollowBall3D({onFinish,reducedMotion,disco,lasers,theme}:Props){
 const [count,setCount]=useState(3)
 const [difficulty,setDifficulty]=useState(2)
 const [speed,setSpeed]=useState(6)
 const [swaps,setSwaps]=useState(8)
 const [view,setView]=useState<View>("front")
 const [angle,setAngle]=useState({x:54,z:0})
 const [skin,setSkin]=useState("luxury")
 const [phase,setPhase]=useState<Phase>("ready")
 const [positions,setPositions]=useState<number[]>(START_CUPS)
 const [ballCup,setBallCup]=useState(0)
 const [selected,setSelected]=useState<number|null>(null)
 const [moving,setMoving]=useState<number[]>([])
 const [completedSwaps,setCompletedSwaps]=useState(0)
 const [streak,setStreak]=useState(0)
 const [attempts,setAttempts]=useState(0)
 const [auto,setAuto]=useState(false)
 const [showCorrect,setShowCorrect]=useState(true)
 const [sounds,setSounds]=useState(true)
 const [showHelp,setShowHelp]=useState(false)
 const [result,setResult]=useState("")
 const timeouts=useRef<ReturnType<typeof setTimeout>[]>([])
 const session=useRef(0)
 const drag=useRef<{x:number;y:number;z:number;pitch:number}|null>(null)
 const log=useRef<number[][]>([])
 const audio=useRef<AudioContext|null>(null)
 const audioEnabled=useRef(false)
 const finishRef=useRef(onFinish)
 const latest=useRef({count,swaps,speed,difficulty,reducedMotion,auto})
 finishRef.current=onFinish
 latest.current={count,swaps,speed,difficulty,reducedMotion,auto}
 function clearTimers(){timeouts.current.forEach(clearTimeout);timeouts.current=[]}
 function later(callback:()=>void,ms:number){const id=setTimeout(callback,ms);timeouts.current.push(id)}
 useEffect(()=>()=>{clearTimers();session.current++;if(audio.current)void audio.current.close()},[])
 function tone(ok=true){if(!sounds||!audioEnabled.current)return;try{const ctx=audio.current??new AudioContext();audio.current=ctx;[0,1,2].forEach((n)=>{const osc=ctx.createOscillator(),vol=ctx.createGain();osc.type="sine";osc.frequency.value=(ok?540:220)*(1+n*.17);const t=ctx.currentTime+n*.075;vol.gain.setValueAtTime(.0001,t);vol.gain.exponentialRampToValueAtTime(.03,t+.02);vol.gain.exponentialRampToValueAtTime(.0001,t+.19);osc.connect(vol);vol.connect(ctx.destination);osc.start(t);osc.stop(t+.2)})}catch{}}
 function cancel(){clearTimers();session.current++;setMoving([]);setPhase("ready");setSelected(null);setResult("");setCompletedSwaps(0)}
 function updateCount(n:number){cancel();setCount(n);setPositions(Array.from({length:n},(_,i)=>i));setBallCup(0);setStreak(0)}
 function setCamera(next:View){setView(next);if(next!=="free")setAngle(VIEW_ANGLES[next])}
 function startRound(){audioEnabled.current=true;clearTimers();const token=++session.current;const n=count;const cup=sample(n);setPositions(Array.from({length:n},(_,i)=>i));setBallCup(cup);setSelected(null);setMoving([]);setCompletedSwaps(0);setResult("");setPhase("preview");const ms=reducedMotion?500:1800;later(()=>{if(token===session.current)runShuffle(token,n)},ms)}
 function runShuffle(token:number,n:number){setPhase("shuffle");const pos=Array.from({length:n},(_,i)=>i);log.current=[pos.slice()];const stepMs=reducedMotion?65:range(200,1000,950-speed*65-difficulty*55);const total=swaps+Math.max(0,difficulty-2)*2;const turn=(step:number)=>{if(token!==session.current)return;if(step>=total){setMoving([]);setPhase("guess");return}const left=sample(n),right=(left+1+sample(n-1))%n;setMoving([left,right]);[pos[left],pos[right]]=[pos[right],pos[left]];const next=pos.slice();log.current.push(next);setPositions(next);setCompletedSwaps(step+1);later(()=>turn(step+1),stepMs)};later(()=>turn(0),reducedMotion?80:350)}
 function choose(slot:number){if(phase!=="guess")return;const identity=positions.findIndex(p=>p===slot);const success=identity===ballCup;setSelected(slot);setPhase("reveal");setAttempts(n=>n+1);setStreak(n=>success?n+1:0);const statement=success?"You found the ball!":"The ball was under cup "+(positions[ballCup]+1);setResult(statement);tone(success);finishRef.current("Follow the Ball 3D: "+statement);if(auto)later(()=>{if(session.current>0)startRound()},reducedMotion?1200:3600)}
 function replay(){if(log.current.length<2||phase==="shuffle")return;clearTimers();const token=++session.current;const frames=log.current.map(s=>[...s]);setPhase("shuffle");setSelected(null);setPositions(frames[0]);setCompletedSwaps(0);let i=1;const step=()=>{if(token!==session.current)return;if(i>=frames.length){setPhase("guess");setMoving([]);return}setPositions(frames[i]);setMoving(Array.from({length:count},(_,j)=>j));setCompletedSwaps(i);i++;later(step,reducedMotion?45:700)};later(step,250)}
 function dragStart(e:React.PointerEvent<HTMLDivElement>){if(e.target instanceof HTMLElement&&e.target.closest("button"))return;drag.current={x:e.clientX,y:e.clientY,z:angle.z,pitch:angle.x};e.currentTarget.setPointerCapture(e.pointerId)}
 function dragMove(e:React.PointerEvent<HTMLDivElement>){if(!drag.current)return;const d=drag.current;setView("free");setAngle({x:range(0,78,d.pitch+(e.clientY-d.y)*.35),z:range(-65,65,d.z+(e.clientX-d.x)*.35)})}
 const renderCount=Array.from({length:count},(_,i)=>i)
 const ballSlot=positions[ballCup]
 const revealBall=phase==="ready"||phase==="preview"||phase==="reveal"
 const seconds=phase==="shuffle"?"SHUFFLING "+completedSwaps+" / "+(swaps+Math.max(0,difficulty-2)*2):phase==="preview"?"WATCH THE BALL":phase==="guess"?"WHERE IS THE BALL?":phase==="reveal"?"REVEAL":"READY"
 const pitch=angle.x,yaw=angle.z
 return <div className={styles.root} data-skin={skin} data-disco={disco&&!reducedMotion} data-lasers={lasers&&!reducedMotion} data-motion={!reducedMotion}>
  <div className={styles.topBar}><div><span className={styles.kicker}>VIBESCHOOL ORIGINALS · FOLLOW THE BALL</span><h3>3D Shell Challenge</h3><p>Watch the ball, follow the real cup, then choose its position.</p></div><div className={styles.stats}><span><b>{streak}</b> streak</span><span><b>{attempts}</b> rounds</span></div></div>
  <div className={styles.cameraBar} role="group" aria-label="Camera views">{(["front","left","right","top","free"] as View[]).map(v=><button key={v} type="button" aria-pressed={view===v} onClick={()=>setCamera(v)}>{v==="free"?"Drag / Orbit":v==="top"?"Top":v==="front"?"Front":v==="left"?"Left":"Right"}</button>)}</div>
  <div className={styles.viewport} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} aria-label="Rotatable 3D game table. Drag to orbit the camera.">
   <div className={styles.ambient} aria-hidden="true"/>
   <div className={styles.scene} style={{["--view-x" as string]:pitch+"deg",["--view-z" as string]:yaw+"deg",["--cup-count" as string]:String(count),["--transition-ms" as string]:(reducedMotion?0:range(200,1000,950-speed*65-difficulty*55)-40)+"ms"}}>
    <div className={styles.table}><div className={styles.tableEdge}/><div className={styles.tableMark}>VIBESCHOOL</div><div className={styles.tableShine}/></div>
    {renderCount.map(id=>{const slot=positions[id],revealed=phase==="reveal"&&selected===slot,lift=phase==="preview"&&id===ballCup||revealed||(phase==="reveal"&&showCorrect&&id===ballCup),ballVisible=revealBall&&id===ballCup&&(phase!=="reveal"||revealed||showCorrect),x=(slot-(count-1)/2)*Math.min(170,800/(count+1));return <div key={id} className={styles.cupAnchor} data-moving={moving.includes(id)} style={{transform:"translate3d("+x+"px,0px,0px)",["--cup-index" as string]:String(id)}}>
     <div className={styles.cupGroup}><div className={styles.cupLift} data-raised={lift} ><div className={styles.cupBody}><div className={styles.cupHighlight}/><div className={styles.cupRim}/><div className={styles.cupTop}/><span>{id+1}</span></div></div>{ballVisible&&<div className={styles.ball} aria-label="Golden ball" />}<div className={styles.shadow}/></div>
   </div>})}
   </div>
   <div className={styles.stageLabel}><b>{seconds}</b><span>{phase==="guess"?"Tap the position below":view==="free"?"Drag on the table to change camera angle":"Choose a camera above or drag to rotate"}</span></div>
  </div>
  {phase==="guess"&&<div className={styles.choices} role="group" aria-label="Choose the ball location">{renderCount.map(slot=><button key={slot} type="button" onClick={()=>choose(slot)}><span>⌒</span> CUP {slot+1}</button>)}</div>}
  {phase==="reveal"&&<div className={styles.result} role="status"><strong>{result}</strong><span>The ball stayed with cup identity #{ballCup+1} throughout the shuffle.</span></div>}
  <div className={styles.actions}><button type="button" className={styles.primary} disabled={phase==="shuffle"||phase==="preview"} onClick={startRound}>{phase==="shuffle"||phase==="preview"?"Shuffling…":phase==="reveal"?"Play another round":"Show ball & shuffle"}</button><button type="button" disabled={phase!=="guess"&&phase!=="reveal"} onClick={replay}>Replay shuffle</button><button type="button" onClick={()=>setShowHelp(x=>!x)}>{showHelp?"Hide settings":"Game settings"}</button></div>
  {showHelp&&<div className={styles.settings}><label>Cups<select value={count} onChange={e=>updateCount(Number(e.target.value))}>{[3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label>Difficulty<select value={difficulty} onChange={e=>{cancel();setDifficulty(Number(e.target.value))}}>{["Easy","Medium","Hard","Expert"].map((x,i)=><option value={i+1} key={x}>{x}</option>)}</select></label><label>Shuffle speed · {speed}/10<input type="range" min="1" max="10" value={speed} onChange={e=>{cancel();setSpeed(Number(e.target.value))}}/></label><label>Number of swaps · {swaps}<input type="range" min="3" max="20" value={swaps} onChange={e=>{cancel();setSwaps(Number(e.target.value))}}/></label><label>Stage theme<select value={skin} onChange={e=>setSkin(e.target.value)}>{THEMES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className={styles.check}><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/> Auto-start next round after reveal</label><label className={styles.check}><input type="checkbox" checked={showCorrect} onChange={e=>setShowCorrect(e.target.checked)}/> Lift correct cup after wrong guess</label><label className={styles.check}><input type="checkbox" checked={sounds} onChange={e=>setSounds(e.target.checked)}/> Game sound effects</label><p>These are 3D CSS-rendered objects and a rotating 3D scene, not a physics-engine simulation. Cup identities and ball position are tracked explicitly.</p></div>}
 </div>
}
