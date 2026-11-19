// VibeMe v2: original character assets. No personal data, URLs or custom markup
// are accepted; every SVG consists solely of bounded authored geometry.
import { parseCharacter } from "./vibeme-character-contract.mjs"
export { CHARACTER_OPTIONS, CHARACTER_PATTERN, parseCharacter } from "./vibeme-character-contract.mjs"
export function characterChoices(legacy:readonly number[],learner=false):number[] {
  return legacy.length===16 && parseCharacter('v2-'+legacy.join('')) ? [...legacy] :
    [...legacy.slice(0,7),0,learner?1:0,0,0,learner?1:0,0,0,0,0]
}
export function characterCode(parts:readonly number[]):string {
  const code='v2-'+parts.join('')
  return parts.every(Number.isInteger)&&parseCharacter(code)?code:'v2-2000000000000000'
}
export function renderCharacter(code:string):string|null {
  const p=parseCharacter(code)
  if(!p)return null
  const [s,h,f,e,a,c,b,style,age,frame,beard,outfit,hat,aid,pose,motion]=p
  const skin=['#F0C29B','#D69B70','#A96440','#855033','#603928','#402922'][s]
  const shirt=['#246D98','#734CB0','#29836B','#C26D38','#C44964','#393B49'][c]
  const bg=['#BDE9DA','#F8D3B2','#C9D9FC','#E2D0FA','#F7CADC','#F2E7AE'][b]
  const dark='#29212B', outline='#29252F'
  const face=['M79 105Q79 55 130 55Q181 55 181 105V131Q176 177 130 177Q84 177 79 131Z','M85 102Q85 47 130 47Q175 47 175 102L178 130Q170 185 130 185Q90 185 82 130Z','M79 97Q79 56 106 56H154Q181 56 181 97V143Q180 174 151 179H109Q80 174 79 143Z'][f]
  const hair=[
    [[83,82,22],[98,60,23],[130,52,26],[157,59,23],[177,83,22]].map(([x,y,r])=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'"/>').join(''),
    '<path d="M78 115V87Q78 45 130 45Q182 45 182 87V115L168 84Q130 76 92 84Z"/>',
    '<path d="M75 108Q63 36 130 36Q197 36 185 108L168 76H92Z"/>'+[76,88,172,184].map(x=>'<rect x="'+(x-6)+'" y="72" width="12" height="104" rx="6"/>').join(''),
    [82,98,114,130,146,162,178].map((x,i)=>'<rect x="'+(x-10)+'" y="'+(37+Math.abs(3-i)*5)+'" width="21" height="'+(i%2===0?63:49)+'" rx="10"/>').join(''),
    '<circle cx="132" cy="34" r="27"/><path d="M77 108Q61 52 130 52Q199 52 183 108L171 80Q128 108 89 82Z"/>','',
    '<circle cx="130" cy="77" r="72"/><path d="M80 102Q82 54 130 54Q178 54 180 102Z" fill="'+skin+'"/>',
    '<path d="M73 166Q38 60 93 43Q159 14 188 61Q210 106 187 166L170 92Q130 82 106 61L91 106Z"/>'
  ][h]
  const headwear=['','<path d="M62 170Q47 65 89 39Q130 10 171 39Q214 65 198 170L163 190L146 167Q195 102 164 68Q130 37 96 68Q65 103 114 167L97 190Z" fill="'+shirt+'"/>','<path d="M73 91Q70 38 130 38Q190 38 187 91Z" fill="'+shirt+'"/><path d="M77 91Q139 79 204 94Q197 106 127 101Z" fill="'+outline+'"/>','<path d="M89 79L96 37H164L171 79Z" fill="'+shirt+'"/><ellipse cx="130" cy="83" rx="77" ry="13" fill="'+outline+'"/>'][hat]
  const eyeOpen='<g class="eyes">'+[105,155].map(x=>'<ellipse cx="'+x+'" cy="117" rx="9" ry="11" fill="#FFF8EF"/><ellipse cx="'+(x+1)+'" cy="118" rx="4.7" ry="7" fill="'+dark+'"/><circle cx="'+(x+3)+'" cy="114" r="2" fill="white"/>').join('')+'</g>'
  const eyes=e===0?'<g class="eyes"><path d="M96 118Q105 108 114 118M146 118Q155 108 164 118" stroke="'+dark+'" stroke-width="4" fill="none" stroke-linecap="round"/></g>':eyeOpen
  const brow=e===5?'<path d="M95 103L115 97M145 97L165 106"':e===4?'<path d="M95 99Q105 95 115 100M145 105L165 105"':'<path d="M95 101Q105 95 115 101M145 101Q155 95 165 101"'
  const brows=brow+' stroke="'+dark+'" stroke-width="'+(style===1?5:3)+'" stroke-linecap="round" fill="none"/>'
  const lashes=style===2?'<path d="M96 114L91 110M164 114L169 110M99 111L96 106M161 111L164 106" stroke="'+dark+'" stroke-width="2" fill="none"/>':''
  const mouth=e===3?'<ellipse cx="130" cy="151" rx="12" ry="15" fill="#51262C"/>':e===4||e===5?'<path d="M120 154Q130 147 140 154" stroke="#51262C" stroke-width="3" fill="none"/>':e===2?'<path d="M120 152Q130 158 140 152" stroke="#51262C" stroke-width="3" fill="none"/>':'<path d="M115 148Q130 156 145 148Q140 166 130 166Q120 166 115 148Z" fill="#51262C"/><path d="M118 150Q130 153 142 150L138 155H122Z" fill="white"/>'
  const facialHair=beard===1?'<path d="M91 139Q96 183 130 185Q164 183 169 139L153 155Q130 177 107 155Z" fill="'+dark+'"/>':beard===2?'<path d="M106 143Q118 132 130 142Q142 132 154 143Q142 150 130 145Q118 150 106 143Z" fill="'+dark+'"/>':''
  const accessory=['','<g stroke="'+outline+'" stroke-width="3.5" fill="none"><rect x="88" y="104" width="34" height="27" rx="11"/><rect x="138" y="104" width="34" height="27" rx="11"/><path d="M122 115H138"/></g>','<g fill="#F8C65E"><circle cx="73" cy="137" r="6"/><circle cx="187" cy="137" r="6"/></g>','<path d="M66 119V94A64 64 0 0 1 194 94V119" stroke="'+outline+'" stroke-width="8" fill="none"/><rect x="58" y="112" width="17" height="35" rx="8" fill="'+outline+'"/><rect x="185" y="112" width="17" height="35" rx="8" fill="'+outline+'"/>'][a]
  const hearing=aid===1?'<path d="M188 109Q201 110 195 126L190 132" stroke="#F2B94F" stroke-width="6" fill="none" stroke-linecap="round"/>':''
  const attire=['<path d="M110 187L130 207L150 187" stroke="#FFF" stroke-width="5" fill="none"/>','<path d="M98 186L130 209L162 186" fill="#FFF"/><path d="M122 202H138L130 233L120 230Z" fill="#D94B40"/><rect x="151" y="211" width="15" height="12" rx="2" fill="#FFF"/>','<path d="M99 185L130 225L161 185L146 182L130 201L114 182Z" fill="#FFF"/><path d="M126 201H134L138 230L130 238L122 230Z" fill="#28364B"/>'][outfit]
  const book='<g transform="translate(0 2)"><path d="M85 219Q109 210 130 224Q151 210 175 219V253Q152 247 130 259Q108 247 85 253Z" fill="#FFF" stroke="#26384D" stroke-width="3"/><path d="M130 224V258" stroke="#26384D" stroke-width="2"/></g>'
  const arm=pose===4||motion===2?'<g class="wave" transform-origin="177px 210px"><path d="M177 213Q195 204 210 179L222 141" stroke="'+shirt+'" stroke-width="18" fill="none" stroke-linecap="round"/><circle cx="222" cy="134" r="12" fill="'+skin+'"/></g>':pose===2?'<path d="M176 213L222 187L235 154" stroke="'+shirt+'" stroke-width="17" fill="none" stroke-linecap="round"/><circle cx="235" cy="151" r="10" fill="'+skin+'"/>':''
  const prop=pose===1?book:pose===3?book+'<path d="M162 229L182 207" stroke="#E4AB39" stroke-width="5" stroke-linecap="round"/>':pose===2?'<path d="M235 151L249 111" stroke="#414A53" stroke-width="3"/>':''
  const cane=aid===3?'<path d="M205 233Q219 218 229 234V333" stroke="#3B363C" stroke-width="7" fill="none" stroke-linecap="round"/>':''
  const wheels=aid===2?'<g stroke="#343A45" stroke-width="5" fill="#D9E4EF"><circle cx="89" cy="301" r="38"/><circle cx="171" cy="301" r="38"/><path d="M89 263V339M51 301H127M171 263V339M133 301H209" stroke-width="2"/><rect x="88" y="265" width="85" height="18" rx="8" fill="#343A45"/></g>':''
  const full=frame===2||aid===2||aid===3
  const view=full?'0 0 260 360':frame===1||pose!==0||motion===2?'0 0 260 285':'0 0 260 260'
  const scale=age===2?.83:age===1?.93:1
  const y=age===2?30:age===1?12:0
  const body='<path d="M75 190Q130 174 185 190L201 253Q196 274 164 274H96Q64 274 59 253Z" fill="'+shirt+'"/>'+attire+'<path d="M155 238L164 246L174 229L167 253Z" fill="#CDFF00" stroke="'+outline+'" stroke-width="1"/>'
  const legs=full&&aid!==2?'<path d="M101 268L99 331M159 268L161 331" stroke="#303A50" stroke-width="24" stroke-linecap="round"/><path d="M85 338H109M151 338H175" stroke="'+outline+'" stroke-width="15" stroke-linecap="round"/>':''
  const animation='<style>@media (prefers-reduced-motion: no-preference){'+(motion===1?'.eyes{transform-box:fill-box;transform-origin:center;animation:blink 2s ease 2}@keyframes blink{0%,85%,100%{transform:scaleY(1)}90%{transform:scaleY(.1)}}':motion===2?'.wave{transform-origin:177px 210px;animation:wave .7s ease-in-out 4 alternate}@keyframes wave{to{transform:rotate(-16deg)}}':motion===3?'.spark{animation:celebrate .8s ease-in-out 3 alternate}@keyframes celebrate{to{opacity:.1}}':'')+'}</style>'
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+view+'">'+animation+'<rect width="260" height="360" rx="34" fill="'+bg+'"/><circle cx="222" cy="37" r="37" fill="white" opacity=".3"/><path class="spark" d="M220 21L230 39L250 43L232 53L228 73L216 55L196 51L213 39Z" fill="#CDFF00" stroke="'+outline+'" stroke-width="2"/><g transform="translate('+((1-scale)*130)+' '+y+') scale('+scale+')">'+wheels+legs+body+'<rect x="113" y="160" width="34" height="35" rx="12" fill="'+skin+'"/><g fill="'+skin+'"><ellipse cx="73" cy="117" rx="11" ry="17"/><ellipse cx="187" cy="117" rx="11" ry="17"/><path d="'+face+'"/></g><g fill="'+dark+'">'+hair+'</g>'+headwear+brows+eyes+lashes+'<path d="M130 123L126 137Q130 142 135 137" stroke="#58332A" stroke-width="2.5" fill="none" opacity=".65"/>'+mouth+facialHair+accessory+hearing+arm+prop+cane+'</g></svg>'
}
