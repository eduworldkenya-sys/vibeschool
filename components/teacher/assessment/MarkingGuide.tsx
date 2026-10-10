import type { Json } from '@/lib/database.types'
/** Render canonical answer/rubric content without exposing serialization to teachers. */
export function MarkingGuide({ value }: { value: Json }) {
  if (value === null || value === undefined) return <p>No marking guidance is recorded.</p>
  if (typeof value === 'string' || typeof value === 'number') return <p>{String(value)}</p>
  if (typeof value === 'boolean') return <p>{value ? 'Yes' : 'No'}</p>
  if (Array.isArray(value))
    return (
      <ol>
        {value.map((item, index) => (
          <li key={index}>
            <MarkingGuide value={item} />
          </li>
        ))}
      </ol>
    )
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== null)
  if (!entries.length) return <p>No marking guidance is recorded.</p>
  return (
    <dl>
      {entries.map(([key, item]) => (
        <div key={key}>
          <dt>{key.replaceAll('_', ' ')}</dt>
          <dd>
            <MarkingGuide value={item!} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
