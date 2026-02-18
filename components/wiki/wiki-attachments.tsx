"use client"

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, Upload, Trash2, Download, File } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Attachment {
  id: string
  fileName: string
  contentType: string
  fileSize: number
  createdAt: string
  uploader: { firstName: string; lastName: string }
}

interface WikiAttachmentsProps {
  slug: string
  attachments: Attachment[]
  canEdit: boolean
  onRefresh: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function WikiAttachments({ slug, attachments, canEdit, onRefresh }: WikiAttachmentsProps) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/wiki/pages/${slug}/attachments`, { method: 'POST', body: formData })
      if (res.ok) onRefresh()
    } finally {
      setUploading(false)
    }
  }, [slug, onRefresh])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this attachment?')) return
    const res = await fetch(`/api/wiki/pages/${slug}/attachments/${id}`, { method: 'DELETE' })
    if (res.ok) onRefresh()
  }, [slug, onRefresh])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          <h4 className="text-sm font-semibold">Attachments ({attachments.length})</h4>
        </div>
        {canEdit && (
          <label>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            <Button variant="outline" size="sm" asChild className="cursor-pointer">
              <span>
                <Upload className="h-3 w-3 mr-1" />
                {uploading ? 'Uploading...' : 'Upload'}
              </span>
            </Button>
          </label>
        )}
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 p-2 border rounded-lg text-sm">
              <File className="h-4 w-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{att.fileName}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(att.fileSize)} &middot; {att.uploader.firstName} {att.uploader.lastName} &middot; {formatDistanceToNow(new Date(att.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <a href={`/api/wiki/pages/${slug}/attachments/${att.id}`} download>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
                {canEdit && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => handleDelete(att.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No attachments</p>
      )}
    </div>
  )
}
