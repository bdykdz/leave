"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { common, createLowlight } from 'lowlight'
import { WikiEditorToolbar } from './wiki-editor-toolbar'

const lowlight = createLowlight(common)

interface WikiEditorProps {
  content: any
  onChange: (content: any) => void
  placeholder?: string
  editable?: boolean
}

export function WikiEditor({ content, onChange, placeholder = 'Start writing...', editable = true }: WikiEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4] },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        HTMLAttributes: { class: 'wiki-image' },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'wiki-link' },
      }),
      Placeholder.configure({ placeholder }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      TextStyle,
      Color,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0]
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            uploadImage(file).then((url) => {
              if (url) {
                const { schema } = view.state
                const node = schema.nodes.image.create({ src: url })
                const transaction = view.state.tr.replaceSelectionWith(node)
                view.dispatch(transaction)
              }
            })
            return true
          }
        }
        return false
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              event.preventDefault()
              const file = item.getAsFile()
              if (file) {
                uploadImage(file).then((url) => {
                  if (url) {
                    const { schema } = view.state
                    const node = schema.nodes.image.create({ src: url })
                    const transaction = view.state.tr.replaceSelectionWith(node)
                    view.dispatch(transaction)
                  }
                })
              }
              return true
            }
          }
        }
        return false
      },
    },
  })

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {editable && editor && <WikiEditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

async function uploadImage(file: File): Promise<string | null> {
  try {
    const formData = new FormData()
    formData.append('image', file)
    const res = await fetch('/api/wiki/upload-image', { method: 'POST', body: formData })
    if (!res.ok) return null
    const data = await res.json()
    return data.url
  } catch {
    return null
  }
}
