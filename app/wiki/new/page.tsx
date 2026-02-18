"use client"

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { WikiBreadcrumb } from '@/components/wiki/wiki-breadcrumb'
import { WikiPageForm } from '@/components/wiki/wiki-page-form'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { useTranslations } from '@/components/language-provider'

export default function WikiNewPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations()

  const userRole = (session?.user as any)?.role || 'EMPLOYEE'

  useEffect(() => {
    if (!canEditWiki(userRole)) {
      router.push('/wiki')
    }
  }, [userRole, router])

  if (!canEditWiki(userRole)) return null

  return (
    <div className="space-y-6">
      <WikiBreadcrumb items={[{ label: t.wiki?.newPage || 'New Page' }]} />
      <h1 className="text-2xl font-bold">{t.wiki?.createPage || 'Create New Page'}</h1>
      <WikiPageForm mode="create" />
    </div>
  )
}
