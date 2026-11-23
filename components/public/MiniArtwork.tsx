import type { MiniExample } from '@/lib/public/mini-examples'
import styles from './MiniExplore.module.css'

export function MiniArtwork({ kind }: { kind: MiniExample['cover'] }) {
  if (kind === 'history') return <div className={styles.art + ' ' + styles.historyArt} role="img" aria-label="Illustrated Kenyan flag">
    <svg viewBox="0 0 420 260" aria-hidden="true">
      <circle cx="338" cy="43" r="100" fill="#efe4cc" opacity=".23" />
      <path d="M75 225V31" stroke="#3d3429" strokeWidth="7" strokeLinecap="round" />
      <path d="M78 36Q174 9 290 38V178Q185 151 78 185Z" fill="#151515" />
      <path d="M78 77Q188 54 290 78V117Q185 96 78 120Z" fill="#f5f1e9" />
      <path d="M78 87Q180 65 290 88V110Q186 89 78 111Z" fill="#ac302e" />
      <path d="M78 130Q188 109 290 130V170Q186 145 78 176Z" fill="#f5f1e9" />
      <path d="M78 139Q182 118 290 140V161Q189 140 78 167Z" fill="#177047" />
      <ellipse cx="185" cy="102" rx="20" ry="49" fill="#f4e9d1" stroke="#332a22" strokeWidth="2"/>
      <ellipse cx="185" cy="102" rx="13" ry="37" fill="#a83533"/>
      <path d="m158 62 54 81M212 62l-54 81" stroke="#f5ede0" strokeWidth="3"/>
    </svg>
  </div>
  if (kind === 'agriculture') return <div className={styles.art + ' ' + styles.agriArt} role="img" aria-label="Illustrated maize plant with yellowing leaves">
    <svg viewBox="0 0 420 260" aria-hidden="true">
      <circle cx="326" cy="45" r="72" fill="#fff4c4" opacity=".45"/>
      <path d="M210 260Q218 149 206 27" stroke="#286f44" strokeWidth="11" fill="none" strokeLinecap="round"/>
      <path d="M211 162Q121 77 46 132Q90 199 211 183Z" fill="#82a952"/>
      <path d="M210 125Q301 32 374 70Q343 147 210 151Z" fill="#dbbb4d"/>
      <path d="M210 216Q132 146 83 210Q142 252 210 233Z" fill="#507e40"/>
      <path d="M206 85Q152 28 102 59Q142 106 207 103Z" fill="#c5b14a"/>
      <path d="M210 162Q141 141 77 143M211 128Q280 108 339 88" stroke="#f9e6ab" strokeWidth="3" fill="none" opacity=".75"/>
      <path d="M0 251Q210 225 420 248V260H0Z" fill="#795e43" opacity=".5"/>
    </svg>
  </div>
  if (kind === 'physics') return <div className={styles.art + ' ' + styles.physicsArt} role="img" aria-label="Illustrated battery, bulb and circuit">
    <svg viewBox="0 0 420 260" aria-hidden="true">
      <path d="M88 140V53H296V102M296 159V208H88V159" fill="none" stroke="#c1d3e2" strokeWidth="6" strokeLinecap="round"/>
      <rect x="68" y="127" width="42" height="46" rx="5" fill="#b4cad8" stroke="#dae5ee" strokeWidth="3"/>
      <path d="M88 136v27M76 150h24" stroke="#3d5875" strokeWidth="3"/>
      <circle cx="196" cy="53" r="31" fill="#ffda81" stroke="#ffebba" strokeWidth="5"/>
      <path d="m185 42 22 22m0-22-22 22" stroke="#745624" strokeWidth="3"/>
      <path d="M296 102l26 26" fill="none" stroke="#ffdc83" strokeWidth="7" strokeLinecap="round"/>
    </svg>
  </div>
  return <div className={styles.art + ' ' + styles.literatureArt} role="img" aria-label="Illustrated open book">
    <svg viewBox="0 0 420 260" aria-hidden="true">
      <path d="M47 81Q130 49 210 94Q294 49 373 81V213Q294 184 210 231Q128 184 47 213Z" fill="#f0dfbd" stroke="#715b47" strokeWidth="7" strokeLinejoin="round"/>
      <path d="M210 94V231M77 105Q133 85 179 116M77 127Q134 107 179 138M77 149Q137 129 179 160M238 116Q282 85 341 105M238 138Q288 106 341 127M238 160Q293 127 341 149" stroke="#9d8466" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M50 213Q133 202 210 242Q292 201 370 213" fill="none" stroke="#cbb694" strokeWidth="6"/>
    </svg>
  </div>
}
