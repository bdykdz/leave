"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, Loader2, Info } from "lucide-react"
import { useTranslations } from "@/components/language-provider"

interface Colleague {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
  role: string
  isAvailable: boolean
}

interface BasicSubstitutePickerProps {
  startDate?: string
  endDate?: string
  selectedSubstitutes: string[]
  onSubstitutesChange: (substitutes: string[]) => void
}

export function BasicSubstitutePicker({
  startDate,
  endDate,
  selectedSubstitutes,
  onSubstitutesChange
}: BasicSubstitutePickerProps) {
  const t = useTranslations()
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (startDate && endDate) {
      fetchColleagues()
    }
  }, [startDate, endDate])

  const fetchColleagues = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/substitutes/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch colleagues')
      }

      const data = await response.json()
      const allColleagues = (data.substitutes || []).map((sub: any) => ({
        id: sub.id,
        firstName: sub.firstName,
        lastName: sub.lastName,
        email: sub.email,
        department: sub.department,
        role: sub.role,
        isAvailable: sub.availabilityStatus === 'available'
      }))
      setColleagues(allColleagues)
    } catch (error) {
      console.error('Error fetching colleagues:', error)
      setError('Unable to load department colleagues')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (colleague: Colleague) => {
    // Only allow selection of available colleagues
    if (!colleague.isAvailable) return
    
    const isSelected = selectedSubstitutes.includes(colleague.id)
    if (isSelected) {
      // Remove from selection
      onSubstitutesChange(selectedSubstitutes.filter(id => id !== colleague.id))
    } else {
      // Add to selection
      onSubstitutesChange([...selectedSubstitutes, colleague.id])
    }
  }

  if (!startDate || !endDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            {t.substitute.selectColleague}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t.substitute.selectDatesFirst}
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
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-600">Loading colleagues...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && colleagues.length === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No available colleagues found in your department.
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && colleagues.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-3">
              Select available colleagues from your department:
            </p>
            {colleagues.map((colleague) => (
              <div
                key={colleague.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  !colleague.isAvailable 
                    ? 'bg-red-50 border-red-200 opacity-60 cursor-not-allowed'
                    : selectedSubstitutes.includes(colleague.id)
                      ? 'bg-blue-50 border-blue-200 cursor-pointer'
                      : 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer'
                }`}
                onClick={() => handleToggle(colleague)}
              >
                <input
                  type="checkbox"
                  checked={selectedSubstitutes.includes(colleague.id)}
                  disabled={!colleague.isAvailable}
                  onChange={() => {}} // Handled by parent div click
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <Avatar className="h-8 w-8">
                  <AvatarImage src={undefined} />
                  <AvatarFallback className="text-xs">
                    {colleague.firstName[0]}{colleague.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {colleague.firstName} {colleague.lastName}
                  </div>
                  <div className="text-xs text-gray-500">{colleague.role}</div>
                </div>
                <div className={`text-xs font-medium px-2 py-1 rounded ${
                  colleague.isAvailable 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {colleague.isAvailable ? 'Available' : 'Not Available'}
                </div>
              </div>
            ))}
            
            {selectedSubstitutes.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{selectedSubstitutes.length}</strong> colleague{selectedSubstitutes.length > 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}