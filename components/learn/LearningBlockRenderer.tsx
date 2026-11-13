'use client'

import { VisualLearningAsset, VisualRichText } from '@/components/learn/VisualLearningAsset'
import type { LearningBlock } from '@/lib/learn/learningBlockContract'
import styles from './UniversalLearnReader.module.css'

/** Layout only. Access to visuals stays with the existing certified public API. */
export default function LearningBlockRenderer({ blocks }: { blocks: readonly LearningBlock[] }) {
  return <div className={styles.blockStack}>
    {blocks.map((block, index) => {
      const key = `${block.kind}-${index}`
      if (block.kind === 'paragraph') return <VisualRichText key={key} body={block.text} />
      if (block.kind === 'passage') return <blockquote key={key} className={styles.passage}>
        <VisualRichText body={block.text} />
        {block.attribution && <footer>{block.attribution}</footer>}
      </blockquote>
      if (block.kind === 'formula') return <figure key={key} className={styles.formula}>
        <div aria-label="Mathematical expression">{block.expression}</div>
        {block.explanation && <figcaption>{block.explanation}</figcaption>}
      </figure>
      if (block.kind === 'list') {
        const entries = block.items.map((item,i)=><li key={i}><VisualRichText body={item}/></li>)
        return block.ordered ? <ol key={key}>{entries}</ol> : <ul key={key}>{entries}</ul>
      }
      if (block.kind === 'table') return <div className={styles.tableScroller} key={key}>
        <table>
          {block.caption && <caption>{block.caption}</caption>}
          <thead><tr>{block.columns.map((header,i)=><th scope="col" key={i}>{header}</th>)}</tr></thead>
          <tbody>{block.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      if (block.kind === 'activity') return <aside key={key} className={styles.activity}>
        <strong>Try this</strong>
        {block.materials?.length ? <p>Materials: {block.materials.join(', ')}</p> : null}
        <VisualRichText body={block.instructions}/>
      </aside>
      if (block.kind === 'visual') return <VisualLearningAsset key={key}
        id={block.id} resourceVersionId={block.resourceVersionId}/>
      return null
    })}
  </div>
}
