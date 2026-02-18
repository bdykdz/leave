"use client"

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import { WikiBreadcrumb } from '@/components/wiki/wiki-breadcrumb'
import { WikiPageViewer } from '@/components/wiki/wiki-page-viewer'
import { WikiTableOfContents } from '@/components/wiki/wiki-table-of-contents'
import { WikiComments } from '@/components/wiki/wiki-comments'
import { WikiAttachments } from '@/components/wiki/wiki-attachments'
import { WikiLanguageTabs } from '@/components/wiki/wiki-language-tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Pencil, Clock, Eye, History, Pin } from 'lucide-react'
import Link from 'next/link'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from '@/components/language-provider'

export default function WikiPageView() {
  const { slug } = useParams<{ slug: string }>()
  const { data: session } = useSession()
  const t = useTranslations()
  const [page, setPage] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState('en')

  const userRole = (session?.user as any)?.role || 'EMPLOYEE'
  const userId = (session?.user as any)?.id || ''
  const isEditor = canEditWiki(userRole)

  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/api/wiki/pages/${slug}`, { signal: controller.signal }).then((r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Forbidden' : 'Failed to load page')
        return r.json()
      }),
      fetch(`/api/wiki/pages/${slug}/comments`, { signal: controller.signal }).then((r) => r.json()).catch(() => []),
    ])
      .then(([pageData, commentsData]) => {
        setPage(pageData)
        setComments(Array.isArray(commentsData) ? commentsData : [])
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load page')
        }
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [slug])

  const refreshComments = useCallback(() => {
    fetch(`/api/wiki/pages/${slug}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [slug])

  const refreshAttachments = useCallback(() => {
    fetch(`/api/wiki/pages/${slug}`)
      .then((r) => r.json())
      .then((data) => setPage(data))
      .catch(() => {})
  }, [slug])

  const handleAddComment = async (content: string, parentId?: string) => {
    try {
      const res = await fetch(`/api/wiki/pages/${slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId }),
      })
      if (!res.ok) throw new Error('Failed to add comment')
      refreshComments()
    } catch {
      alert('Failed to add comment. Please try again.')
    }
  }

  const handleEditComment = async (commentId: string, content: string) => {
    try {
      const res = await fetch(`/api/wiki/pages/${slug}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('Failed to edit comment')
      refreshComments()
    } catch {
      alert('Failed to edit comment. Please try again.')
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/wiki/pages/${slug}/comments/${commentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete comment')
      refreshComments()
    } catch {
      alert('Failed to delete comment. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error || (!page && !loading) || page?.error) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold">{error || t.wiki?.pageNotFound || 'Page not found'}</h2>
        <Link href="/wiki">
          <Button className="mt-4" variant="outline">{t.wiki?.backToWiki || 'Back to Wiki'}</Button>
        </Link>
      </div>
    )
  }

  const translation = page.translations?.find((t: any) => t.language === language) || page.translations?.[0]
  const breadcrumbItems = []
  if (page.category) {
    breadcrumbItems.push({ label: page.category.nameEn, href: `/wiki/categories/${page.category.slug}` })
  }
  breadcrumbItems.push({ label: translation?.title || slug })

  return (
    <div className="space-y-6">
      <WikiBreadcrumb items={breadcrumbItems} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {page.isPinned && <Pin className="h-4 w-4 text-blue-500" />}
                  <h1 className="text-2xl font-bold">{translation?.title}</h1>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {page.viewCount} views
                  </span>
                  <span>by {page.author.firstName} {page.author.lastName}</span>
                </div>
                {page.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {page.tags.map((t: any) => (
                      <Badge key={t.tag.name} variant="outline" className="text-xs">{t.tag.name}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <WikiLanguageTabs value={language} onChange={setLanguage} />
                {isEditor && (
                  <Link href={`/wiki/${slug}/edit`}>
                    <Button size="sm">
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {t.common?.edit || 'Edit'}
                    </Button>
                  </Link>
                )}
                <Link href={`/wiki/${slug}/revisions`}>
                  <Button variant="outline" size="sm">
                    <History className="h-3.5 w-3.5 mr-1" />
                    {t.wiki?.revisions || 'History'}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Content */}
            <WikiPageViewer content={translation?.content} />
          </div>

          {/* Attachments */}
          {(page.attachments?.length > 0 || isEditor) && (
            <div className="bg-white border rounded-lg p-6">
              <WikiAttachments
                slug={slug}
                attachments={page.attachments || []}
                canEdit={isEditor}
                onRefresh={refreshAttachments}
              />
            </div>
          )}

          {/* Comments */}
          <div className="bg-white border rounded-lg p-6">
            <WikiComments
              comments={comments}
              currentUserId={userId}
              currentUserRole={userRole}
              onAddComment={handleAddComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
            />
          </div>
        </div>

        {/* Sidebar - Table of Contents */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <WikiTableOfContents content={translation?.content} />
          </div>
        </div>
      </div>
    </div>
  )
}
