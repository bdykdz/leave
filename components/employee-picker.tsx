"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useTranslations } from "@/components/language-provider"

interface Employee {
  id: string
  name: string
  avatar: string
  department: string
  role: string
  manager: string
  status: "active" | "on_leave" | "medical_leave"
}

interface EmployeePickerProps {
  selectedEmployee: string
  onEmployeeChange: (employeeId: string) => void
}

export function EmployeePicker({ selectedEmployee, onEmployeeChange }: EmployeePickerProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  // Mock employee data
  const employees: Employee[] = [
    {
      id: "sarah_johnson",
      name: "Sarah Johnson",
      avatar: "SJ",
      department: "Engineering",
      role: "Senior Developer",
      manager: "Michael Chen",
      status: "active",
    },
    {
      id: "michael_chen",
      name: "Michael Chen",
      avatar: "MC",
      department: "Engineering",
      role: "Team Lead",
      manager: "Sarah Williams",
      status: "active",
    },
    {
      id: "emily_rodriguez",
      name: "Emily Rodriguez",
      avatar: "ER",
      department: "Design",
      role: "UI/UX Designer",
      manager: "Anna Thompson",
      status: "active",
    },
    {
      id: "david_kim",
      name: "David Kim",
      avatar: "DK",
      department: "Product",
      role: "Product Manager",
      manager: "James Wilson",
      status: "active",
    },
    {
      id: "lisa_wang",
      name: "Lisa Wang",
      avatar: "LW",
      department: "Marketing",
      role: "Marketing Specialist",
      manager: "Robert Garcia",
      status: "active",
    },
    {
      id: "james_wilson",
      name: "James Wilson",
      avatar: "JW",
      department: "Sales",
      role: "Sales Manager",
      manager: "Director Smith",
      status: "active",
    },
    {
      id: "anna_thompson",
      name: "Anna Thompson",
      avatar: "AT",
      department: "HR",
      role: "HR Specialist",
      manager: "HR Director",
      status: "active",
    },
    {
      id: "robert_garcia",
      name: "Robert Garcia",
      avatar: "RG",
      department: "Finance",
      role: "Financial Analyst",
      manager: "Finance Director",
      status: "active",
    },
    {
      id: "jennifer_martinez",
      name: "Jennifer Martinez",
      avatar: "JM",
      department: "Marketing",
      role: "Marketing Coordinator",
      manager: "Lisa Wang",
      status: "medical_leave",
    },
  ]

  const getSelectedEmployee = () => {
    return employees.find((emp) => emp.id === selectedEmployee)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "on_leave":
        return "bg-yellow-100 text-yellow-800"
      case "medical_leave":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const selectedEmployeeData = getSelectedEmployee()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal h-auto min-h-[44px] py-2 px-3"
        >
          <div className="flex items-center gap-3 w-full overflow-hidden">
            {selectedEmployeeData ? (
              <>
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage  />
                  <AvatarFallback className="text-xs">{selectedEmployeeData.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{selectedEmployeeData.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {selectedEmployeeData.role} • {selectedEmployeeData.department}
                  </div>
                </div>
                <Badge className={`text-xs ${getStatusColor(selectedEmployeeData.status)} shrink-0`}>
                  {selectedEmployeeData.status.replace("_", " ")}
                </Badge>
              </>
            ) : (
              <span className="text-gray-500 text-sm">{t.placeholders.selectEmployee}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search employees..." className="h-9" />
          <CommandList>
            <CommandEmpty>No employees found.</CommandEmpty>
            <CommandGroup>
              {employees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={employee.name}
                  onSelect={() => {
                    onEmployeeChange(employee.id)
                    setOpen(false)
                  }}
                  className="cursor-pointer p-0"
                >
                  <div className="flex items-center gap-3 flex-1 w-full p-3 hover:bg-gray-50 rounded">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage  />
                      <AvatarFallback className="text-xs">{employee.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{employee.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {employee.role} • {employee.department}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{t.labels.reportsTo}: {employee.manager}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${getStatusColor(employee.status)}`}>
                        {employee.status.replace("_", " ")}
                      </Badge>
                      <Check
                        className={cn(
                          "h-4 w-4 text-blue-600",
                          selectedEmployee === employee.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
