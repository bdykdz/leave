"use client"

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RotateCcw, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Revision {
  id: string
  version: number
  title: string
  changeNote?: string | null
  createdAt: string
  author: { id: string; firstName: string; lastName: string }
}

interface WikiRevisionListProps {
  revisions: Revision[]
  canRestore: boolean
  onRestore: (revisionId: string) => Promise<void>
}

export function WikiRevisionList({ revisions, canRestore, onRestore }: WikiRevisionListProps) {
  return (
    <div className="space-y-3">
      {revisions.map((rev, idx) => (
        <div key={rev.id} className="flex items-start gap-3 p-3 border rounded-lg">
          <div className="rounded-full bg-gray-100 p-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">v{rev.version}</span>
              {idx === 0 && <Badge variant="secondary" className="text-xs">Current</Badge>}
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(rev.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-0.5">{rev.title}</p>
            {rev.changeNote && (
              <p className="text-xs text-gray-500 mt-1">{rev.changeNote}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              by {rev.author.firstName} {rev.author.lastName}
            </p>
          </div>
          {canRestore && idx > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onRestore(rev.id)}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Restore
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
