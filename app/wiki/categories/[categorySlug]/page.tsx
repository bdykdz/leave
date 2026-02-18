"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { WikiBreadcrumb } from '@/components/wiki/wiki-breadcrumb'
import { WikiPageCard } from '@/components/wiki/wiki-page-card'
import { WikiSearchBar } from '@/components/wiki/wiki-search-bar'
import { useTranslations } from '@/components/language-provider'

export default function WikiCategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>()
  const t = useTranslations()
  const [pages, setPages] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const category = categories.find((c: any) => c.slug === categorySlug)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/wiki/categories', { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch((err) => { if (err.name !== 'AbortError') { /* ignore */ } })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!category) return
    const controller = new AbortController()
    fetch(`/api/wiki/pages?categoryId=${category.id}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setPages(data.pages || []))
      .catch((err) => { if (err.name !== 'AbortError') { /* ignore */ } })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [category])

  const categoryName = category?.nameEn || categorySlug

  return (
    <div className="space-y-6">
      <WikiBreadcrumb items={[
        { label: t.wiki?.categories || 'Categories', href: '/wiki/categories' },
        { label: categoryName },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{categoryName}</h1>
          {category?.description && (
            <p className="text-sm text-gray-500 mt-1">{category.description}</p>
          )}
        </div>
        <div className="w-64">
          <WikiSearchBar />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : pages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page: any) => {
            const trans = page.translations?.[0]
            return (
              <WikiPageCard
                key={page.id}
                slug={page.slug}
                title={trans?.title || page.slug}
                excerpt={trans?.excerpt}
                categoryName={categoryName}
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
      ) : (
        <p className="text-sm text-gray-500 text-center py-10">{t.wiki?.noPagesInCategory || 'No pages in this category.'}</p>
      )}
    </div>
  )
}
