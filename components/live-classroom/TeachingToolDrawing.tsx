import type {SlideDemo} from './LiveSlideProtocol'
import {teachingToolModel} from './TeachingToolModels.mjs'

const blue = '#2563a7'
const amber = '#a65a14'
const ink = '#183a56'
const water = '#9ad5f4'
const faint = '#dbe7ef'
const steps = (count: number) => Array.from({length: count}, (_,i) => i)

function Text({x=160,y=156,children}:{x?:number;y?:number;children:React.ReactNode}) {
  return <text x={x} y={y} fill={ink} textAnchor="middle" fontSize="12">{children}</text>
}

function Bars({a,b,max,labels}:{a:number;b:number;max:number;labels:[string,string]}) {
  return <>{[a,b].map((n,i) => {
    const x = 85 + i * 150
    const height = n / max * 100
    return <g key={i}><rect x={x-35} y={122-height} width="70" height={height} fill={i ? amber : blue}/><Text x={x} y={116-height}>{n}</Text><Text x={x} y={146}>{labels[i]}</Text></g>
  })}<path d="M30 122H290" stroke={ink}/></>
}

export function TeachingToolDrawing({demo}:{demo:SlideDemo}) {
  const {kind,a,b} = demo
  const model = teachingToolModel(kind)
  if (!model) return null

  switch (kind) {
    case 'counter-groups':
      return <>{[a,b].map((count,group) => <g key={group}>
        <rect x={10+group*155} y="18" width="145" height="126" rx="8" fill={faint}/>
        {steps(count).map(i => <circle key={i} cx={29+group*155+(i%6)*21} cy={37+Math.floor(i/6)*27} r="8" fill={group ? amber : blue}/>)}
        <Text x={82+group*155} y={163}>{group ? 'B' : 'A'} · {count}</Text>
      </g>)}</>
    case 'base-ten-blocks':
      return <>{steps(a).map(i => <g key={i}>{steps(10).map(j => <rect key={j} x={28+i*18} y={20+j*10} width="14" height="9" rx="1" fill={blue}/>)}</g>)}
        {steps(b).map(i => <rect key={i} x={214+(i%3)*23} y={55+Math.floor(i/3)*22} width="19" height="18" rx="2" fill={amber}/>)}
        <Text x={98}>{a} tens</Text><Text x={248}>{b} ones</Text></>
    case 'times-array':
      return <>{steps(a*b).map(i => <circle key={i} cx={160+(i%b-(b-1)/2)*23} cy={79+(Math.floor(i/b)-(a-1)/2)*13} r="5" fill={blue}/>)}<Text>{a} rows × {b} columns</Text></>
    case 'equal-groups': {
      const perGroup = Math.floor(a/b)
      return <>{steps(b).map(i => {
        const columns = Math.min(3,b)
        const width = 290/columns
        const height = 113/Math.ceil(b/columns)
        const x = 15+i%columns*width
        const y = 16+Math.floor(i/columns)*height
        return <g key={i}><rect x={x} y={y} width={width-4} height={height-4} rx="5" fill={faint}/>
          {steps(perGroup).map(j => <circle key={j} cx={x+9+(j%9)*9} cy={y+9+Math.floor(j/9)*7} r="3.4" fill={blue}/>)}</g>
      })}{steps(a%b).map(i => <circle key={i} cx={18+i*15} cy="147" r="5" fill={amber}/>)}<Text x={235}>{a%b} left over</Text></>
    }
    case 'percent-grid':
      return <>{steps(100).map(i => <rect key={i} x={90+i%10*14} y={12+Math.floor(i/10)*14} width="13" height="13" fill={i<a ? blue : faint}/>)}<Text y={172}>{a}%</Text></>
    case 'rectangle-area':
    case 'triangle-area': {
      const width = 14*a
      const height = 14*b
      const x = (320-width)/2
      const y = 137-height
      return <>{kind==='rectangle-area'
        ? steps(a*b).map(i => <rect key={i} x={x+i%a*14} y={y+Math.floor(i/a)*14} width="14" height="14" fill={water} stroke="white"/>)
        : <><path d={`M${x} 137h${width}v${-height}z`} fill={water} stroke={blue}/><path d={`M${x+width-12} 137v-12h12`} fill="none" stroke={ink}/></>}
        <Text y={158}>{a} cm</Text><Text x={x+width+23} y={y+height/2+4}>{b} cm</Text></>
    }
    case 'regular-polygon':
      return <><polygon points={steps(a).map(i => {
        const theta = (i*360/a+b)*Math.PI/180
        return `${160+63*Math.sin(theta)},${79-63*Math.cos(theta)}`
      }).join(' ')} fill={water} stroke={blue} strokeWidth="2"/><Text y={165}>{a} sides</Text></>
    case 'linear-graph':
      return <><svg x="72" y="8" width="176" height="160" viewBox="-5.5 -5 11 10">
        {steps(11).map(i => <path key={i} d={`M${i-5} -5V5 M-5.5 ${i-5}H5.5`} stroke={faint} strokeWidth=".06"/>)}
        <path d="M-5.5 0H5.5 M0 -5V5" stroke={ink} strokeWidth=".08"/>
        <path d={`M-5.5 ${5.5*a-b}L5.5 ${-5.5*a-b}`} stroke={blue} strokeWidth=".17"/><circle cy={-b} r=".18" fill={amber}/>
      </svg><Text x={251} y={83}>x</Text><Text x={169} y={17}>y</Text></>
    case 'clock-elapsed':
      return <><path d="M36 80H282l-12 -7m12 7l-12 7" fill="none" stroke={blue} strokeWidth="3"/>
        {[a,a+b].map((n,i) => <g key={i}><circle cx={i ? 264 : 48} cy="80" r="6" fill={amber}/>
          <Text x={i ? 264 : 48} y={113}>{String(Math.floor(n/60)%24).padStart(2,'0')}:{String(n%60).padStart(2,'0')}</Text></g>)}
        <Text y={65}>{b} min</Text></>
    case 'fraction-equivalence':
      return <>{[1,b].map((factor,row) => steps(5*factor).map(i => {
        const width=280/(5*factor)
        return <rect key={row+':'+i} x={20+i*width} y={38+row*58} width={width} height="35" stroke={blue} fill={i<a*factor ? water : '#fff'}/>
      }))}</>
    case 'bar-comparison':
    case 'change-calculator':
    case 'rainfall-total':
    case 'budget-balance':
    case 'business-profit':
      return <Bars a={a} b={b} max={Math.max(model.a[1],model.b[1])} labels={model.labels}/>
    case 'mass-scale': {
      const tilt = (a-b)*.17
      return <><path d="M135 152L160 83L185 152Z" fill={faint} stroke={ink}/>
        <g transform={`rotate(${-tilt} 160 78)`} stroke={ink}><path d="M56 104v-26h208v26" fill="none" strokeWidth="2"/>
          <path d="M29 104H83M237 104h54" strokeWidth="4"/><rect x="39" y={104-a*.35} width="34" height={a*.35} fill={blue}/><rect x="247" y={104-b*.35} width="34" height={b*.35} fill={amber}/></g>
        <Text x={55}>{a} g</Text><Text x={265}>{b} g</Text></>
    }
    case 'volume-cylinder':
    case 'thermometer': {
      const temperature = kind==='thermometer'
      const normalized = temperature ? (a+20)/70 : a/100
      return <><rect x="130" y="23" width="54" height="126" rx={temperature ? 19 : 4} fill={faint}/>
        <rect x="136" y={142-110*normalized} width="42" height={110*normalized} fill={temperature ? '#b94346' : water}/>
        {steps(temperature?8:6).map(i => {
          const y = 142-i*110/(temperature?7:5)
          return <g key={i}><path d={`M173 ${y}h10`} stroke={ink}/><Text x={205} y={y+4}>{temperature ? -20+i*10 : i*20}</Text></g>
        })}</>
    }
    case 'water-states':
      return <>{steps(30).map(i => {
        const solid=a<=0, gas=a>=100
        const x=gas ? 37+i*73%248 : 101+i%6*22+(solid ? 0 : Math.sin(i)*5)
        const y=gas ? 22+i*47%122 : (solid ? 40 : 71)+Math.floor(i/6)*17
        return <circle key={i} cx={x} cy={y} r="5" fill={blue}/>
      })}<Text y={166}>{a} °C · schematic particles</Text></>
    case 'shadow-length': {
      const tangent=Math.tan(b*Math.PI/180)
      const width=160/Math.max(tangent,1)
      const height=Math.min(112,width*tangent*.7)
      const run = height/tangent
      const scale = Math.min(1,a/6+.28)
      return <><path d="M24 132H296" stroke={ink}/><path d={`M270 132v${-height*scale}l${-run*scale} ${height*scale}z`} fill={faint} stroke={blue}/>
        <Text x={267} y={157}>{a} m</Text></>
    }
    case 'magnification':
      return <><circle cx="160" cy="78" r="63" fill={faint} stroke={ink}/>
        {steps(7).map(i => <circle key={i} cx={132+i%3*28} cy={51+Math.floor(i/3)*23} r={Math.min(12,2+Math.sqrt(a*b)/2.6)} fill={blue}/>)}
        <Text y={165}>{a*b}× · schematic view</Text></>
    case 'buoyancy': {
      const top = a<b ? 62-42*(1-a/b) : a===b ? 80 : 106
      return <><rect x="42" y="62" width="236" height="86" fill={water}/><path d="M42 49V148H278V49" fill="none" stroke={ink}/>
        <rect x="131" y={top} width="58" height="42" rx="3" fill={amber}/><Text y={166}>{a} / {b} kg/m³</Text></>
    }
    case 'ideal-pulley':
      return <>{steps(b).map(i => <path key={i} d={`M${130+i*20} 39v71`} stroke={ink} strokeWidth="2"/>)}
        <rect x="110" y="27" width="100" height="12" rx="3" fill={blue}/><rect x="110" y="110" width="100" height="28" rx="4" fill={amber}/><Text>{a} N</Text></>
    case 'pendulum-period': {
      const length=29+a*.6, radians=b*Math.PI/180
      const x=160+length*Math.sin(radians), y=24+length*Math.cos(radians)
      return <><path d={`M160 24V${24+length} M160 24L${x} ${y}`} stroke={ink}/><circle cx={x} cy={y} r="11" fill={blue}/><Text>{a} cm · {b}°</Text></>
    }
    case 'compass-bearing':
      return <><circle cx="160" cy="82" r="54" fill={faint} stroke={blue}/><Text y={22}>N</Text><Text x={226} y={86}>E</Text><Text y={153}>S</Text><Text x={94} y={86}>W</Text>
        <path d="M160 46l10 43l-10-5l-10 5z" fill={amber} transform={`rotate(${a} 160 82)`}/></>
    case 'rhythm-beats':
    case 'lap-distance':
    case 'irrigation-water': {
      const count = kind === 'lap-distance' ? b : a
      return <>{steps(count).map(i => <g key={i}>
        <rect x={17+i%10*29} y={36+Math.floor(i/10)*43} width="25" height="31" rx="4" fill={i%4===0 ? amber : blue}/>
        <text x={29+i%10*29} y={56+Math.floor(i/10)*43} textAnchor="middle" fontSize="11" fill="white">{i+1}</text>
      </g>)}<Text>{kind==='lap-distance' ? `${a} m per lap` : kind==='irrigation-water' ? `${b} L per plant` : `${b} beats/min`}</Text></>
    }
    default:
      return <>{[a,b].map((value,i) => <g key={i}><rect x={22+i*143} y="38" width="133" height="87" rx="10" fill={faint}/>
        <text x={88+i*143} y="78" textAnchor="middle" fontSize="25" fontWeight="700" fill={ink}>{value}</text>
        <Text x={88+i*143} y={106}>{model.labels[i]}</Text></g>)}</>
  }
}
