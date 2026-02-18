"use client"

import Link from 'next/link'
import { ChevronRight, BookOpen } from 'lucide-react'

interface WikiBreadcrumbProps {
  items: { label: string; href?: string }[]
}

export function WikiBreadcrumb({ items }: WikiBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500">
      <Link href="/wiki" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
        <BookOpen className="h-4 w-4" />
        <span>Wiki</span>
      </Link>
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />
          {item.href ? (
            <Link href={item.href} className="hover:text-blue-600 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
