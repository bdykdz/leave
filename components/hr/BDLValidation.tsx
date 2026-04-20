"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Droplet,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

type BDLFilter = 'pending_hr' | 'validated' | 'all'

interface BDLRequest {
  id: string
  requestNumber: string
  status: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  createdAt: string
  updatedAt: string
  hrDocumentVerified: boolean
  hrVerifiedAt: string | null
  hrVerificationNotes: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    department: string | null
  }
  leaveType: {
    id: string
    code: string
    name: string
    documentTypes: string[]
  }
  approvals: Array<{
    id: string
    level: number
    status: string
    approvedAt: string | null
    approver: {
      id: string
      firstName: string
      lastName: string
      role: string
    }
  }>
  verifiedByUser: {
    id: string
    firstName: string
    lastName: string
  } | null
}

export function BDLValidation() {
  const [requests, setRequests] = useState<BDLRequest[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<BDLFilter>('pending_hr')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<BDLRequest | null>(null)
  const [actionMode, setActionMode] = useState<'validate' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ filter })
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/hr/bdl-validation?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setRequests(data.requests || [])
      setPendingCount(data.pendingCount || 0)
    } catch (e) {
      console.error(e)
      toast.error('Nu s-a putut încărca lista de cereri BDL')
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const openDialog = (req: BDLRequest, mode: 'validate' | 'reject') => {
    setSelected(req)
    setActionMode(mode)
    setNotes('')
  }

  const closeDialog = () => {
    setSelected(null)
    setActionMode(null)
    setNotes('')
  }

  const submitAction = async () => {
    if (!selected || !actionMode) return
    setSubmitting(true)
    try {
      const endpoint = actionMode === 'validate'
        ? `/api/manager/team/approve-request/${selected.id}`
        : `/api/manager/team/deny-request/${selected.id}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'leave',
          comment: notes || (actionMode === 'validate'
            ? 'Certificat de donare validat.'
            : 'Document lipsă sau invalid.'
          )
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Eroare la procesare')
      }
      toast.success(actionMode === 'validate'
        ? 'Cerere validată — concediul este final aprobat.'
        : 'Cerere respinsă — balanța a fost restaurată.'
      )
      closeDialog()
      fetchList()
    } catch (e: any) {
      toast.error(e?.message || 'A apărut o eroare')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (req: BDLRequest) => {
    if (req.hrDocumentVerified) {
      return <Badge className="bg-emerald-600"><CheckCircle className="w-3 h-3 mr-1" />Validat</Badge>
    }
    if (req.status === 'REJECTED') {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Respins</Badge>
    }
    return <Badge variant="outline" className="border-amber-400 text-amber-700"><Clock className="w-3 h-3 mr-1" />În așteptare</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplet className="w-5 h-5 text-red-500" />
          Concediu Donare — validare documente
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-2">{pendingCount} în așteptare</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Cereri de Concediu Donare aprobate de manager care așteaptă validarea certificatului de donare.
          Validarea HR finalizează cererea și deduce ziua din balanță.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as BDLFilter)} className="flex-1">
            <TabsList>
              <TabsTrigger value="pending_hr">În așteptare</TabsTrigger>
              <TabsTrigger value="validated">Validate</TabsTrigger>
              <TabsTrigger value="all">Toate</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Caută angajat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Nicio cerere BDL în această vizualizare.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr. cerere</TableHead>
                  <TableHead>Angajat</TableHead>
                  <TableHead>Departament</TableHead>
                  <TableHead>Data donării</TableHead>
                  <TableHead>Aprobat manager</TableHead>
                  <TableHead>Status doc</TableHead>
                  <TableHead>Validat de</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => {
                  const managerApproval = req.approvals.find(a => a.level === 1)
                  const hrPending = req.approvals.find(a => a.level === 2 && a.status === 'PENDING')
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs">{req.requestNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium">{req.user.firstName} {req.user.lastName}</div>
                        <div className="text-xs text-muted-foreground">{req.user.email}</div>
                      </TableCell>
                      <TableCell>{req.user.department || '-'}</TableCell>
                      <TableCell>{format(new Date(req.startDate), 'dd.MM.yyyy')}</TableCell>
                      <TableCell>
                        {managerApproval?.approvedAt
                          ? format(new Date(managerApproval.approvedAt), 'dd.MM.yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(req)}</TableCell>
                      <TableCell>
                        {req.verifiedByUser
                          ? `${req.verifiedByUser.firstName} ${req.verifiedByUser.lastName}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {hrPending && !req.hrDocumentVerified ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => openDialog(req, 'validate')}
                            >
                              Validează
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDialog(req, 'reject')}
                            >
                              Respinge
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected && !!actionMode} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionMode === 'validate'
                ? 'Validează certificatul de donare'
                : 'Respinge documentul de donare'}
            </DialogTitle>
            <DialogDescription>
              {selected && (
                <>
                  {selected.user.firstName} {selected.user.lastName} — {format(new Date(selected.startDate), 'dd.MM.yyyy')} ({selected.totalDays} zi)
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Notițe {actionMode === 'reject' ? '(motiv respingere)' : '(opțional)'}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={actionMode === 'validate'
                ? 'ex: Certificat primit pe email, data 15.04.2026'
                : 'ex: Document lipsă sau necorespunzător'}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>
              Renunță
            </Button>
            <Button
              onClick={submitAction}
              disabled={submitting || (actionMode === 'reject' && !notes.trim())}
              variant={actionMode === 'reject' ? 'destructive' : 'default'}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionMode === 'validate' ? 'Validează cererea' : 'Respinge cererea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
