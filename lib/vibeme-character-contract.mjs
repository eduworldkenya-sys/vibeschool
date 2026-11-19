// Shared bounded character contract for native Node authoring and application code.
export const CHARACTER_OPTIONS = [
  {label:'Skin tone',values:['Light','Honey','Warm','Brown','Deep','Rich']},
  {label:'Hair',values:['Coils','Fade','Braids','Locs','Bun','Bald','Afro','Long hair']},
  {label:'Face',values:['Round','Oval','Square']},
  {label:'Expression',values:['Happy','Curious','Calm','Excited','Thinking','Confused']},
  {label:'Accessory',values:['None','Glasses','Earrings','Headphones']},
  {label:'Clothing colour',values:['Blue','Purple','Green','Amber','Rose','Charcoal']},
  {label:'Background',values:['Mint','Peach','Sky','Lilac','Pink','Gold']},
  {label:'Character style',values:['Custom','Male','Female']},
  {label:'Age appearance',values:['Adult','Teenager','Child']},
  {label:'Framing',values:['Headshot','Half body','Full body']},
  {label:'Facial hair',values:['None','Beard','Moustache']},
  {label:'Outfit',values:['Casual','School uniform','Professional']},
  {label:'Headwear',values:['None','Hijab','Cap','Hat']},
  {label:'Accessibility',values:['None','Hearing aid','Wheelchair','Walking cane']},
  {label:'Pose',values:['Neutral','Reading','Teaching','Writing','Waving']},
  {label:'Animation',values:['Still','Blink','Wave','Celebrate']},
]
export const CHARACTER_PATTERN = /^v2-[0-9]{16}$/
/** @param {string} code @returns {number[] | null} */
export function parseCharacter(code) {
  if(!CHARACTER_PATTERN.test(code))return null
  const parts=code.slice(3).split('').map(Number)
  return parts.every((v,i)=>v<CHARACTER_OPTIONS[i].values.length)?parts:null
}
