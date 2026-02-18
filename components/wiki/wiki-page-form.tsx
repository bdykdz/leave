"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WikiEditor } from './wiki-editor'
import { WikiTagSelector } from './wiki-tag-selector'
import { WikiVisibilitySelector } from './wiki-visibility-selector'
import { Switch } from '@/components/ui/switch'
import { Save, Send, Loader2 } from 'lucide-react'
import { useTranslations } from '@/components/language-provider'

interface Category {
  id: string
  nameEn: string
  nameRo: string
  slug: string
}

interface WikiPageFormProps {
  mode: 'create' | 'edit'
  initialData?: {
    slug: string
    categoryId?: string | null
    status: string
    isPinned: boolean
    visibleToRoles: string[]
    translations: { language: string; title: string; content: any; excerpt?: string | null }[]
    tags?: { tagId: string }[]
  }
}

export function WikiPageForm({ mode, initialData }: WikiPageFormProps) {
  const router = useRouter()
  const t = useTranslations()
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [activeLang, setActiveLang] = useState('en')

  const [slug, setSlug] = useState(initialData?.slug || '')
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '')
  const [isPinned, setIsPinned] = useState(initialData?.isPinned || false)
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>(initialData?.visibleToRoles || [])
  const [tagIds, setTagIds] = useState<string[]>(initialData?.tags?.map((t) => t.tagId) || [])
  const [changeNote, setChangeNote] = useState('')

  const enTranslation = initialData?.translations?.find((t) => t.language === 'en')
  const roTranslation = initialData?.translations?.find((t) => t.language === 'ro')

  const [titleEn, setTitleEn] = useState(enTranslation?.title || '')
  const [titleRo, setTitleRo] = useState(roTranslation?.title || '')
  const [contentEn, setContentEn] = useState<any>(enTranslation?.content || { type: 'doc', content: [{ type: 'paragraph' }] })
  const [contentRo, setContentRo] = useState<any>(roTranslation?.content || { type: 'doc', content: [{ type: 'paragraph' }] })

  useEffect(() => {
    fetch('/api/wiki/categories')
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 200)
  }

  const handleTitleChange = (title: string, lang: string) => {
    if (lang === 'en') {
      setTitleEn(title)
      if (mode === 'create' && !slug) {
        setSlug(generateSlug(title))
      }
    } else {
      setTitleRo(title)
    }
  }

  const handleSave = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!titleEn.trim()) return
    setSaving(true)

    const translations = [
      { language: 'en', title: titleEn, content: contentEn },
      ...(titleRo.trim() ? [{ language: 'ro', title: titleRo, content: contentRo }] : []),
    ]

    const body: any = {
      slug,
      categoryId: categoryId || undefined,
      status,
      isPinned,
      visibleToRoles,
      translations,
      tagIds,
    }
    if (mode === 'edit') body.changeNote = changeNote

    try {
      const url = mode === 'create' ? '/api/wiki/pages' : `/api/wiki/pages/${initialData?.slug}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/wiki/${data.slug || slug}`)
        router.refresh()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={activeLang} onValueChange={setActiveLang}>
            <TabsList>
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="ro">Romana</TabsTrigger>
            </TabsList>

            <TabsContent value="en" className="space-y-4 mt-4">
              <div>
                <Label>{t.wiki?.title || 'Title'} (EN) *</Label>
                <Input value={titleEn} onChange={(e) => handleTitleChange(e.target.value, 'en')} placeholder="Page title in English" />
              </div>
              <div>
                <Label>{t.wiki?.content || 'Content'} (EN)</Label>
                <WikiEditor content={contentEn} onChange={setContentEn} placeholder="Write content in English..." />
              </div>
            </TabsContent>

            <TabsContent value="ro" className="space-y-4 mt-4">
              <div>
                <Label>{t.wiki?.title || 'Title'} (RO)</Label>
                <Input value={titleRo} onChange={(e) => handleTitleChange(e.target.value, 'ro')} placeholder="Titlul paginii in romana" />
              </div>
              <div>
                <Label>{t.wiki?.content || 'Content'} (RO)</Label>
                <WikiEditor content={contentRo} onChange={setContentRo} placeholder="Scrieti continutul in romana..." />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t.wiki?.pageSettings || 'Page Settings'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Slug</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="page-slug"
                  disabled={mode === 'edit'}
                />
              </div>

              <div>
                <Label>{t.wiki?.category || 'Category'}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>{t.wiki?.pinned || 'Pinned'}</Label>
                <Switch checked={isPinned} onCheckedChange={setIsPinned} />
              </div>

              <div>
                <Label>{t.wiki?.tags || 'Tags'}</Label>
                <WikiTagSelector selectedTagIds={tagIds} onChange={setTagIds} />
              </div>

              <div>
                <Label>{t.wiki?.visibility || 'Visibility'}</Label>
                <WikiVisibilitySelector value={visibleToRoles} onChange={setVisibleToRoles} />
              </div>

              {mode === 'edit' && (
                <div>
                  <Label>{t.wiki?.changeNote || 'Change Note'}</Label>
                  <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="What changed?" />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button onClick={() => handleSave('PUBLISHED')} disabled={saving || !titleEn.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {t.wiki?.publish || 'Publish'}
            </Button>
            <Button variant="outline" onClick={() => handleSave('DRAFT')} disabled={saving || !titleEn.trim()}>
              <Save className="h-4 w-4 mr-2" />
              {t.wiki?.saveDraft || 'Save as Draft'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
