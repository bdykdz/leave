"use client"

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface WikiSearchBarProps {
  defaultValue?: string
  placeholder?: string
}

export function WikiSearchBar({ defaultValue = '', placeholder = 'Search wiki...' }: WikiSearchBarProps) {
  const router = useRouter()
  const [value, setValue] = useState(defaultValue)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (value.trim().length >= 2) {
        router.push(`/wiki/search?q=${encodeURIComponent(value.trim())}`)
      }
    },
    [value, router]
  )

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
      />
    </form>
  )
}
