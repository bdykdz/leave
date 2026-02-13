"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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
  placeholder = "Select user...",
  noneLabel = "None",
  excludeId,
}: UserSearchSelectProps) {
  const [open, setOpen] = useState(false)

  const filteredUsers = excludeId ? users.filter(u => u.id !== excludeId) : users

  const selectedUser = filteredUsers.find(u => u.id === value)
  const displayText = value === "none" || !value
    ? noneLabel
    : selectedUser
      ? `${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.role})`
      : noneLabel

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => {
                  onValueChange("none")
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "none" || !value ? "opacity-100" : "opacity-0"
                  )}
                />
                {noneLabel}
              </CommandItem>
              {filteredUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.firstName} ${user.lastName} ${user.role}`}
                  onSelect={() => {
                    onValueChange(user.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === user.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {user.firstName} {user.lastName}
                  <span className="ml-auto text-xs text-muted-foreground">{user.role}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
