import type {SlideDemo} from './LiveSlideProtocol'
import {simulationSummary} from './LiveSimulationModel'
const ink='#183a56',blue='#2466a4'
export function ScienceSimulation({demo}:{demo:SlideDemo}){
 const {kind,a,b}=demo
 if(kind==='electric-circuit')return <g>
  <path d="M40 52H137M183 52H280V132H211M109 132H40V52" fill="none" stroke={ink} strokeWidth="3" strokeLinejoin="round"/>
  <circle cx="137" cy="52" r="3.5" fill={ink}/><circle cx="183" cy="52" r="3.5" fill={ink}/>
  <path d={a===1?'M137 52H183':'M137 52L177 32'} stroke={ink} strokeWidth="3" fill="none"/>
  <text x="160" y="22" textAnchor="middle" fontSize="12" fill={ink}>{a===1?'Switch closed':'Switch open'}</text>
  <circle cx="280" cy="92" r="16" fill={a===1?'#ffe17a':'#fff'} stroke={ink} strokeWidth="2"/>
  <path d="M270 82L290 102M290 82L270 102" stroke={ink} strokeWidth="2"/>
  {Array.from({length:b},(_,i)=>{const x=160+(i-(b-1)/2)*24;return <g key={i}><path d={'M'+(x-5)+' 117V147 M'+(x+4)+' 123V141'} stroke={ink} strokeWidth="2"/>{i<b-1&&<path d={'M'+(x+4)+' 132H'+(x+19)} stroke={ink} strokeWidth="3"/>}</g>})}
  <path d={'M109 132H'+(155-(b-1)*12)+' M'+(164+(b-1)*12)+' 132H211'} stroke={ink} strokeWidth="3"/>
  <text x="160" y="170" textAnchor="middle" fontSize="13" fill={ink}>{a===1?'Bulb on':'Bulb off'} · {b} cell{b===1?'':'s'}</text>
 </g>
 if(kind==='lever-balance'){
  const left=a*2,right=b*3,tilt=left===right?0:left>right?-12:12
  return <g>
   <path d="M145 137L160 84L175 137Z" fill="#b8d9eb" stroke={blue} strokeWidth="2"/>
   <path d="M120 137H200" stroke={ink} strokeWidth="2"/>
   <g transform={'rotate('+tilt+' 160 84)'}>
    <path d="M74 84H289" stroke={ink} strokeWidth="5" strokeLinecap="round"/>
    <rect x="64" y={84-20-a*2} width="20" height={20+a*2} rx="3" fill="#70b9ea" stroke={blue}/>
    <rect x="279" y={84-20-b*2} width="20" height={20+b*2} rx="3" fill="#f4ce75" stroke="#9b7020"/>
    <text x="74" y={57-a*2} textAnchor="middle" fill={ink} fontSize="12">{a} N</text>
    <text x="289" y={57-b*2} textAnchor="middle" fill={ink} fontSize="12">{b} N</text>
    <text x="117" y="103" textAnchor="middle" fill={ink} fontSize="11">2 m</text>
    <text x="224" y="103" textAnchor="middle" fill={ink} fontSize="11">3 m</text>
   </g>
   <circle cx="160" cy="84" r="5" fill={ink}/>
   <text x="160" y="154" textAnchor="middle" fontSize="12" fill={ink}>Left: {left} N m · Right: {right} N m</text>
   <text x="160" y="171" textAnchor="middle" fontSize="12" fill={ink}>{left===right?'Balanced':left>right?'Left side turns down':'Right side turns down'}</text>
  </g>
 }
 if(kind==='map-scale'){
  const end=28+a*22
  return <g>
   <rect x="15" y="15" width="290" height="126" rx="6" fill="#e8f3e7" stroke="#78977a"/>
   <path d="M16 45Q77 14 127 45T242 40T305 33M16 126Q77 98 127 125T240 115T305 121" fill="none" stroke="#9bbda0" strokeWidth="9"/>
   <path d={'M28 75H'+end} stroke={blue} strokeWidth="4" strokeLinecap="round"/>
   <circle cx="28" cy="75" r="5" fill={ink}/><circle cx={end} cy="75" r="5" fill="#bf3038"/>
   <text x="28" y="62" textAnchor="middle" fontSize="10" fill={ink}>A</text><text x={end} y="62" textAnchor="middle" fontSize="10" fill={ink}>B</text>
   <path d="M28 105H292" stroke={ink} strokeWidth="2"/>
   {Array.from({length:13},(_,i)=><g key={i}><path d={'M'+(28+22*i)+' 102V110'} stroke={ink}/>{i%2===0&&<text x={28+22*i} y="122" textAnchor="middle" fontSize="9" fill={ink}>{i}</text>}</g>)}
   <text x="160" y="135" textAnchor="middle" fontSize="10" fill={ink}>Map distance (cm)</text>
   <text x="160" y="161" textAnchor="middle" fontSize="13" fill={ink}>{simulationSummary(demo)}</text>
   <text x="160" y="175" textAnchor="middle" fontSize="9" fill={ink}>Illustrative map, not a real location</text>
  </g>
 }
 return null
}
