"use client"

import { useEffect, useState } from 'react'
import { WikiBreadcrumb } from '@/components/wiki/wiki-breadcrumb'
import { WikiCategoryBrowser } from '@/components/wiki/wiki-category-browser'
import { WikiSearchBar } from '@/components/wiki/wiki-search-bar'
import { useTranslations } from '@/components/language-provider'

export default function WikiCategoriesPage() {
  const t = useTranslations()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/wiki/categories')
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <WikiBreadcrumb items={[{ label: t.wiki?.categories || 'Categories' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.wiki?.allCategories || 'All Categories'}</h1>
        <div className="w-64">
          <WikiSearchBar />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : (
        <WikiCategoryBrowser categories={categories} language="en" />
      )}
    </div>
  )
}
