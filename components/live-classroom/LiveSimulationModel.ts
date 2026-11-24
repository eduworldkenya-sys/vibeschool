import type {SlideDemo} from './LiveSlideProtocol'
export function simulationSummary(demo:SlideDemo):string|null{
 const {kind,a,b}=demo
 if(kind==='electric-circuit')return (a===1?'Closed circuit — bulb on':'Open circuit — bulb off')+' · '+b+' cell'+(b===1?'':'s')
 if(kind==='lever-balance'){const left=2*a,right=3*b;return 'Left '+left+' N m · Right '+right+' N m · '+(left===right?'Balanced':left>right?'Left side down':'Right side down')}
 if(kind==='map-scale')return a+' cm × '+b+' km/cm = '+(a*b)+' km'
 return null
}
