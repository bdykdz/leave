"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { 
  Calendar,
  TrendingUp,
  Users,
  Shield,
  Clock,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  Download,
  CalendarDays,
  Building,
  Activity,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { format, isToday, isFuture, isPast, differenceInDays } from "date-fns"

interface Holiday {
  id: string
  nameEn: string
  nameRo: string
  date: string
  description?: string
  isRecurring: boolean
  isBlocked: boolean
  country: string
  isActive: boolean
}

interface HolidayAnalytics {
  totalHolidays: number
  mandatoryWorkDays: number
  holidayExtensions: number
  utilizationRate: number
  monthlyBreakdown: Record<string, number>
  departmentImpact: number
  upcomingHolidays: Holiday[]
}

interface HolidayData {
  holidays: Holiday[]
  analytics?: HolidayAnalytics
  availableYears: number[]
  currentYear: number
}

export function HolidayManager() {
  const [data, setData] = useState<HolidayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchHolidays()
  }, [selectedYear])

  const fetchHolidays = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/hr/holidays?year=${selectedYear}&analytics=true`)
      if (response.ok) {
        const holidayData = await response.json()
        setData(holidayData)
      } else {
        toast.error('Failed to fetch holidays')
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
      toast.error('Error fetching holidays')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleBlocked = async (holiday: Holiday) => {
    try {
      setUpdating(holiday.id)
      const response = await fetch('/api/hr/holidays', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holidayId: holiday.id,
          isBlocked: !holiday.isBlocked
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        fetchHolidays() // Refresh data
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update holiday')
      }
    } catch (error) {
      console.error('Error updating holiday:', error)
      toast.error('Failed to update holiday')
    } finally {
      setUpdating(null)
    }
  }

  const viewHolidayDetails = (holiday: Holiday) => {
    setSelectedHoliday(holiday)
    setDetailsOpen(true)
  }

  const getHolidayStatus = (holiday: Holiday) => {
    const holidayDate = new Date(holiday.date)
    if (isToday(holidayDate)) return { label: 'Today', color: 'bg-blue-100 text-blue-800' }
    if (isPast(holidayDate)) return { label: 'Past', color: 'bg-gray-100 text-gray-800' }
    if (isFuture(holidayDate)) {
      const daysUntil = differenceInDays(holidayDate, new Date())
      if (daysUntil <= 7) return { label: 'This Week', color: 'bg-green-100 text-green-800' }
      if (daysUntil <= 30) return { label: 'This Month', color: 'bg-yellow-100 text-yellow-800' }
      return { label: 'Future', color: 'bg-gray-100 text-gray-800' }
    }
    return { label: 'Unknown', color: 'bg-gray-100 text-gray-800' }
  }

  const filteredHolidays = data?.holidays.filter(holiday => {
    const matchesSearch = searchTerm === "" || 
      holiday.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      holiday.nameRo.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "upcoming" && isFuture(new Date(holiday.date))) ||
      (statusFilter === "past" && isPast(new Date(holiday.date))) ||
      (statusFilter === "blocked" && holiday.isBlocked) ||
      (statusFilter === "unblocked" && !holiday.isBlocked)
    
    const matchesType = typeFilter === "all" ||
      (typeFilter === "recurring" && holiday.isRecurring) ||
      (typeFilter === "oneTime" && !holiday.isRecurring)
    
    return matchesSearch && matchesStatus && matchesType
  }) || []

  if (loading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
        <p>Loading holidays...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      {data?.analytics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Holidays</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.analytics.totalHolidays}</div>
              <p className="text-xs text-muted-foreground">in {selectedYear}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mandatory Work Days</CardTitle>
              <Shield className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{data.analytics.mandatoryWorkDays}</div>
              <p className="text-xs text-muted-foreground">blocked holidays</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Holiday Extensions</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{data.analytics.holidayExtensions}</div>
              <p className="text-xs text-muted-foreground">leave requests around holidays</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{data.analytics.utilizationRate}%</div>
              <p className="text-xs text-muted-foreground">holiday weekend usage</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                Holiday Management
              </CardTitle>
              <CardDescription>
                View and manage company holidays, control leave blocking policies
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data?.availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={fetchHolidays}
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="calendar" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Holiday Calendar
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Upcoming Holidays
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="mt-6">
              {/* Filters */}
              <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="search">Search Holidays</Label>
                    <Input
                      id="search"
                      placeholder="Holiday name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="past">Past</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                        <SelectItem value="unblocked">Allow Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Type</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="recurring">Recurring</SelectItem>
                        <SelectItem value="oneTime">One-time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("")
                        setStatusFilter("all")
                        setTypeFilter("all")
                      }}
                      className="w-full"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>

              {/* Holidays Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holiday</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Leave Policy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHolidays.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          No holidays found for your filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHolidays.map((holiday) => {
                        const status = getHolidayStatus(holiday)
                        return (
                          <TableRow key={holiday.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div>
                                <p className="font-medium">{holiday.nameEn}</p>
                                <p className="text-sm text-gray-500">{holiday.nameRo}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">
                                  {format(new Date(holiday.date), 'MMM dd, yyyy')}
                                </span>
                                <Badge variant="outline" className={status.color}>
                                  {status.label}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={holiday.isRecurring ? "default" : "secondary"}>
                                {holiday.isRecurring ? "Recurring" : "One-time"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={holiday.isBlocked}
                                  onCheckedChange={() => handleToggleBlocked(holiday)}
                                  disabled={updating === holiday.id}
                                />
                                <span className="text-sm">
                                  {holiday.isBlocked ? (
                                    <span className="text-orange-600 flex items-center gap-1">
                                      <XCircle className="h-3 w-3" />
                                      Block Leave
                                    </span>
                                  ) : (
                                    <span className="text-green-600 flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3" />
                                      Allow Leave
                                    </span>
                                  )}
                                </span>
                                {updating === holiday.id && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={holiday.isActive ? "default" : "secondary"}>
                                {holiday.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewHolidayDetails(holiday)}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="upcoming" className="mt-6">
              {data?.analytics?.upcomingHolidays && data.analytics.upcomingHolidays.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Next 5 Holidays</h3>
                    <Badge variant="outline">
                      {data.analytics.upcomingHolidays.length} upcoming
                    </Badge>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {data.analytics.upcomingHolidays.map((holiday) => (
                      <Card key={holiday.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{holiday.nameEn}</CardTitle>
                              <CardDescription className="text-sm">{holiday.nameRo}</CardDescription>
                            </div>
                            {holiday.isBlocked && (
                              <Badge variant="outline" className="text-orange-600 border-orange-200">
                                <Shield className="h-3 w-3 mr-1" />
                                Blocked
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="font-mono">
                                {format(new Date(holiday.date), 'MMM dd, yyyy (EEEE)')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span>
                                {differenceInDays(new Date(holiday.date), new Date())} days away
                              </span>
                            </div>
                            {holiday.description && (
                              <p className="text-xs text-gray-500 mt-2">
                                {holiday.description}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium">No upcoming holidays</p>
                  <p className="text-gray-500">All holidays for this year have passed</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Holiday Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Holiday Details</DialogTitle>
            <DialogDescription>
              Complete information about this holiday
            </DialogDescription>
          </DialogHeader>

          {selectedHoliday && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium">English Name</Label>
                  <p className="text-lg font-semibold mt-1">{selectedHoliday.nameEn}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Romanian Name</Label>
                  <p className="text-lg font-semibold mt-1">{selectedHoliday.nameRo}</p>
                </div>
              </div>

              {/* Date & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Date</Label>
                  <p className="font-mono text-lg mt-1">
                    {format(new Date(selectedHoliday.date), 'EEEE, MMMM dd, yyyy')}
                  </p>
                  <Badge variant="outline" className={getHolidayStatus(selectedHoliday).color + " mt-2"}>
                    {getHolidayStatus(selectedHoliday).label}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Type & Policies</Label>
                  <div className="space-y-2 mt-1">
                    <Badge variant={selectedHoliday.isRecurring ? "default" : "secondary"}>
                      {selectedHoliday.isRecurring ? "Recurring Annually" : "One-time Event"}
                    </Badge>
                    <div>
                      <Badge 
                        variant="outline" 
                        className={selectedHoliday.isBlocked 
                          ? "text-orange-600 border-orange-200" 
                          : "text-green-600 border-green-200"
                        }
                      >
                        {selectedHoliday.isBlocked ? (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Leave Requests Blocked
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Leave Requests Allowed
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedHoliday.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-gray-600 mt-1 p-3 bg-gray-50 rounded-md">
                    {selectedHoliday.description}
                  </p>
                </div>
              )}

              {/* Policy Information */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">Leave Policy Impact</p>
                    <p className="text-blue-800 mt-1">
                      {selectedHoliday.isBlocked 
                        ? "This is a mandatory work day. Employees cannot request leave on this date and must work unless they have pre-approved emergency leave."
                        : "Employees can request leave on this date. The holiday will be shown in calendars but won't block leave requests."
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}