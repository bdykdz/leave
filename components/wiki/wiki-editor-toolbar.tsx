"use client"

import { type Editor } from '@tiptap/react'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter, Code,
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, CheckSquare,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, ImageIcon, Table as TableIcon, Code2, Minus,
  Undo, Redo,
  Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
} from 'lucide-react'
import { useCallback, useRef } from 'react'

interface WikiEditorToolbarProps {
  editor: Editor
}

export function WikiEditorToolbar({ editor }: WikiEditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    // Validate URL protocol to prevent javascript: XSS
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        return
      }
    } catch {
      // Allow relative URLs starting with /
      if (!url.startsWith('/')) return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const addImage = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await fetch('/api/wiki/upload-image', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        editor.chain().focus().setImage({ src: data.url }).run()
      }
    } catch { /* ignore */ }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [editor])

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const isInTable = editor.isActive('table')

  return (
    <div className="border-b p-2 flex flex-wrap gap-0.5 items-center bg-gray-50/80">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Undo/Redo */}
      <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Text formatting */}
      <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('strike')} onPressedChange={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('highlight')} onPressedChange={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('code')} onPressedChange={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Headings */}
      <Toggle size="sm" pressed={editor.isActive('heading', { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('heading', { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('heading', { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('heading', { level: 4 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
        <Heading4 className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists */}
      <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive('taskList')} onPressedChange={() => editor.chain().focus().toggleTaskList().run()}>
        <CheckSquare className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Alignment */}
      <Toggle size="sm" pressed={editor.isActive({ textAlign: 'left' })} onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: 'center' })} onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive({ textAlign: 'right' })} onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Insert */}
      <Toggle size="sm" pressed={editor.isActive('link')} onPressedChange={addLink}>
        <LinkIcon className="h-4 w-4" />
      </Toggle>
      <Button variant="ghost" size="sm" onClick={addImage} className="h-8 w-8 p-0">
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={insertTable} className="h-8 w-8 p-0">
        <TableIcon className="h-4 w-4" />
      </Button>
      <Toggle size="sm" pressed={editor.isActive('codeBlock')} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 className="h-4 w-4" />
      </Toggle>
      <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="h-8 w-8 p-0">
        <Minus className="h-4 w-4" />
      </Button>

      {/* Table controls - only shown when in a table */}
      {isInTable && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addColumnAfter().run()} className="h-8 px-2 text-xs" title="Add column">
            <ArrowRight className="h-3 w-3 mr-1" /><Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addRowAfter().run()} className="h-8 px-2 text-xs" title="Add row">
            <ArrowDown className="h-3 w-3 mr-1" /><Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteColumn().run()} className="h-8 px-2 text-xs text-red-600" title="Delete column">
            <ArrowLeft className="h-3 w-3 mr-1" /><Trash2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteRow().run()} className="h-8 px-2 text-xs text-red-600" title="Delete row">
            <ArrowUp className="h-3 w-3 mr-1" /><Trash2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteTable().run()} className="h-8 px-2 text-xs text-red-600" title="Delete table">
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  )
}
