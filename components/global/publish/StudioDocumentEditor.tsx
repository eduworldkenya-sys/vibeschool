'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import { Extension, Node, type JSONContent, type NodeViewProps } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import type { BlockType, ContentBlock } from '@/lib/publishTypes'
import { ContentBlockEditor } from './ContentBlockEditor'
import styles from './StudioDocumentEditor.module.css'

type Props = { blocks: ContentBlock[]; readOnly?: boolean; onChange: (blocks: ContentBlock[]) => void }
const textTypes = new Set<BlockType>(['paragraph', 'heading1', 'heading2', 'heading3', 'bulletList', 'numberedList'])
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const uniqueId = () => crypto.randomUUID()

// Document nodes retain the IDs and curriculum metadata belonging to the old blocks.
const BlockIdentity = Extension.create({
  name: 'studioBlockIdentity',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading', 'bulletList', 'orderedList'], attributes: {
      studioId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-studio-id'),
        renderHTML: (attributes: Record<string, unknown>) => attributes.studioId ? { 'data-studio-id': attributes.studioId } : {},
      },
    } }]
  },
})

type EmbedOptions = { lookup: () => Map<string, ContentBlock>; change: (block: ContentBlock) => void }
function EmbedView({ node, editor, extension }: NodeViewProps) {
  const options = extension.options as EmbedOptions
  const block = options.lookup().get(String(node.attrs.blockId))
  if (!block) return <NodeViewWrapper className={styles.missing}>Content unavailable — reload this lesson.</NodeViewWrapper>
  return <NodeViewWrapper className={styles.embed} contentEditable={false}>
    <ContentBlockEditor block={block} format="vibetextbook" readOnly={!editor.isEditable}
      simpleMode={false} isFocused={false} onFocus={() => undefined}
      onUpdate={options.change} onDelete={() => undefined} onMoveUp={() => undefined} onMoveDown={() => undefined}/>
  </NodeViewWrapper>
}

