"use client"

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface WikiLanguageTabsProps {
  value: string
  onChange: (lang: string) => void
}

export function WikiLanguageTabs({ value, onChange }: WikiLanguageTabsProps) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList>
        <TabsTrigger value="en">English</TabsTrigger>
        <TabsTrigger value="ro">Romana</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
