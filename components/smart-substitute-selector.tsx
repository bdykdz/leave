"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Search,
  Calendar,
  Home,
  UserCheck,
  Info,
  Clock
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface SubstituteConflict {
  type: 'leave' | 'wfh' | 'substitute'
  dates: string
  details: string
  conflictingDates?: string[]
}

interface SubstituteOption {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  department: string
  role: string
  image?: string
  conflicts: SubstituteConflict[]
  availabilityStatus: 'available' | 'partial' | 'unavailable'
  isRecommended: boolean
}

interface SmartSubstituteSelectorProps {
  startDate?: string
  endDate?: string
  selectedDates?: string[]
  selectedSubstitutes: string[]
  onSubstitutesChange: (substitutes: string[]) => void
  excludeRequestId?: string
  disabled?: boolean
}

export function SmartSubstituteSelector({
  startDate,
  endDate,
  selectedDates,
  selectedSubstitutes,
  onSubstitutesChange,
  excludeRequestId,
  disabled = false
}: SmartSubstituteSelectorProps) {
  const [substitutes, setSubstitutes] = useState<SubstituteOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (startDate && endDate) {
      fetchSubstituteAvailability()
    }
  }, [startDate, endDate, selectedDates, excludeRequestId])

  const fetchSubstituteAvailability = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/substitutes/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          selectedDates,
          excludeRequestId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch substitute availability')
      }

      const data = await response.json()
      setSubstitutes(data.substitutes || [])
    } catch (error) {
      console.error('Error fetching substitute availability:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const toggleSubstitute = (substituteId: string) => {
    if (disabled) return
    
    const updated = selectedSubstitutes.includes(substituteId)
      ? selectedSubstitutes.filter(id => id !== substituteId)
      : [...selectedSubstitutes, substituteId]
    
    onSubstitutesChange(updated)
  }

  const toggleConflictExpansion = (substituteId: string) => {
    const updated = new Set(expandedConflicts)
    if (updated.has(substituteId)) {
      updated.delete(substituteId)
    } else {
      updated.add(substituteId)
    }
    setExpandedConflicts(updated)
  }

  const getAvailabilityIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'unavailable':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getAvailabilityBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Available</Badge>
      case 'partial':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Partial</Badge>
      case 'unavailable':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Unavailable</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getConflictIcon = (type: string) => {
    switch (type) {
      case 'leave':
        return <Calendar className="h-3 w-3 text-red-500" />
      case 'wfh':
        return <Home className="h-3 w-3 text-blue-500" />
      case 'substitute':
        return <UserCheck className="h-3 w-3 text-orange-500" />
      default:
        return <Info className="h-3 w-3 text-gray-500" />
    }
  }

  const filteredSubstitutes = substitutes.filter(substitute => {
    const matchesSearch = substitute.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         substitute.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         substitute.department.toLowerCase().includes(searchTerm.toLowerCase())
    
    const showBasedOnAvailability = showUnavailable || substitute.availabilityStatus !== 'unavailable'
    
    return matchesSearch && showBasedOnAvailability
  })

  const stats = {
    available: substitutes.filter(s => s.availabilityStatus === 'available').length,
    partial: substitutes.filter(s => s.availabilityStatus === 'partial').length,
    unavailable: substitutes.filter(s => s.availabilityStatus === 'unavailable').length
  }

  if (!startDate || !endDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Substitutes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Please select your leave dates first to see available substitutes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Select Substitutes
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            {stats.available} Available
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            {stats.partial} Partial
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-red-500" />
            {stats.unavailable} Unavailable
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showUnavailable"
              checked={showUnavailable}
              onCheckedChange={setShowUnavailable}
            />
            <label htmlFor="showUnavailable" className="text-sm">
              Show unavailable
            </label>
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            <div className="animate-pulse bg-gray-200 h-16 rounded"></div>
            <div className="animate-pulse bg-gray-200 h-16 rounded"></div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {filteredSubstitutes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No substitutes match your search.' : 'No available substitutes found.'}
              </div>
            ) : (
              filteredSubstitutes.map((substitute) => (
                <div
                  key={substitute.id}
                  className={cn(
                    "border rounded-lg p-4 transition-all duration-200",
                    selectedSubstitutes.includes(substitute.id) 
                      ? "border-blue-200 bg-blue-50" 
                      : "border-gray-200 hover:border-gray-300",
                    substitute.availabilityStatus === 'unavailable' && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedSubstitutes.includes(substitute.id)}
                      onCheckedChange={() => toggleSubstitute(substitute.id)}
                      disabled={disabled}
                      className="mt-1"
                    />
                    
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={substitute.image} />
                      <AvatarFallback>
                        {substitute.firstName[0]}{substitute.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{substitute.name}</h3>
                          <p className="text-sm text-gray-600">{substitute.department} • {substitute.role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getAvailabilityIcon(substitute.availabilityStatus)}
                          {getAvailabilityBadge(substitute.availabilityStatus)}
                        </div>
                      </div>
                      
                      {substitute.conflicts.length > 0 && (
                        <div className="mt-2">
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs text-gray-600 hover:text-gray-900"
                                onClick={() => toggleConflictExpansion(substitute.id)}
                              >
                                {substitute.conflicts.length} conflict{substitute.conflicts.length > 1 ? 's' : ''} 
                                {selectedDates && substitute.conflicts.some(c => c.conflictingDates) && 
                                  ` (${substitute.conflicts.flatMap(c => c.conflictingDates || []).length} conflicting dates)`
                                }
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="space-y-2">
                                {substitute.conflicts.map((conflict, index) => (
                                  <div key={index} className="flex items-start gap-2 text-xs">
                                    {getConflictIcon(conflict.type)}
                                    <div>
                                      <span className="font-medium">{conflict.dates}</span>
                                      <span className="text-gray-600"> - {conflict.details}</span>
                                      {conflict.conflictingDates && conflict.conflictingDates.length > 0 && (
                                        <div className="mt-1">
                                          <span className="text-red-600 font-medium">
                                            Conflicts on: {conflict.conflictingDates.join(', ')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selectedSubstitutes.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {selectedSubstitutes.length} substitute{selectedSubstitutes.length > 1 ? 's' : ''} selected
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}