"use client"

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Eye, MessageSquare, Pin } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface WikiPageCardProps {
  slug: string
  title: string
  excerpt?: string | null
  categoryName?: string | null
  authorName: string
  updatedAt: string
  viewCount: number
  commentCount: number
  isPinned: boolean
  tags?: { tag: { name: string } }[]
}

export function WikiPageCard({
  slug,
  title,
  excerpt,
  categoryName,
  authorName,
  updatedAt,
  viewCount,
  commentCount,
  isPinned,
  tags,
}: WikiPageCardProps) {
  return (
    <Link href={`/wiki/${slug}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">
              {isPinned && <Pin className="h-3.5 w-3.5 inline mr-1 text-blue-500" />}
              {title}
            </CardTitle>
          </div>
          {categoryName && (
            <Badge variant="secondary" className="w-fit text-xs">{categoryName}</Badge>
          )}
        </CardHeader>
        <CardContent>
          {excerpt && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{excerpt}</p>
          )}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tags.map((t) => (
                <Badge key={t.tag.name} variant="outline" className="text-xs">{t.tag.name}</Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {viewCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
            <span className="ml-auto text-gray-400">{authorName}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
