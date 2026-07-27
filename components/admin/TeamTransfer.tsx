"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { UserSearchSelect } from "./UserSearchSelect"
import { ArrowRight, Users, AlertTriangle, Loader2 } from "lucide-react"

interface UserSummary {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  isActive: boolean
  managerId: string | null
  departmentDirectorId: string | null
}

interface TeamReport {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  role: string
  isActive: boolean
  isDirectReport: boolean
  isDirectorReport: boolean
  pendingApprovals: { leave: number; wfh: number; workTrip: number }
}

const MANAGER_ROLES = ["MANAGER", "DEPARTMENT_DIRECTOR", "EXECUTIVE"]
const DIRECTOR_ROLES = ["DEPARTMENT_DIRECTOR", "EXECUTIVE"]

export function TeamTransfer() {
  const [allUsers, setAllUsers] = useState<UserSummary[]>([])
  const [oldManagerId, setOldManagerId] = useState("")
  const [newManagerId, setNewManagerId] = useState("")
  const [reports, setReports] = useState<TeamReport[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rerouteApprovals, setRerouteApprovals] = useState(true)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users")
      if (!response.ok) throw new Error()
      const data = await response.json()
      setAllUsers(data.users || [])
    } catch {
      toast.error("Failed to load users")
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const fetchTeam = useCallback(async (managerId: string) => {
    setLoadingTeam(true)
    try {
      const response = await fetch(`/api/admin/users/${managerId}/team`)
      if (!response.ok) throw new Error()
      const data = await response.json()
      setReports(data.reports || [])
      setSelectedIds(new Set((data.reports || []).map((r: TeamReport) => r.id)))
    } catch {
      toast.error("Failed to load the manager's team")
      setReports([])
      setSelectedIds(new Set())
    } finally {
      setLoadingTeam(false)
    }
  }, [])

  const handleOldManagerChange = (id: string) => {
    setOldManagerId(id)
    setReports([])
    setSelectedIds(new Set())
    if (newManagerId === id) setNewManagerId("")
    if (id && id !== "none") fetchTeam(id)
  }

  // Anyone who currently has at least one person reporting to them (including
  // deactivated users — the typical "manager already left" case)
  const managersWithReports = useMemo(() => {
    const managerIds = new Set<string>()
    allUsers.forEach(u => {
      if (u.managerId) managerIds.add(u.managerId)
      if (u.departmentDirectorId) managerIds.add(u.departmentDirectorId)
    })
    return allUsers.filter(u => managerIds.has(u.id))
  }, [allUsers])

  const eligibleNewManagers = useMemo(
    () => allUsers.filter(u => u.isActive && MANAGER_ROLES.includes(u.role)),
    [allUsers]
  )

  const oldManager = allUsers.find(u => u.id === oldManagerId)
  const newManager = allUsers.find(u => u.id === newManagerId)

  const selectedReports = reports.filter(r => selectedIds.has(r.id))
  const totalPending = selectedReports.reduce(
    (sum, r) => sum + r.pendingApprovals.leave + r.pendingApprovals.wfh + r.pendingApprovals.workTrip,
    0
  )
  const directorWarning =
    !!newManager &&
    !DIRECTOR_ROLES.includes(newManager.role) &&
    selectedReports.some(r => r.isDirectorReport)
  const promotingFromWithin = !!newManagerId && selectedIds.has(newManagerId)

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(reports.map(r => r.id)) : new Set())
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleTransfer = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/users/${oldManagerId}/reassign-team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newManagerId,
          userIds: Array.from(selectedIds),
          reroutePendingApprovals: rerouteApprovals,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || "Failed to transfer team")
        return
      }

      const s = data.summary
      const reroutedTotal = s.rerouted.leave + s.rerouted.wfh + s.rerouted.workTrip
      let message = `${s.managerReassigned} employee(s) moved to ${newManager?.firstName} ${newManager?.lastName}`
      if (s.directorReassigned > 0) message += `, ${s.directorReassigned} director assignment(s) updated`
      if (reroutedTotal > 0) message += `, ${reroutedTotal} pending approval(s) rerouted`
      toast.success(message)

      if (s.directorSkipped?.length > 0) {
        toast.warning(
          `Department director was NOT changed for: ${s.directorSkipped.join(", ")} (new manager is not a director/executive). Fix these in Users.`
        )
      }
      if (s.rerouteConflicts > 0) {
        toast.warning(`${s.rerouteConflicts} approval(s) skipped — the new manager was already an approver on those requests.`)
      }

      // Refresh: the old manager may now have no team left
      await fetchUsers()
      fetchTeam(oldManagerId)
    } catch {
      toast.error("An error occurred while transferring the team")
    } finally {
      setSubmitting(false)
    }
  }

  const allSelected = reports.length > 0 && selectedIds.size === reports.length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Transfer
          </CardTitle>
          <CardDescription>
            When a manager leaves or changes role, move everyone who reports to them to a new
            manager in one step — including rerouting any approvals still pending in their queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-end">
            <div className="space-y-2">
              <Label>Outgoing manager</Label>
              <UserSearchSelect
                users={managersWithReports}
                value={oldManagerId}
                onValueChange={handleOldManagerChange}
                placeholder="Search managers with a team..."
                noneLabel="Select outgoing manager"
              />
              {oldManager && !oldManager.isActive && (
                <p className="text-xs text-amber-600 dark:text-amber-400">This user is deactivated</p>
              )}
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 hidden md:block mb-2" />
            <div className="space-y-2">
              <Label>New manager</Label>
              <UserSearchSelect
                users={eligibleNewManagers}
                value={newManagerId}
                onValueChange={setNewManagerId}
                placeholder="Search for the new manager..."
                noneLabel="Select new manager"
                excludeId={oldManagerId}
              />
            </div>
          </div>

          {loadingTeam && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team...
            </div>
          )}

          {!loadingTeam && oldManagerId && reports.length === 0 && (
            <Alert>
              <AlertDescription>This user has no one reporting to them.</AlertDescription>
            </Alert>
          )}

          {reports.length > 0 && (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) => toggleAll(checked === true)}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department / Position</TableHead>
                      <TableHead>Reports as</TableHead>
                      <TableHead>Pending approvals</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => {
                      const pending =
                        report.pendingApprovals.leave +
                        report.pendingApprovals.wfh +
                        report.pendingApprovals.workTrip
                      return (
                        <TableRow key={report.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(report.id)}
                              onCheckedChange={(checked) => toggleOne(report.id, checked === true)}
                              aria-label={`Select ${report.firstName} ${report.lastName}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {report.firstName} {report.lastName}
                              {!report.isActive && (
                                <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{report.email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{report.department}</div>
                            <div className="text-xs text-gray-500">{report.position}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {report.isDirectReport && <Badge variant="secondary">Manager</Badge>}
                              {report.isDirectorReport && <Badge variant="outline">Director</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {pending > 0 ? (
                              <Badge variant="destructive">{pending} pending</Badge>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="reroute-approvals"
                  checked={rerouteApprovals}
                  onCheckedChange={(checked) => setRerouteApprovals(checked === true)}
                />
                <Label htmlFor="reroute-approvals" className="text-sm font-normal cursor-pointer">
                  Also reroute pending approvals to the new manager
                  {totalPending > 0 && (
                    <span className="text-gray-500"> ({totalPending} pending on selected employees)</span>
                  )}
                </Label>
              </div>

              {promotingFromWithin && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {newManager?.firstName} {newManager?.lastName} is part of this team and will be
                    skipped — they cannot be their own manager.
                  </AlertDescription>
                </Alert>
              )}

              {directorWarning && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Some selected employees have {oldManager?.firstName} {oldManager?.lastName} as
                    their department director, but {newManager?.firstName} {newManager?.lastName} is
                    not a Department Director or Executive. Their director assignment will be left
                    unchanged — reassign it manually in Users.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!newManagerId || newManagerId === "none" || selectedIds.size === 0 || submitting}
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Transfer {selectedIds.size} employee{selectedIds.size === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm team transfer</AlertDialogTitle>
            <AlertDialogDescription>
              Move {selectedIds.size} employee{selectedIds.size === 1 ? "" : "s"} from{" "}
              <strong>{oldManager?.firstName} {oldManager?.lastName}</strong> to{" "}
              <strong>{newManager?.firstName} {newManager?.lastName}</strong>
              {rerouteApprovals && totalPending > 0 && (
                <> and reroute {totalPending} pending approval{totalPending === 1 ? "" : "s"}</>
              )}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransfer}>Transfer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