const StudioEmbed = Node.create<EmbedOptions>({
  name: 'studioEmbed', group: 'block', atom: true, selectable: true, draggable: false,
  addOptions() { return { lookup: () => new Map<string, ContentBlock>(), change: (_block: ContentBlock) => undefined } },
  addAttributes() {
    return { blockId: {
      default: '',
      parseHTML: (element: HTMLElement) => element.getAttribute('data-block-id'),
      renderHTML: (attributes: {blockId: string}) => ({ 'data-block-id': attributes.blockId }),
    } }
  },
  parseHTML() { return [{ tag: 'div[data-studio-embed]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', { ...HTMLAttributes, 'data-studio-embed': 'true' }] },
  addNodeView() { return ReactNodeViewRenderer(EmbedView) },
})

const plainInline = (content: string) => !/<\/?(?:table|img|iframe|video|audio|svg|math|script|style|form|input|div|ul|ol|h[1-6])\b/i.test(content)

function asHtml(block: ContentBlock): string {
  const id = escapeHtml(block.id)
  if (block.type === 'paragraph' && plainInline(block.content)) {
    const text = block.content.trim()
    if (/^<p(?:\s|>)/i.test(text) && /<\/p>\s*$/i.test(text) && (text.match(/<p(?:\s|>)/gi) ?? []).length === 1) {
      return text.replace(/^<p(?:\s[^>]*)?>/i, '<p data-studio-id="' + id + '">')
    }
    return '<p data-studio-id="' + id + '">' + (/<[^>]+>/.test(text) ? text : escapeHtml(block.content)) + '</p>'
  }
  if (block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3') {
    const level = Number(block.type.slice(-1))
    return '<h' + level + ' data-studio-id="' + id + '">' + escapeHtml(block.content) + '</h' + level + '>'
  }
  if (block.type === 'bulletList' || block.type === 'numberedList') {
    const tag = block.type === 'bulletList' ? 'ul' : 'ol'
    return '<' + tag + ' data-studio-id="' + id + '">' +
      (block.content.split('\n').filter(Boolean).map(line => '<li><p>' + escapeHtml(line) + '</p></li>').join('') || '<li><p></p></li>') +
      '</' + tag + '>'
  }
  return '<div data-studio-embed="true" data-block-id="' + id + '"></div>'
}

const toHtml = (blocks: ContentBlock[]) => blocks.map(asHtml).join('') || '<p></p>'
const nodeText = (node: JSONContent): string => node.type === 'text' ? node.text ?? '' : (node.content ?? []).map(nodeText).join('')

// Tiptap has already parsed source HTML through its allowlisted schema.
// Convert the schema-owned output; never execute author HTML.
function toBlocks(editorJson: JSONContent, editorHtml: string, original: ContentBlock[]): ContentBlock[] {
  const originals = new Map(original.map(block => [block.id, block]))
  const used = new Set<string>()
  const result: ContentBlock[] = []
  const markup = Array.from(new DOMParser().parseFromString(editorHtml, 'text/html').body.children)
  for (const [index, node] of (editorJson.content ?? []).entries()) {
    if (node.type === 'studioEmbed') {
      const id = String(node.attrs?.blockId ?? '')
      const old = originals.get(id)
      if (old && !used.has(id)) { result.push(old); used.add(id) }
      continue
    }
    if (!['paragraph', 'heading', 'bulletList', 'orderedList'].includes(node.type ?? '')) continue
    const type: BlockType = node.type === 'heading' ? ('heading' + String(node.attrs?.level ?? 2)) as BlockType
      : node.type === 'bulletList' ? 'bulletList' : node.type === 'orderedList' ? 'numberedList' : 'paragraph'
    const oldId = String(node.attrs?.studioId ?? '')
    const previous = originals.get(oldId)
    const id = previous && !used.has(oldId) ? oldId : uniqueId()
    used.add(id)
    const content = type === 'bulletList' || type === 'numberedList'
      ? (node.content ?? []).map(nodeText).join('\n')
      : type === 'paragraph' ? markup[index]?.outerHTML ?? ('<p>' + escapeHtml(nodeText(node)) + '</p>')
      : nodeText(node)
    result.push({ id, type, content, ...(previous?.meta ? { meta: previous.meta } : {}) })
  }
  // Destructive block deletion is not part of this editor's feature scope.
  // Fail rather than silently discarding media, protected items or unsupported prose.
  for (const old of original) {
    if (used.has(old.id)) continue
    if (!textTypes.has(old.type) || (old.type === 'paragraph' && !plainInline(old.content))) {
      throw new Error('An existing lesson element could not be preserved. Reload before continuing.')
    }
  }
  return result
}

export function StudioDocumentEditor({ blocks, readOnly = false, onChange }: Props) {
  const latest = useRef(blocks)
  const onChangeRef = useRef(onChange)
  const [insertOpen, setInsertOpen] = useState(false)
  const [conversionError, setConversionError] = useState<string | null>(null)
  const synced = useRef('')
  useEffect(() => { latest.current = blocks }, [blocks])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const updateEmbed = useCallback((updated: ContentBlock) => {
    const next = latest.current.map(block => block.id === updated.id ? updated : block)
    latest.current = next
    synced.current = JSON.stringify(next)
    onChangeRef.current(next)
  }, [])
  const lookup = useCallback(() => new Map(latest.current.map(block => [block.id, block])), [])
  const extensions = useMemo(() => [
    StarterKit, Placeholder.configure({ placeholder: 'Start writing your lesson…' }), Typography,
    BlockIdentity, StudioEmbed.configure({ lookup, change: updateEmbed }),
  ], [lookup, updateEmbed])
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: toHtml(blocks),
    editable: !readOnly,
    onUpdate({ editor: active }) {
      try {
        const next = toBlocks(active.getJSON(), active.getHTML(), latest.current)
        latest.current = next
        synced.current = JSON.stringify(next)
        setConversionError(null)
        onChangeRef.current(next)
      } catch (reason) {
        setConversionError(reason instanceof Error ? reason.message : 'This change could not be saved.')
      }
    },
  })
  useEffect(() => { editor?.setEditable(!readOnly) }, [editor, readOnly])
  useEffect(() => {
    if (!editor) return
    const signature = JSON.stringify(blocks)
    if (synced.current === signature) return
    synced.current = signature
    editor.commands.setContent(toHtml(blocks), { emitUpdate: false })
  }, [blocks, editor])

  const insert = (type: BlockType) => {
    if (!editor || readOnly) return
    setInsertOpen(false)
    if (type === 'paragraph') { editor.chain().focus().insertContent({ type: 'paragraph' }).run(); return }
    if (type === 'heading2') { editor.chain().focus().insertContent({ type: 'heading', attrs: { level: 2 } }).run(); return }
    const block: ContentBlock = { id: uniqueId(), type, content: '' }
    latest.current = [...latest.current, block]
    editor.chain().focus().insertContent({ type: 'studioEmbed', attrs: { blockId: block.id } }).run()
  }

  if (!editor) return <div className={styles.loading}>Opening editor…</div>
  const button = (label: string, action: () => void, pressed = false) =>
    <button type="button" className={styles.tool} key={label} disabled={readOnly} title={label}
      aria-label={label} aria-pressed={pressed} onMouseDown={event => event.preventDefault()} onClick={action}>{label}</button>
  return <section className={styles.workspace} aria-label="Textbook document editor">
    {!readOnly && <div role="toolbar" aria-label="Text formatting" className={styles.toolbar}>
      {button('Undo', () => editor.chain().focus().undo().run())}
      {button('Redo', () => editor.chain().focus().redo().run())}
      {button('Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {button('Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {button('Heading', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
      {button('Bullets', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {button('Numbering', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      <div className={styles.insertMenu}>
        <button type="button" className={styles.tool} aria-expanded={insertOpen} onClick={() => setInsertOpen(value => !value)}>Insert</button>
        {insertOpen && <div className={styles.menu} role="group" aria-label="Insert into lesson">
          {(['image', 'table', 'equation', 'diagram', 'activity', 'workedExample', 'question', 'interactive'] as BlockType[])
            .map(type => <button type="button" key={type} onClick={() => insert(type)}>{type === 'workedExample' ? 'Worked example' : type}</button>)}
        </div>}
      </div>
    </div>}
    {conversionError && <p role="alert" className={styles.error}>Change not saved. {conversionError}</p>}
    <div className={styles.paper}><EditorContent editor={editor} className={styles.document}/></div>
  </section>
}
