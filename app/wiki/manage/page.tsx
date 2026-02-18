"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { WikiBreadcrumb } from '@/components/wiki/wiki-breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, FileText, FolderOpen, Tag, Eye, Clock } from 'lucide-react'
import { canEditWiki } from '@/lib/utils/wiki-permissions'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useTranslations } from '@/components/language-provider'

export default function WikiManagePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations()
  const [pages, setPages] = useState<any>({ pages: [], total: 0 })
  const [categories, setCategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pageFilter, setPageFilter] = useState('all')

  const userRole = (session?.user as any)?.role || 'EMPLOYEE'

  useEffect(() => {
    if (!canEditWiki(userRole)) {
      router.push('/wiki')
      return
    }
    refreshData()
  }, [userRole, router])

  const refreshData = () => {
    setLoading(true)
    const statusParam = pageFilter === 'all' ? '' : `&status=${pageFilter.toUpperCase()}`
    Promise.all([
      fetch(`/api/wiki/pages?limit=100${statusParam}`).then((r) => r.json()),
      fetch('/api/wiki/categories').then((r) => r.json()),
      fetch('/api/wiki/tags').then((r) => r.json()),
    ])
      .then(([pagesData, catsData, tagsData]) => {
        setPages(pagesData)
        setCategories(Array.isArray(catsData) ? catsData : [])
        setTags(Array.isArray(tagsData) ? tagsData : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (canEditWiki(userRole)) refreshData()
  }, [pageFilter])

  // Category form state
  const [catName, setCatName] = useState('')
  const [catNameEn, setCatNameEn] = useState('')
  const [catNameRo, setCatNameRo] = useState('')
  const [catSlug, setCatSlug] = useState('')
  const [catIcon, setCatIcon] = useState('')

  const handleCreateCategory = async () => {
    if (!catNameEn.trim()) return
    await fetch('/api/wiki/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: catNameEn,
        nameEn: catNameEn,
        nameRo: catNameRo || catNameEn,
        slug: catSlug || catNameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        icon: catIcon || undefined,
      }),
    })
    setCatName(''); setCatNameEn(''); setCatNameRo(''); setCatSlug(''); setCatIcon('')
    refreshData()
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? This will only work if there are no pages in it.')) return
    const res = await fetch(`/api/wiki/categories/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || 'Failed to delete')
    }
    refreshData()
  }

  // Tag form state
  const [tagName, setTagName] = useState('')
  const [tagNameEn, setTagNameEn] = useState('')
  const [tagNameRo, setTagNameRo] = useState('')

  const handleCreateTag = async () => {
    if (!tagNameEn.trim()) return
    await fetch('/api/wiki/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tagNameEn, nameEn: tagNameEn, nameRo: tagNameRo || tagNameEn }),
    })
    setTagName(''); setTagNameEn(''); setTagNameRo('')
    refreshData()
  }

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Delete this tag?')) return
    await fetch(`/api/wiki/tags/${id}`, { method: 'DELETE' })
    refreshData()
  }

  const handleDeletePage = async (slug: string) => {
    if (!confirm('Archive this page?')) return
    await fetch(`/api/wiki/pages/${slug}`, { method: 'DELETE' })
    refreshData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <WikiBreadcrumb items={[{ label: t.wiki?.manage || 'Manage' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.wiki?.manageWiki || 'Manage Wiki'}</h1>
        <Link href="/wiki/new">
          <Button><Plus className="h-4 w-4 mr-2" /> {t.wiki?.newPage || 'New Page'}</Button>
        </Link>
      </div>

      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">
            <FileText className="h-4 w-4 mr-1" /> Pages ({pages.total || 0})
          </TabsTrigger>
          <TabsTrigger value="categories">
            <FolderOpen className="h-4 w-4 mr-1" /> Categories ({categories.length})
          </TabsTrigger>
          <TabsTrigger value="tags">
            <Tag className="h-4 w-4 mr-1" /> Tags ({tags.length})
          </TabsTrigger>
        </TabsList>

        {/* Pages Tab */}
        <TabsContent value="pages" className="space-y-4">
          <div className="flex gap-2">
            {['all', 'published', 'draft', 'archived'].map((filter) => (
              <Button
                key={filter}
                variant={pageFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPageFilter(filter)}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            {(pages.pages || []).map((page: any) => {
              const trans = page.translations?.[0]
              return (
                <div key={page.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{trans?.title || page.slug}</span>
                      <Badge variant={page.status === 'PUBLISHED' ? 'default' : page.status === 'DRAFT' ? 'secondary' : 'outline'} className="text-xs">
                        {page.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>/{page.slug}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{page.viewCount}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}</span>
                      <span>{page.author.firstName} {page.author.lastName}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/wiki/${page.slug}/edit`}>
                      <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeletePage(page.slug)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {(!pages.pages || pages.pages.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-6">No pages found.</p>
            )}
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t.wiki?.createCategory || 'Create Category'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name (EN)</Label>
                  <Input value={catNameEn} onChange={(e) => setCatNameEn(e.target.value)} placeholder="English name" />
                </div>
                <div>
                  <Label className="text-xs">Name (RO)</Label>
                  <Input value={catNameRo} onChange={(e) => setCatNameRo(e.target.value)} placeholder="Romanian name" />
                </div>
                <div>
                  <Label className="text-xs">Slug</Label>
                  <Input value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder="category-slug" />
                </div>
                <div>
                  <Label className="text-xs">Icon (lucide name)</Label>
                  <Input value={catIcon} onChange={(e) => setCatIcon(e.target.value)} placeholder="e.g. book-open" />
                </div>
              </div>
              <Button size="sm" onClick={handleCreateCategory} disabled={!catNameEn.trim()}>
                <Plus className="h-3 w-3 mr-1" /> Create
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {categories.map((cat: any) => (
              <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                <div>
                  <span className="font-medium text-sm">{cat.nameEn}</span>
                  <span className="text-xs text-gray-500 ml-2">/{cat.slug}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">{cat._count?.pages || 0} pages</Badge>
                </div>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteCategory(cat.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t.wiki?.createTag || 'Create Tag'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name (EN)</Label>
                  <Input value={tagNameEn} onChange={(e) => setTagNameEn(e.target.value)} placeholder="English name" />
                </div>
                <div>
                  <Label className="text-xs">Name (RO)</Label>
                  <Input value={tagNameRo} onChange={(e) => setTagNameRo(e.target.value)} placeholder="Romanian name" />
                </div>
              </div>
              <Button size="sm" onClick={handleCreateTag} disabled={!tagNameEn.trim()}>
                <Plus className="h-3 w-3 mr-1" /> Create
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag: any) => (
              <Badge key={tag.id} variant="secondary" className="gap-1 py-1.5 px-3">
                {tag.nameEn}
                <span className="text-xs text-gray-400 ml-1">({tag._count?.pages || 0})</span>
                <button onClick={() => handleDeleteTag(tag.id)} className="ml-1 text-red-500 hover:text-red-700">
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {tags.length === 0 && (
              <p className="text-sm text-gray-500">No tags created yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
