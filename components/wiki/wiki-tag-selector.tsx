"use client"

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Plus } from 'lucide-react'

interface Tag {
  id: string
  name: string
  nameEn: string
  nameRo: string
}

interface WikiTagSelectorProps {
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  language?: string
}

export function WikiTagSelector({ selectedTagIds, onChange, language = 'en' }: WikiTagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/wiki/tags')
      .then((r) => r.json())
      .then((data) => setTags(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))
  const availableTags = tags.filter(
    (t) => !selectedTagIds.includes(t.id) && (language === 'ro' ? t.nameRo : t.nameEn).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1">
            {language === 'ro' ? tag.nameRo : tag.nameEn}
            <button onClick={() => onChange(selectedTagIds.filter((id) => id !== tag.id))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags..."
          className="text-sm"
        />
        {search && availableTags.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-auto">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 flex items-center gap-2"
                onClick={() => {
                  onChange([...selectedTagIds, tag.id])
                  setSearch('')
                }}
              >
                <Plus className="h-3 w-3" />
                {language === 'ro' ? tag.nameRo : tag.nameEn}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
