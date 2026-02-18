"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { WikiBreadcrumb } from '@/components/wiki/wiki-breadcrumb'
import { WikiRevisionList } from '@/components/wiki/wiki-revision-list'
import { WikiLanguageTabs } from '@/components/wiki/wiki-language-tabs'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { useTranslations } from '@/components/language-provider'

export default function WikiRevisionsPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations()
  const [revisions, setRevisions] = useState<any[]>([])
  const [language, setLanguage] = useState('en')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<any>(null)

  const userRole = (session?.user as any)?.role || 'EMPLOYEE'
  const isEditor = canEditWiki(userRole)

  useEffect(() => {
    fetch(`/api/wiki/pages/${slug}`)
      .then((r) => r.json())
      .then((data) => setPage(data))
      .catch(() => {})
  }, [slug])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/wiki/pages/${slug}/revisions?language=${language}`)
      .then((r) => r.json())
      .then((data) => setRevisions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug, language])

  const handleRestore = async (revisionId: string) => {
    if (!confirm(t.wiki?.confirmRestore || 'Restore this version? A new revision will be created.')) return
    const res = await fetch(`/api/wiki/pages/${slug}/revisions/${revisionId}/restore`, { method: 'POST' })
    if (res.ok) {
      router.push(`/wiki/${slug}`)
      router.refresh()
    }
  }

  const enTrans = page?.translations?.find((t: any) => t.language === 'en')

  return (
    <div className="space-y-6">
      <WikiBreadcrumb items={[
        ...(page?.category ? [{ label: page.category.nameEn, href: `/wiki/categories/${page.category.slug}` }] : []),
        { label: enTrans?.title || slug, href: `/wiki/${slug}` },
        { label: t.wiki?.revisions || 'Revisions' },
      ]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.wiki?.revisionHistory || 'Revision History'}</h1>
        <WikiLanguageTabs value={language} onChange={setLanguage} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : revisions.length > 0 ? (
        <WikiRevisionList
          revisions={revisions}
          canRestore={isEditor}
          onRestore={handleRestore}
        />
      ) : (
        <p className="text-sm text-gray-500 text-center py-10">{t.wiki?.noRevisions || 'No revisions found.'}</p>
      )}
    </div>
  )
}
