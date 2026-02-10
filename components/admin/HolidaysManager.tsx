'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Calendar, Plus, Edit2, Trash2, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Holiday {
  id: string
  nameEn: string
  nameRo: string
  date: string
  description?: string
  isRecurring: boolean
  country: string
  isActive: boolean
}

export function HolidaysManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [seeding, setSeeding] = useState(false)
  
  const [formData, setFormData] = useState({
    nameEn: '',
    nameRo: '',
    date: '',
    description: '',
    isRecurring: false,
    country: 'RO'
  })

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    try {
      const response = await fetch('/api/admin/holidays')
      const data = await response.json()
      setHolidays(data.holidays || [])
    } catch (error) {
      console.error('Failed to fetch holidays:', error)
      toast.error('Failed to load holidays')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingHoliday 
        ? `/api/admin/holidays/${editingHoliday.id}` 
        : '/api/admin/holidays'
      
      const method = editingHoliday ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) throw new Error('Failed to save holiday')
      
      toast.success(editingHoliday ? 'Holiday updated!' : 'Holiday created!')
      setDialogOpen(false)
      resetForm()
      fetchHolidays()
    } catch (error) {
      console.error('Save holiday error:', error)
      toast.error('Failed to save holiday')
    }
  }

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday)
    setFormData({
      nameEn: holiday.nameEn,
      nameRo: holiday.nameRo,
      date: format(new Date(holiday.date), 'yyyy-MM-dd'),
      description: holiday.description || '',
      isRecurring: holiday.isRecurring,
      country: holiday.country
    })
    setDialogOpen(true)
  }

  const handleDelete = async (holidayId: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return
    
    try {
      const response = await fetch(`/api/admin/holidays/${holidayId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete holiday')
      
      toast.success('Holiday deleted!')
      fetchHolidays()
    } catch (error) {
      console.error('Delete holiday error:', error)
      toast.error('Failed to delete holiday')
    }
  }

  const handleSeedHolidays = async () => {
    if (!confirm('This will replace all existing holidays with Romanian holidays for 2026-2027. Continue?')) return
    
    setSeeding(true)
    try {
      const response = await fetch('/api/admin/holidays/seed', {
        method: 'POST'
      })
      
      if (!response.ok) throw new Error('Failed to seed holidays')
      
      const data = await response.json()
      toast.success(data.message)
      fetchHolidays()
    } catch (error) {
      console.error('Seed holidays error:', error)
      toast.error('Failed to seed holidays')
    } finally {
      setSeeding(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameRo: '',
      date: '',
      description: '',
      isRecurring: false,
      country: 'RO'
    })
    setEditingHoliday(null)
  }

  if (loading) {
    return <div>Loading holidays...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Holiday Management</h2>
          <p className="text-muted-foreground">Manage company holidays and observances</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSeedHolidays}
            variant="outline"
            disabled={seeding}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {seeding ? 'Seeding...' : 'Seed Romanian Holidays'}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                </DialogTitle>
                <DialogDescription>
                  {editingHoliday ? 'Update holiday information' : 'Create a new company holiday'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nameEn">English Name</Label>
                    <Input
                      id="nameEn"
                      value={formData.nameEn}
                      onChange={(e) => setFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                      placeholder="Christmas Day"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="nameRo">Romanian Name</Label>
                    <Input
                      id="nameRo"
                      value={formData.nameRo}
                      onChange={(e) => setFormData(prev => ({ ...prev, nameRo: e.target.value }))}
                      placeholder="Crăciunul"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Additional details about this holiday"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isRecurring"
                    checked={formData.isRecurring}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, isRecurring: checked as boolean }))
                    }
                  />
                  <Label htmlFor="isRecurring">Recurring annually</Label>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingHoliday ? 'Update Holiday' : 'Create Holiday'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Holidays</CardTitle>
          <CardDescription>
            Manage holidays that block leave requests and appear in employee calendars
          </CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No holidays configured</p>
              <p className="text-muted-foreground mb-4">Add holidays to block them in leave calendars</p>
              <Button onClick={handleSeedHolidays} disabled={seeding}>
                Seed Romanian Holidays
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>English Name</TableHead>
                  <TableHead>Romanian Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">{holiday.nameEn}</TableCell>
                    <TableCell>{holiday.nameRo}</TableCell>
                    <TableCell>{format(new Date(holiday.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      {holiday.isRecurring ? (
                        <Badge variant="secondary">Recurring</Badge>
                      ) : (
                        <Badge variant="outline">One-time</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {holiday.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(holiday)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(holiday.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}