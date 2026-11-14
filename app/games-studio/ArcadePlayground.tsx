"use client"
import {useEffect,useMemo,useState} from "react"
import styles from "./arcade.module.css"

type Game="race"|"boxes"|"versus"|"plinko"|"difference"|"memory"|"knockout"|"cups"
type GameProps={names:string[];onFinish:(result:string)=>void;reducedMotion:boolean}
const GAMES:{id:Game;name:string;type:string;description:string;symbol:string}[]=[
{id:"race",name:"Marble Race",type:"CHANCE",description:"Watch the contenders race to the finish.",symbol:"●"},
{id:"boxes",name:"Mystery Boxes",type:"DISCOVERY",description:"Choose a box and uncover a surprise.",symbol:"▣"},
{id:"versus",name:"VS Battle",type:"COMPETITION",description:"Put two contenders in the spotlight.",symbol:"⚔"},
{id:"plinko",name:"Plinko Drop",type:"CHANCE",description:"Watch a ball fall into a labelled slot.",symbol:"◉"},
{id:"difference",name:"Spot the Difference",type:"SKILL",description:"Find the one image that changed.",symbol:"◈"},
{id:"memory",name:"Memory Flip",type:"SKILL",description:"Pair matching symbols with fewer flips.",symbol:"▤"},
{id:"knockout",name:"Knockout Bracket",type:"COMPETITION",description:"Choose winners until a champion remains.",symbol:"◆"},
{id:"cups",name:"Follow the Ball",type:"SKILL",description:"Track the hidden ball through a shuffle.",symbol:"⌒"}
]
const DEFAULT_NAMES=["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Nyeri","Malindi","Thika"]
function randomInt(max:number){if(max<=1)return 0;if(typeof crypto!=="undefined"&&crypto.getRandomValues){const data=new Uint32Array(1);const limit=Math.floor(4294967296/max)*max;do{crypto.getRandomValues(data)}while(data[0]>=limit);return data[0]%max}return Math.floor(Math.random()*max)}
function shuffled<T>(list:T[]):T[]{const a=[...list];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function MarbleRace({names,onFinish,reducedMotion}:GameProps){
 const racers=names.slice(0,6)
 const [winner,setWinner]=useState<number|null>(null)
 const [racing,setRacing]=useState(false)
 const [finished,setFinished]=useState(false)
 useEffect(()=>{if(!racing)return;const id=window.setTimeout(()=>{setRacing(false);setFinished(true);onFinish(racers[winner??0]+" wins the Marble Race")},reducedMotion?200:3400);return()=>clearTimeout(id)},[racing,winner,reducedMotion])
 function launch(){setWinner(randomInt(racers.length));setFinished(false);setRacing(true)}
 return <div className={styles.gamePanel}><p className={styles.hint}>Simulated race · no real-world prediction</p><div className={styles.lanes}>{racers.map((name,i)=><div className={styles.lane} key={i}><span className={styles.laneName}>{name}</span><div className={styles.track}><span className={styles.marble} data-run={racing} data-winner={winner===i} data-finished={finished} style={{["--lane-color" as string]:["#ffbf69","#64edce","#bca3ff","#ff809a","#8bc1ff","#ffdf7a"][i],["--race-duration" as string]:(reducedMotion?0.05:winner===i?3.1:4.5)+"s"}}/><span className={styles.finishLine}>FINISH</span></div></div>)}</div>{finished&&<p className={styles.win}>{racers[winner??0]} crossed the finish first!</p>}<button className={styles.primary} disabled={racing} onClick={launch}>{racing?"Racing…":finished?"Race again":"Start race"}</button></div>
}
function MysteryBoxes({onFinish}:GameProps){
 const outcomes=["VibeSchool Learning Challenge","Explore Something New","Mystery Bonus Round","Discover a New Topic","Try Another Game"]
 const [prizes,setPrizes]=useState(()=>shuffled(outcomes).slice(0,3))
 const [selected,setSelected]=useState<number|null>(null)
 function play(i:number){if(selected!==null)return;setSelected(i);onFinish("Mystery Box: "+prizes[i])}
 function reset(){setPrizes(shuffled(outcomes).slice(0,3));setSelected(null)}
 return <div className={styles.gamePanel}><p className={styles.hint}>Three hidden surprises · no cash prizes</p><div className={styles.boxRow}>{prizes.map((v,i)=><button key={i} className={styles.mysteryBox} data-open={selected===i} disabled={selected!==null} onClick={()=>play(i)}><span className={styles.boxIcon}>{selected===i?"✦":"?"}</span><strong>{selected===i?v:"BOX "+(i+1)}</strong></button>)}</div>{selected!==null&&<p className={styles.win}>You uncovered: {prizes[selected]}</p>}<button className={styles.primary} onClick={reset}>Shuffle boxes</button></div>
}
function VsBattle({names,onFinish,reducedMotion}:GameProps){
 const a=names[0],b=names[1]
 const [active,setActive]=useState(false)
 const [winner,setWinner]=useState<number|null>(null)
 const [result,setResult]=useState(false)
 useEffect(()=>{if(!active)return;const id=window.setTimeout(()=>{setActive(false);setResult(true);onFinish((winner===0?a:b)+" selected in VS Battle")},reducedMotion?100:2400);return()=>clearTimeout(id)},[active,winner,a,b,reducedMotion])
 function start(){setWinner(randomInt(2));setResult(false);setActive(true)}
 return <div className={styles.gamePanel}><p className={styles.hint}>Randomised fictional battle · not a poll or prediction</p><div className={styles.vsArena} data-active={active}><div className={styles.vsLeft} data-winner={result&&winner===0}><strong>{a}</strong></div><span className={styles.vsText}>VS</span><div className={styles.vsRight} data-winner={result&&winner===1}><strong>{b}</strong></div></div>{result&&<p className={styles.win}>{winner===0?a:b} wins this simulated matchup!</p>}<button disabled={active} className={styles.primary} onClick={start}>{active?"Battle in progress…":"Launch VS Battle"}</button></div>
}
function PlinkoDrop({names,onFinish,reducedMotion}:GameProps){
 const slots=names.slice(0,5)
 const [dropping,setDropping]=useState(false)
 const [selected,setSelected]=useState<number|null>(null)
 const [done,setDone]=useState(false)
 useEffect(()=>{if(!dropping)return;const id=window.setTimeout(()=>{setDropping(false);setDone(true);onFinish("Plinko landed on "+slots[selected??0])},reducedMotion?100:2700);return()=>clearTimeout(id)},[dropping,selected,reducedMotion])
 function drop(){setSelected(randomInt(slots.length));setDone(false);setDropping(true)}
 return <div className={styles.gamePanel}><p className={styles.hint}>Simulated arcade drop · each slot has an equal programmed chance</p><div className={styles.plinkoBoard}>{Array.from({length:6},(_,r)=><div className={styles.pegRow} key={r}>{Array.from({length:r%2?6:5},(_,j)=><span key={j} className={styles.peg}/>)}</div>)}{(dropping||done)&&<div className={styles.plinkoBall} data-dropping={dropping} style={{["--plinko-x" as string]:((selected??0)+0.5)/slots.length*100+"%",["--plinko-time" as string]:(reducedMotion?.1:2.5)+"s"}}/>}<div className={styles.plinkoSlots}>{slots.map((v,i)=><span key={i} data-selected={done&&selected===i}>{v}</span>)}</div></div>{done&&<p className={styles.win}>Ball landed on {slots[selected??0]}</p>}<button disabled={dropping} className={styles.primary} onClick={drop}>{dropping?"Ball dropping…":"Drop a ball"}</button></div>
}
const PICTURES=["🌻","🚀","🌍","🎨","🎒","🦋","⭐","🎵","🐘"]
function SpotDifference({onFinish}:GameProps){
 const [target,setTarget]=useState(()=>randomInt(9))
 const [tries,setTries]=useState(0)
 const [solved,setSolved]=useState(false)
 function choose(i:number){if(solved)return;setTries(n=>n+1);if(i===target){setSolved(true);onFinish("Spot the Difference solved in "+(tries+1)+" attempts")}}
 return <div className={styles.gamePanel}><p className={styles.hint}>Find the different tile in the RIGHT picture.</p><div className={styles.picturePair}><div><strong>ORIGINAL</strong><div className={styles.pictureGrid}>{PICTURES.map((x,i)=><span key={i}>{x}</span>)}</div></div><div><strong>FIND THE CHANGE</strong><div className={styles.pictureGrid}>{PICTURES.map((x,i)=><button key={i} data-found={solved&&i===target} onClick={()=>choose(i)} disabled={solved} aria-label={"Inspect tile "+(i+1)}>{i===target?"🌈":x}</button>)}</div></div></div><p className={styles.hint}>Attempts: {tries}</p>{solved&&<p className={styles.win}>Found it in {tries} attempts!</p>}<button className={styles.primary} onClick={()=>{setTarget(randomInt(9));setTries(0);setSolved(false)}}>New puzzle</button></div>
}
const SYMBOLS=["★","◆","●","✿","☀","♫","⚡","♥"]
function makeCards(){return shuffled(SYMBOLS.slice(0,4).flatMap((symbol,i)=>[{id:i*2,symbol},{id:i*2+1,symbol}]))}
function MemoryFlip({onFinish}:GameProps){
 const [cards,setCards]=useState(makeCards)
 const [open,setOpen]=useState<number[]>([])
 const [matched,setMatched]=useState<number[]>([])
 const [flips,setFlips]=useState(0)
 useEffect(()=>{if(open.length!==2)return;const [a,b]=open;const match=cards[a].symbol===cards[b].symbol;const id=window.setTimeout(()=>{if(match)setMatched(prev=>[...prev,a,b]);setOpen([])},match?300:700);return()=>clearTimeout(id)},[open,cards])
 useEffect(()=>{if(matched.length===8)onFinish("Memory Flip complete in "+flips+" flips")},[matched.length])
 function flip(i:number){if(open.length>=2||open.includes(i)||matched.includes(i))return;setOpen(v=>[...v,i]);setFlips(v=>v+1)}
 function reset(){setCards(makeCards());setOpen([]);setMatched([]);setFlips(0)}
 return <div className={styles.gamePanel}><p className={styles.hint}>Find four matching pairs. Flips: {flips}</p><div className={styles.memoryGrid}>{cards.map((c,i)=><button key={c.id} className={styles.memoryCard} data-revealed={open.includes(i)||matched.includes(i)} data-matched={matched.includes(i)} disabled={matched.includes(i)} onClick={()=>flip(i)} aria-label={open.includes(i)||matched.includes(i)?"Symbol "+c.symbol:"Hidden card "+(i+1)}>{open.includes(i)||matched.includes(i)?c.symbol:"?"}</button>)}</div>{matched.length===8&&<p className={styles.win}>All pairs matched in {flips} flips!</p>}<button className={styles.primary} onClick={reset}>Shuffle cards</button></div>
}
function Knockout({names,onFinish}:GameProps){
 const [round,setRound]=useState(()=>names.slice(0,8))
 const [winners,setWinners]=useState<string[]>([])
 const [stage,setStage]=useState(1)
 const champion=round.length===1
 const matches=Math.floor(round.length/2)
 function pick(name:string,match:number){if(winners.length!==match)return;const updated=[...winners,name];setWinners(updated);if(updated.length===matches){if(updated.length===1){setRound(updated);setWinners([]);onFinish(updated[0]+" wins the Knockout Tournament")}else{window.setTimeout(()=>{setRound(updated);setWinners([]);setStage(x=>x+1)},350)}}}
 function reset(){setRound(names.slice(0,8));setWinners([]);setStage(1)}
 return <div className={styles.gamePanel}><p className={styles.hint}>Round {stage} · Choose each winner yourself. Bracket results are not random.</p><div className={styles.bracket}>{champion?<div className={styles.champion}>★ CHAMPION: {round[0]}</div>:Array.from({length:matches},(_,i)=><div className={styles.matchup} key={stage+"-"+i}><span>Match {i+1}</span>{round.slice(i*2,i*2+2).map(name=><button key={name} onClick={()=>pick(name,i)} disabled={winners.length!==i} data-win={winners[i]===name}>{name}</button>)}</div>)}</div><button className={styles.primary} onClick={reset}>Restart bracket</button></div>
}
function FollowBall({onFinish,reducedMotion}:GameProps){
 const [positions,setPositions]=useState([0,1,2])
 const [hidden,setHidden]=useState(false)
 const [shuffling,setShuffling]=useState(false)
 const [ball,setBall]=useState(()=>randomInt(3))
 const [guess,setGuess]=useState<number|null>(null)
 const [turn,setTurn]=useState(0)
 useEffect(()=>{if(!shuffling)return;let steps=0;const id=window.setInterval(()=>{setPositions(prev=>{const a=[...prev],i=randomInt(3),j=(i+1+randomInt(2))%3;[a[i],a[j]]=[a[j],a[i]];return a});steps++;if(steps>=7){window.clearInterval(id);window.setTimeout(()=>setShuffling(false),reducedMotion?20:430)}},reducedMotion?40:520);return()=>clearInterval(id)},[shuffling,reducedMotion,turn])
 function begin(){setPositions([0,1,2]);setBall(randomInt(3));setGuess(null);setHidden(true);setTurn(n=>n+1);setShuffling(true)}
 function pick(slot:number){if(shuffling||!hidden||guess!==null)return;setGuess(slot);const cup=positions.findIndex(x=>x===slot);onFinish(slot===positions[ball]?"Follow the Ball: correct guess!":"Follow the Ball: ball revealed in cup "+(positions[ball]+1))}
 return <div className={styles.gamePanel}><p className={styles.hint}>Watch the cups swap positions, then choose the cup holding the ball.</p><div className={styles.cupStage}>{[0,1,2].map(id=><div key={id} className={styles.cupSlot} style={{left:positions[id]*33.333+"%"}}><div className={styles.cup}>⌒</div>{(!hidden||guess!==null)&&id===ball&&<span className={styles.hiddenBall}>●</span>}</div>)}</div>{hidden&&!shuffling&&guess===null&&<div className={styles.cupChoices}>{[0,1,2].map(n=><button key={n} onClick={()=>pick(n)}>Cup {n+1}</button>)}</div>}{guess!==null&&<p className={styles.win}>{guess===positions[ball]?"You found the ball!":"The ball was under cup "+(positions[ball]+1)}</p>}<button className={styles.primary} disabled={shuffling} onClick={begin}>{shuffling?"Shuffling…":"Shuffle the cups"}</button></div>
}
export default function ArcadePlayground({campaignHeadline,cta,destination,reducedMotion}:{campaignHeadline:string;cta:string;destination:string;reducedMotion:boolean}){
 const [active,setActive]=useState<Game>("race")
 const [namesInput,setNamesInput]=useState(DEFAULT_NAMES.join(", "))
 const [recent,setRecent]=useState("")
 const [completed,setCompleted]=useState(0)
 const [showSetup,setShowSetup]=useState(false)
 const names=useMemo(()=>{const parts=namesInput.split(/[,\n]+/).map(x=>x.trim().slice(0,28)).filter(Boolean);return [...parts,...DEFAULT_NAMES].slice(0,8)},[namesInput])
 useEffect(()=>{try{const n=Number(localStorage.getItem("vibeschool.games.arcade.completed.v1"));if(Number.isInteger(n)&&n>=0)setCompleted(n);const prev=localStorage.getItem("vibeschool.games.arcade.names.v1");if(prev)setNamesInput(prev)}catch{}},[])
 function completedGame(result:string){setRecent(result);setCompleted(n=>{const next=n+1;try{localStorage.setItem("vibeschool.games.arcade.completed.v1",String(next))}catch{}return next})}
 function editNames(text:string){setNamesInput(text);try{localStorage.setItem("vibeschool.games.arcade.names.v1",text)}catch{}}
 async function share(){const text="I played "+GAMES.find(g=>g.id===active)?.name+" on VibeSchool! "+recent+" Join the challenge: https://vibeschool.co.ke/games-studio";try{if(navigator.share)await navigator.share({title:"VibeSchool Arcade Challenge",text});else await navigator.clipboard.writeText(text)}catch{}}
 const props:GameProps={names,onFinish:completedGame,reducedMotion}
 return <section className={styles.arcade} aria-label="VibeSchool non-question games">
  <div className={styles.intro}><div><span className={styles.kicker}>NEW · VIBESCHOOL ARCADE</span><h2>Not another quiz. <em>Play something different.</em></h2><p>Race, discover, compete and solve visual challenges. Eight playable games with no questions required.</p></div><div className={styles.stat}><strong>{completed}</strong><span>Local games completed</span></div></div>
  <div className={styles.gallery} role="group" aria-label="Choose an arcade game">{GAMES.map(g=><button key={g.id} type="button" className={styles.gameTile} data-active={g.id===active} aria-pressed={g.id===active} onClick={()=>{setActive(g.id);setRecent("")}}><span className={styles.symbol}>{g.symbol}</span><span><strong>{g.name}</strong><small>{g.type}</small></span></button>)}</div>
  <div className={styles.workspace}><div className={styles.titleRow}><div><span className={styles.kicker}>{GAMES.find(g=>g.id===active)?.type} / VIBESCHOOL ORIGINALS</span><h3>{GAMES.find(g=>g.id===active)?.name}</h3><p>{GAMES.find(g=>g.id===active)?.description}</p></div><button className={styles.outline} onClick={()=>setShowSetup(v=>!v)}>{showSetup?"Hide setup":"Customize names"}</button></div>
  {showSetup&&<div className={styles.setup}><label htmlFor="arcade-names">Contenders / destinations (comma or newline separated)</label><textarea id="arcade-names" value={namesInput} maxLength={480} onChange={e=>editNames(e.target.value)} rows={3}/><small>Used for Marble Race, VS Battle, Plinko and Knockout. Saved on this device. Eight entries maximum.</small></div>}
  <div className={styles.stage} key={active}>{active==="race"?<MarbleRace {...props}/>:active==="boxes"?<MysteryBoxes {...props}/>:active==="versus"?<VsBattle {...props}/>:active==="plinko"?<PlinkoDrop {...props}/>:active==="difference"?<SpotDifference {...props}/>:active==="memory"?<MemoryFlip {...props}/>:active==="knockout"?<Knockout {...props}/>:<FollowBall {...props}/>}</div>
  <div className={styles.brandFooter}><div><strong>VIBESCHOOL</strong><span>{campaignHeadline}</span></div><a href={destination} target="_blank" rel="noopener noreferrer">{cta} ↗</a></div>
  {recent&&<div className={styles.result} role="status"><strong>{recent}</strong><button onClick={()=>void share()}>Share challenge ↗</button></div>}
  </div>
 </section>
}
