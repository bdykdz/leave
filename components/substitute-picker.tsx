"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, X, Users, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

interface TeamMember {
  id: string
  name: string
  email: string
  avatar: string
  department: string
  role: string
}

interface SubstitutePickerProps {
  selectedSubstitute: string
  onSubstituteChange: (substitute: string) => void
}

export function SubstitutePicker({ selectedSubstitute, onSubstituteChange }: SubstitutePickerProps) {
  const [open, setOpen] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubstitutes()
  }, [])

  const fetchSubstitutes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users/substitutes')
      if (response.ok) {
        const data = await response.json()
        setTeamMembers(data.substitutes)
      } else {
        toast.error('Failed to load team members')
      }
    } catch (error) {
      console.error('Error fetching substitutes:', error)
      toast.error('Failed to load team members')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (memberId: string) => {
    if (selectedSubstitute === memberId) {
      // Deselect if already selected
      onSubstituteChange("")
    } else {
      // Select the new member
      onSubstituteChange(memberId)
    }
    setOpen(false) // Close dropdown after selection
  }

  const handleRemove = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    onSubstituteChange("")
  }

  const getSelectedMember = () => {
    return teamMembers.find((member) => member.id === selectedSubstitute)
  }

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4" />
        Coverage Assignment *
      </Label>

      <div className="space-y-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between text-left font-normal h-auto min-h-[44px] py-2 px-3"
              disabled={loading}
            >
              <div className="flex flex-col items-start w-full overflow-hidden">
                {loading ? (
                  <span className="text-gray-500 text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading team members...
                  </span>
                ) : !selectedSubstitute ? (
                  <span className="text-gray-500 text-sm truncate w-full">
                    Select a team member to cover your responsibilities...
                  </span>
                ) : (
                  <div className="w-full">
                    <span className="text-sm font-medium">
                      1 team member selected
                    </span>
                    <div className="text-xs text-gray-500 truncate w-full mt-0.5">
                      {getSelectedMember()?.name || ""}
                    </div>
                  </div>
                )}
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="start">
            <div className="flex flex-col max-h-[400px]">
              <div className="p-3 border-b">
                <input
                  type="text"
                  placeholder="Search team members..."
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    const searchTerm = e.target.value.toLowerCase()
                    const filtered = teamMembers.filter(
                      (member) =>
                        member.name.toLowerCase().includes(searchTerm) ||
                        member.role.toLowerCase().includes(searchTerm)
                    )
                    setFilteredMembers(filtered.length > 0 ? filtered : teamMembers)
                  }}
                />
              </div>
              <div className="overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading team members...
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No team members available in your department
                  </div>
                ) : (
                  <div className="p-1">
                    {(filteredMembers.length > 0 ? filteredMembers : teamMembers).map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelect(member.id)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          {member.avatar.startsWith('http') || member.avatar.startsWith('/') ? (
                            <AvatarImage src={member.avatar} />
                          ) : null}
                          <AvatarFallback className="text-xs">{member.avatar}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="font-medium text-sm truncate">{member.name}</div>
                          <div className="text-xs text-gray-500 truncate">{member.role}</div>
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4 text-blue-600 shrink-0",
                            selectedSubstitute === member.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-2 border-t bg-gray-50">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="w-full">
                  Done Selecting
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Selected Substitute */}
        {selectedSubstitute && getSelectedMember() && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Selected for Coverage:</div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className="flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 max-w-full"
              >
                <Avatar className="h-4 w-4 shrink-0">
                  {getSelectedMember()!.avatar.startsWith('http') || getSelectedMember()!.avatar.startsWith('/') ? (
                    <AvatarImage src={getSelectedMember()!.avatar} />
                  ) : null}
                  <AvatarFallback className="text-[10px]">{getSelectedMember()!.avatar}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium truncate">{getSelectedMember()!.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemove(e)}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 leading-relaxed">
        Select a team member who will cover your responsibilities while you're away. This ensures continuity and helps
        your manager coordinate coverage.
      </div>
    </div>
  )
}
