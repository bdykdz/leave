"use client"

import { useState, useRef, useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface UserOption {
  id: string
  firstName: string
  lastName: string
  role: string
}

interface UserSearchSelectProps {
  users: UserOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  noneLabel?: string
  excludeId?: string
}

export function UserSearchSelect({
  users,
  value,
  onValueChange,
  placeholder = "Search users...",
  noneLabel = "None",
  excludeId,
}: UserSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredUsers = (excludeId ? users.filter(u => u.id !== excludeId) : users)
    .filter(u => {
      if (!search) return true
      const term = search.toLowerCase()
      return (
        u.firstName.toLowerCase().includes(term) ||
        u.lastName.toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term)
      )
    })

  const selectedUser = users.find(u => u.id === value)
  const displayText = value === "none" || !value
    ? noneLabel
    : selectedUser
      ? `${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.role})`
      : noneLabel

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const handleSelect = (id: string) => {
    onValueChange(id)
    setOpen(false)
    setSearch("")
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="w-full justify-between font-normal"
      >
        <span className="truncate">{displayText}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-2 border-b">
            <Input
              ref={inputRef}
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => handleSelect("none")}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                (value === "none" || !value) && "bg-accent"
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value === "none" || !value ? "opacity-100" : "opacity-0"
                )}
              />
              {noneLabel}
            </button>
            {filteredUsers.map((user) => (
              <button
                type="button"
                key={user.id}
                onClick={() => handleSelect(user.id)}
                className={cn(
                  "flex w-full items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                  value === user.id && "bg-accent"
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === user.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <span>{user.firstName} {user.lastName}</span>
                <span className="ml-auto text-xs text-muted-foreground">{user.role}</span>
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No user found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
