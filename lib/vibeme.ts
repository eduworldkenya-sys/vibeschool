// Original VibeSchool vector avatar, version 1. All interpolation is from
// bounded, validated integer choices, never arbitrary user-supplied SVG.
export const VIBEME_OPTIONS = [
  { label: 'Skin tone', values: ['Light', 'Honey', 'Warm', 'Brown', 'Deep', 'Rich'] },
  { label: 'Hair', values: ['Coils', 'Fade', 'Braids', 'Locs', 'Bun', 'Bald'] },
  { label: 'Face', values: ['Round', 'Oval', 'Square'] },
  { label: 'Expression', values: ['Happy', 'Curious', 'Calm'] },
  { label: 'Accessory', values: ['None', 'Glasses', 'Earrings', 'Headphones'] },
  { label: 'Clothing', values: ['Blue', 'Purple', 'Green', 'Amber', 'Rose', 'Charcoal'] },
  { label: 'Background', values: ['Mint', 'Peach', 'Sky', 'Lilac', 'Pink', 'Gold'] },
] as const
const PREFIX = '/api/vibeme/'
export const DEFAULT_VIBEME = 'v1-2000000'
export function parseVibeMe(code: string): number[] | null {
  if (!/^v1-[0-9]{7}$/.test(code)) return null
  const parts = code.slice(3).split('').map(Number)
  return parts.every((n,i) => n < VIBEME_OPTIONS[i].values.length) ? parts : null
}
export function vibeMeCode(parts: readonly number[]): string {
  const code = 'v1-' + parts.join('')
  return parts.length === 7 && parts.every(Number.isInteger) && parseVibeMe(code) ? code : DEFAULT_VIBEME
}
export function vibeMePath(code: string): string {
  return PREFIX + (parseVibeMe(code) ? code : DEFAULT_VIBEME) + '.svg'
}
export function codeFromAvatar(url: string | null | undefined): string | null {
  if (!url) return null
  const match = /^(?:https:\/\/vibeschool\.co\.ke)?\/api\/vibeme\/(v1-[0-9]{7})\.svg$/.exec(url)
  return match && parseVibeMe(match[1]) ? match[1] : null
}
export function defaultVibeMe(seed: string): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return vibeMeCode(VIBEME_OPTIONS.map(o => {
    h = Math.imul(h ^ (h >>> 15), 2246822519)
    return (h >>> 0) % o.values.length
  }))
}
export function renderVibeMe(code: string): string | null {
  const parts = parseVibeMe(code)
  if (!parts) return null
  const [s,h,f,e,a,c,b] = parts
  const skin = ['#F0C29B','#D69B70','#A96440','#855033','#603928','#402922'][s]
  const shirt = ['#246D98','#734CB0','#29836B','#C26D38','#C44964','#393B49'][c]
  const bg = ['#BDE9DA','#F8D3B2','#C9D9FC','#E2D0FA','#F7CADC','#F2E7AE'][b]
  const face = ['M72 99 Q72 49 130 49 Q188 49 188 99 L188 136 Q183 185 130 185 Q77 185 72 136Z','M79 89 Q79 44 130 44 Q181 44 181 89 L184 133 Q176 192 130 192 Q84 192 76 133Z','M73 83 Q74 49 105 49 H155 Q186 49 187 83 V146 Q184 180 153 185 H107 Q75 180 73 146Z'][f]
  const coils = [[79,77,20],[95,57,23],[122,48,25],[151,51,24],[178,66,22],[184,87,16],[72,96,12]].map(([x,y,r])=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'"/>').join('')
  const hair = [
    coils,
    '<path d="M72 111V82Q72 40 130 41Q188 41 188 82V111L176 86Q130 67 84 86Z"/>',
    '<path d="M71 108Q55 35 130 35Q205 35 189 108L176 79Q130 59 84 79Z"/>'+[68,82,178,192].map(x=>'<rect x="'+(x-6)+'" y="67" width="12" height="103" rx="6"/>').join(''),
    [77,94,111,128,145,162,179].map((x,i)=>'<rect x="'+(x-10)+'" y="'+(32+Math.abs(3-i)*5)+'" width="21" height="'+(i%2===0?65:48)+'" rx="10"/>').join(''),
    '<circle cx="132" cy="35" r="29"/><path d="M71 110Q52 49 130 49Q208 49 189 110L177 79Q128 113 84 83Z"/>',''
  ][h]
  const eyes = e===0 ? '<path d="M96 127Q105 116 114 127M146 127Q155 116 164 127" stroke="#302630" stroke-width="4.5" fill="none" stroke-linecap="round"/>' : [105,155].map(x=>'<ellipse cx="'+x+'" cy="126" rx="10" ry="12" fill="#FFF8EF"/><ellipse cx="'+(x+1)+'" cy="127" rx="5.5" ry="7.5" fill="#27212B"/><circle cx="'+(x+3)+'" cy="124" r="2" fill="white"/>').join('')
  const mouth = e===2 ? '<path d="M119 160Q130 166 141 160" fill="none" stroke="#44252C" stroke-width="3" stroke-linecap="round"/>' : '<path d="M114 156Q130 161 146 156Q140 172 130 172Q120 172 114 156Z" fill="#51262C"/><path d="M118 158Q130 161 142 158L139 163H121Z" fill="#FFF7EC"/>'
  const accessory = ['', '<g stroke="#27334B" stroke-width="3.5" fill="none"><rect x="87" y="113" width="36" height="28" rx="11"/><rect x="137" y="113" width="36" height="28" rx="11"/><path d="M123 123Q130 118 137 123M87 123H72M173 123H188"/></g>', '<g fill="#FFD16C" stroke="#EEA834" stroke-width="2"><circle cx="69" cy="142" r="6"/><circle cx="191" cy="142" r="6"/></g>', '<path d="M65 126V93A65 65 0 0 1 195 93V126" stroke="#303047" stroke-width="9" fill="none"/><rect x="54" y="112" width="19" height="38" rx="9" fill="#303047"/><rect x="187" y="112" width="19" height="38" rx="9" fill="#303047"/>'][a]
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260"><defs><clipPath id="v"><circle cx="130" cy="130" r="124"/></clipPath></defs><circle cx="130" cy="130" r="124" fill="'+bg+'"/><g clip-path="url(#v)"><circle cx="205" cy="43" r="49" fill="white" opacity=".23"/><path d="M0 178L85 260H0Z" fill="white" opacity=".25"/><path d="M205 84l9 14-9 14-9-14Z" fill="white" opacity=".7"/><path d="M40 260Q39 200 98 190H162Q221 200 220 260Z" fill="'+shirt+'"/><rect x="112" y="163" width="36" height="42" rx="15" fill="'+skin+'"/><path d="M95 191L130 216L165 191L149 188L130 199L111 188Z" fill="white" opacity=".85"/><g fill="'+skin+'"><ellipse cx="70" cy="125" rx="13" ry="18"/><ellipse cx="190" cy="125" rx="13" ry="18"/><path d="'+face+'"/></g><g fill="#29212B">'+hair+'</g><path d="M93 110Q105 103 117 110M143 110Q155 103 167 110" stroke="#372631" stroke-width="4" stroke-linecap="round" fill="none"/>'+eyes+'<path d="M130 130L126 144Q131 148 136 144" fill="none" stroke="#4B2523" opacity=".5" stroke-width="3" stroke-linecap="round"/>'+mouth+accessory+'<path d="M160 226L169 234L179 219L172 243Z" fill="#CDFF00" stroke="#22242A" stroke-width="1.5"/></g><circle cx="130" cy="130" r="124" fill="none" stroke="#20242B" stroke-width="3"/><path d="M211 30L232 51" stroke="#CDFF00" stroke-width="6" stroke-linecap="round"/></svg>'
}
