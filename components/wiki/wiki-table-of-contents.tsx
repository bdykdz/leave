"use client"

import { useMemo } from 'react'

interface TocItem {
  id: string
  text: string
  level: number
}

interface WikiTableOfContentsProps {
  content: any
}

function extractHeadings(node: any, headings: TocItem[] = []): TocItem[] {
  if (!node) return headings
  if (node.type === 'heading' && node.attrs?.level && node.content) {
    const text = node.content.map((c: any) => c.text || '').join('')
    if (text.trim()) {
      headings.push({
        id: text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        text: text.trim(),
        level: node.attrs.level,
      })
    }
  }
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      extractHeadings(child, headings)
    }
  }
  return headings
}

export function WikiTableOfContents({ content }: WikiTableOfContentsProps) {
  const headings = useMemo(() => extractHeadings(content), [content])

  if (headings.length < 2) return null

  return (
    <nav className="border rounded-lg p-4 bg-gray-50/50">
      <h4 className="text-sm font-semibold mb-3 text-gray-700">Table of Contents</h4>
      <ul className="space-y-1">
        {headings.map((heading, idx) => (
          <li key={idx} style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}>
            <a
              href={`#${heading.id}`}
              className="text-sm text-gray-600 hover:text-blue-600 transition-colors block py-0.5"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
