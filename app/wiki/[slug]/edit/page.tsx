"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { WikiBreadcrumb } from '@/components/wiki/wiki-breadcrumb'
import { WikiPageForm } from '@/components/wiki/wiki-page-form'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { useTranslations } from '@/components/language-provider'

export default function WikiEditPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations()
  const [page, setPage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const userRole = (session?.user as any)?.role || 'EMPLOYEE'

  useEffect(() => {
    if (!canEditWiki(userRole)) {
      router.push(`/wiki/${slug}`)
      return
    }
    fetch(`/api/wiki/pages/${slug}`)
      .then((r) => r.json())
      .then((data) => setPage(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug, userRole, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!page) return null

  const enTrans = page.translations?.find((t: any) => t.language === 'en')

  return (
    <div className="space-y-6">
      <WikiBreadcrumb items={[
        ...(page.category ? [{ label: page.category.nameEn, href: `/wiki/categories/${page.category.slug}` }] : []),
        { label: enTrans?.title || slug, href: `/wiki/${slug}` },
        { label: t.wiki?.editPage || 'Edit' },
      ]} />

      <h1 className="text-2xl font-bold">{t.wiki?.editPage || 'Edit Page'}</h1>

      <WikiPageForm
        mode="edit"
        initialData={{
          slug: page.slug,
          categoryId: page.categoryId,
          status: page.status,
          isPinned: page.isPinned,
          visibleToRoles: page.visibleToRoles || [],
          translations: page.translations || [],
          tags: page.tags || [],
        }}
      />
    </div>
  )
}
