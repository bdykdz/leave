"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { WikiBreadcrumb } from '@/components/wiki/wiki-breadcrumb'
import { WikiPageCard } from '@/components/wiki/wiki-page-card'
import { WikiSearchBar } from '@/components/wiki/wiki-search-bar'
import { useTranslations } from '@/components/language-provider'

export default function WikiSearchPage() {
  const searchParams = useSearchParams()
  const t = useTranslations()
  const query = searchParams.get('q') || ''
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) return
    setLoading(true)
    fetch(`/api/wiki/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => setResults(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [query])

  return (
    <div className="space-y-6">
      <WikiBreadcrumb items={[{ label: t.wiki?.searchResults || 'Search Results' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.wiki?.searchResults || 'Search Results'}</h1>
        <div className="w-80">
          <WikiSearchBar defaultValue={query} />
        </div>
      </div>

      {query && (
        <p className="text-sm text-gray-500">
          {loading ? (t.wiki?.searching || 'Searching...') : `${results.length} ${t.wiki?.resultsFor || 'results for'} "${query}"`}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((page: any) => {
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
                commentCount={0}
                isPinned={page.isPinned}
                tags={page.tags}
              />
            )
          })}
        </div>
      ) : query ? (
        <p className="text-sm text-gray-500 text-center py-10">{t.wiki?.noSearchResults || 'No results found. Try different keywords.'}</p>
      ) : null}
    </div>
  )
}
