"use client"

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen, Shield, Heart, Calendar, Users, Settings,
  FileText, HelpCircle, Briefcase, Globe, FolderOpen,
} from 'lucide-react'

const iconMap: Record<string, any> = {
  'book-open': BookOpen,
  shield: Shield,
  heart: Heart,
  calendar: Calendar,
  users: Users,
  settings: Settings,
  'file-text': FileText,
  'help-circle': HelpCircle,
  briefcase: Briefcase,
  globe: Globe,
}

interface WikiCategoryBrowserProps {
  categories: {
    id: string
    slug: string
    nameEn: string
    nameRo: string
    icon?: string | null
    description?: string | null
    _count: { pages: number }
  }[]
  language: string
}

export function WikiCategoryBrowser({ categories, language }: WikiCategoryBrowserProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((cat) => {
        const IconComponent = cat.icon ? (iconMap[cat.icon] || FolderOpen) : FolderOpen
        const name = language === 'ro' ? cat.nameRo : cat.nameEn

        return (
          <Link key={cat.id} href={`/wiki/categories/${cat.slug}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-6 flex items-start gap-4">
                <div className="rounded-lg bg-blue-50 p-2.5">
                  <IconComponent className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-sm">{name}</h3>
                  {cat.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{cat.description}</p>
                  )}
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {cat._count.pages} {cat._count.pages === 1 ? 'page' : 'pages'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
