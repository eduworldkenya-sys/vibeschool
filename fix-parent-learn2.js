const fs = require('fs')

let lines = fs.readFileSync('app/parent/learn/page.tsx', 'utf8').split('\n')

// Find the planIds line and replace the whole lesson_content block
const startMarker = lines.findIndex(l => l.includes('const planIds = (plansRes.data'))
const endMarker   = lines.findIndex(l => l.includes('contentMap.set(c.lesson_plan_id, c.student_copy)'))
const closingBrace = lines.findIndex((l, i) => i > endMarker && l.trim() === '}')

if (startMarker === -1 || endMarker === -1) {
  console.error('Could not find lesson_content block — lines:', startMarker, endMarker)
  process.exit(1)
}

const replacement = [
  `        // Read parent summary directly from lesson_plans.body`,
  `        const contentMap = new Map<string, string>()`,
  `        ;(plansRes.data ?? []).forEach((p: any) => {`,
  `          if (p.body) {`,
  `            const obj = p.body.match(/<objectives>([\\s\\S]*?)<\\/objectives>/)`,
  `            const dev = p.body.match(/<development>([\\s\\S]*?)<\\/development>/)`,
  `            const summary = [`,
  `              obj ? 'What we learned:\\n' + obj[1].trim() : '',`,
  `              dev ? '\\nClassroom activity:\\n' + dev[1].trim().slice(0, 300) + '...' : '',`,
  `            ].filter(Boolean).join('\\n')`,
  `            contentMap.set(p.id, summary)`,
  `          }`,
  `        })`,
]

lines.splice(startMarker, closingBrace - startMarker + 1, ...replacement)

// Fix finalLessons — remove .filter(p => contentMap.has(p.id))
const filterLine = lines.findIndex(l => l.includes('.filter(p => contentMap.has(p.id))'))
if (filterLine !== -1) {
  lines.splice(filterLine, 1)
  console.log('Removed contentMap.has filter at line', filterLine)
}

fs.writeFileSync('app/parent/learn/page.tsx', lines.join('\n'))
console.log('fix-parent-learn2: lesson_content block replaced')
