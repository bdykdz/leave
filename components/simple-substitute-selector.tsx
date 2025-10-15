"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  Info
} from "lucide-react"

interface SimpleSubstitute {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  department: string
  role: string
  profileImage?: string
  availabilityStatus: 'available' | 'partial' | 'unavailable'
  isRecommended: boolean
}

interface SimpleSubstituteSelectorProps {
  startDate?: string
  endDate?: string
  selectedDates?: string[]
  selectedSubstitutes: string[]
  onSubstitutesChange: (substitutes: string[]) => void
  disabled?: boolean
}

export function SimpleSubstituteSelector({
  startDate,
  endDate,
  selectedDates,
  selectedSubstitutes,
  onSubstitutesChange,
  disabled = false
}: SimpleSubstituteSelectorProps) {
  const [substitutes, setSubstitutes] = useState<SimpleSubstitute[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (startDate && endDate) {
      fetchSubstitutes()
    }
  }, [startDate, endDate, selectedDates])

  const fetchSubstitutes = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/substitutes/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          selectedDates
        })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch substitutes')
      }

      const data = await response.json()
      setSubstitutes(data.substitutes || [])
    } catch (error) {
      console.error('Error fetching substitutes:', error)
      setError(error instanceof Error ? error.message : 'Unable to load department colleagues')
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'partial':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'unavailable':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'unavailable':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const availableSubstitutes = substitutes.filter(s => s.availabilityStatus === 'available')
  const partialSubstitutes = substitutes.filter(s => s.availabilityStatus === 'partial')
  const unavailableSubstitutes = substitutes.filter(s => s.availabilityStatus === 'unavailable')

  if (!startDate || !endDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Select Department Colleague as Substitute
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Please select your leave dates first to see available department colleagues.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4" />
          Select Department Colleague as Substitute
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-600">Loading department colleagues...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && substitutes.length === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No other colleagues found in your department.
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && substitutes.length > 0 && (
          <div className="space-y-3">
            {/* Available Substitutes */}
            {availableSubstitutes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Available ({availableSubstitutes.length})
                </h4>
                <div className="space-y-2">
                  {availableSubstitutes.map((substitute) => (
                    <div
                      key={substitute.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedSubstitutes.includes(substitute.id)
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => toggleSubstitute(substitute.id)}
                    >
                      <Checkbox
                        checked={selectedSubstitutes.includes(substitute.id)}
                        onChange={() => {}} // Handled by parent div click
                        disabled={disabled}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={substitute.profileImage || undefined} />
                        <AvatarFallback className="text-xs">
                          {substitute.firstName[0]}{substitute.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{substitute.name}</div>
                        <div className="text-xs text-gray-500">{substitute.role}</div>
                      </div>
                      {getStatusIcon(substitute.availabilityStatus)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Partially Available Substitutes */}
            {partialSubstitutes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-yellow-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Partially Available ({partialSubstitutes.length})
                </h4>
                <div className="space-y-2">
                  {partialSubstitutes.map((substitute) => (
                    <div
                      key={substitute.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedSubstitutes.includes(substitute.id)
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => toggleSubstitute(substitute.id)}
                    >
                      <Checkbox
                        checked={selectedSubstitutes.includes(substitute.id)}
                        onChange={() => {}} // Handled by parent div click
                        disabled={disabled}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={substitute.profileImage || undefined} />
                        <AvatarFallback className="text-xs">
                          {substitute.firstName[0]}{substitute.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{substitute.name}</div>
                        <div className="text-xs text-gray-500">{substitute.role}</div>
                      </div>
                      {getStatusIcon(substitute.availabilityStatus)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unavailable Substitutes - Show collapsed */}
            {unavailableSubstitutes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Unavailable ({unavailableSubstitutes.length})
                </h4>
                <div className="text-xs text-gray-500 italic">
                  {unavailableSubstitutes.map(s => s.name).join(', ')} - on leave or unavailable
                </div>
              </div>
            )}

            {selectedSubstitutes.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>{selectedSubstitutes.length}</strong> colleague{selectedSubstitutes.length > 1 ? 's' : ''} selected as substitute{selectedSubstitutes.length > 1 ? 's' : ''}.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}