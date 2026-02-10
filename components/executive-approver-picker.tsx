"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Shield, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"

interface Executive {
  id: string
  name: string
  email: string
  department: string
  position: string
}

interface ExecutiveApproverPickerProps {
  selectedApprover: string
  onApproverChange: (approverId: string) => void
}

export function ExecutiveApproverPicker({ 
  selectedApprover, 
  onApproverChange 
}: ExecutiveApproverPickerProps) {
  const [open, setOpen] = useState(false)
  const [executives, setExecutives] = useState<Executive[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExecutives()
  }, [])

  const fetchExecutives = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/executives/peers')
      if (response.ok) {
        const data = await response.json()
        setExecutives(data.executives)
      } else {
        toast.error('Failed to load executives')
      }
    } catch (error) {
      console.error('Error fetching executives:', error)
      toast.error('Failed to load executives')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (executiveId: string) => {
    onApproverChange(executiveId)
    setOpen(false)
  }

  const getSelectedExecutive = () => {
    return executives.find((exec) => exec.id === selectedApprover)
  }

  const selectedExecutive = getSelectedExecutive()

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-purple-600" />
        Executive Approver
        <span className="text-red-500">*</span>
      </Label>
      <p className="text-sm text-gray-600">
        Select an executive colleague to approve your leave request
      </p>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading executives...
              </div>
            ) : selectedExecutive ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {(selectedExecutive.name || 'U').split(' ').map((n: string) => n?.[0] || '').join('')}
                  </AvatarFallback>
                </Avatar>
                <span>{selectedExecutive.name}</span>
                <span className="text-gray-500 text-sm">• {selectedExecutive.position}</span>
              </div>
            ) : (
              <span className="text-gray-500">Select an executive approver...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading executives...
              </div>
            ) : executives.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No other executives available
              </div>
            ) : (
              executives.map((executive) => (
                <div
                  key={executive.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors",
                    selectedApprover === executive.id && "bg-blue-50"
                  )}
                  onClick={() => handleSelect(executive.id)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {(executive.name || 'U').split(' ').map((n: string) => n?.[0] || '').join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{executive.name}</div>
                    <div className="text-xs text-gray-500">
                      {executive.position} • {executive.department}
                    </div>
                  </div>
                  {selectedApprover === executive.id && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}