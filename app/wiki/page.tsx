"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { WikiBreadcrumb } from '@/components/wiki/wiki-breadcrumb'
import { WikiSearchBar } from '@/components/wiki/wiki-search-bar'
import { WikiPageCard } from '@/components/wiki/wiki-page-card'
import { WikiCategoryBrowser } from '@/components/wiki/wiki-category-browser'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { useTranslations } from '@/components/language-provider'

export default function WikiHomePage() {
  const { data: session } = useSession()
  const t = useTranslations()
  const [pinnedPages, setPinnedPages] = useState<any[]>([])
  const [recentPages, setRecentPages] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const userRole = (session?.user as any)?.role || 'EMPLOYEE'
  const isEditor = canEditWiki(userRole)
  const language = 'en'

  useEffect(() => {
    Promise.all([
      fetch('/api/wiki/pages?isPinned=true&limit=5').then((r) => r.json()),
      fetch('/api/wiki/pages?limit=10').then((r) => r.json()),
      fetch('/api/wiki/categories').then((r) => r.json()),
    ])
      .then(([pinned, recent, cats]) => {
        setPinnedPages(pinned.pages || [])
        setRecentPages(recent.pages || [])
        setCategories(Array.isArray(cats) ? cats : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">{t.wiki?.title || 'Wiki'}</h1>
            <p className="text-sm text-gray-500">{t.wiki?.description || 'Company knowledge base and policies'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-64">
            <WikiSearchBar placeholder={t.wiki?.searchPlaceholder || 'Search wiki...'} />
          </div>
          {isEditor && (
            <Link href="/wiki/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t.wiki?.newPage || 'New Page'}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <WikiBreadcrumb items={[]} />

      {/* Pinned pages */}
      {pinnedPages.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">{t.wiki?.pinnedPages || 'Pinned Pages'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedPages.map((page: any) => {
              const trans = page.translations?.[0]
              return (
                <WikiPageCard
                  key={page.id}
                  slug={page.slug}
                  title={trans?.title || page.slug}
                  excerpt={trans?.excerpt}
                  categoryName={page.category?.nameEn}
                  authorName={`${page.author.firstName} ${page.author.lastName}`}
                  updatedAt={page.updatedAt}
                  viewCount={page.viewCount}
                  commentCount={page._count?.comments || 0}
                  isPinned={page.isPinned}
                  tags={page.tags}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">{t.wiki?.categories || 'Categories'}</h2>
          <WikiCategoryBrowser categories={categories} language={language} />
        </section>
      )}

      {/* Recent pages */}
      {recentPages.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">{t.wiki?.recentlyUpdated || 'Recently Updated'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentPages.map((page: any) => {
              const trans = page.translations?.[0]
              return (
                <WikiPageCard
                  key={page.id}
                  slug={page.slug}
                  title={trans?.title || page.slug}
                  excerpt={trans?.excerpt}
                  categoryName={page.category?.nameEn}
                  authorName={`${page.author.firstName} ${page.author.lastName}`}
                  updatedAt={page.updatedAt}
                  viewCount={page.viewCount}
                  commentCount={page._count?.comments || 0}
                  isPinned={page.isPinned}
                  tags={page.tags}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {pinnedPages.length === 0 && recentPages.length === 0 && (
        <div className="text-center py-20 border rounded-lg bg-white">
          <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">{t.wiki?.noPages || 'No wiki pages yet'}</h3>
          <p className="text-sm text-gray-500 mt-1">{t.wiki?.noPagesDescription || 'HR or Admin can create the first page.'}</p>
          {isEditor && (
            <Link href="/wiki/new">
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" /> {t.wiki?.createFirstPage || 'Create First Page'}
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Manage link for editors */}
      {isEditor && (
        <div className="text-center">
          <Link href="/wiki/manage">
            <Button variant="outline">{t.wiki?.manageWiki || 'Manage Wiki'}</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
