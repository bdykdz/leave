"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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
import {
  Upload,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Check,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

interface User {
  id: string
  firstName: string
  lastName: string
  employeeId: string
  department: string
}

interface CsvRow {
  employeeId: string
  year: number
  entitled: number
  used: number
}

interface ChainUserResult {
  userId: string
  employeeId: string
  name: string
  years: Array<{
    year: number
    entitled: number
    used: number
    carriedForward: number
    available: number
    unused: number
    carryToNext: number
    lost: number
  }>
}

interface ChainResult {
  summary: { totalUsers: number; totalCarriedForward: number; totalLost: number }
  users: ChainUserResult[]
}

export function HistoricalBalanceImport() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Historical Balance Import</h2>
        <p className="text-muted-foreground mt-1">
          Import historical Normal Leave (NL) balances and chain carry-forward across years.
        </p>
      </div>

      <Tabs defaultValue="csv" className="space-y-4">
        <TabsList>
          <TabsTrigger value="csv">CSV Import</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="chain">Chain Carry-Forward</TabsTrigger>
        </TabsList>

        <TabsContent value="csv">
          <CsvImportTab />
        </TabsContent>

        <TabsContent value="manual">
          <ManualEntryTab />
        </TabsContent>

        <TabsContent value="chain">
          <ChainCarryForwardTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// CSV Import Tab
// ============================================================

function CsvImportTab() {
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    window.open('/api/admin/historical-balances/template', '_blank')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      parseCsv(text)
    }
    reader.readAsText(file)
  }

  const parseCsv = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) {
      setParseErrors(['CSV file must have a header row and at least one data row'])
      setCsvRows([])
      return
    }

    const header = lines[0].toLowerCase().replace(/\r/g, '')
    const expectedHeaders = ['employeeid', 'year', 'entitled', 'used']
    const headers = header.split(',').map(h => h.trim())

    const missing = expectedHeaders.filter(h => !headers.includes(h))
    if (missing.length > 0) {
      setParseErrors([`Missing columns: ${missing.join(', ')}. Expected: employeeId,year,entitled,used`])
      setCsvRows([])
      return
    }

    const idxEmployeeId = headers.indexOf('employeeid')
    const idxYear = headers.indexOf('year')
    const idxEntitled = headers.indexOf('entitled')
    const idxUsed = headers.indexOf('used')

    const rows: CsvRow[] = []
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/\r/g, '').trim()
      if (!line) continue

      const cols = line.split(',').map(c => c.trim())
      const employeeId = cols[idxEmployeeId]
      const year = parseInt(cols[idxYear])
      const entitled = parseFloat(cols[idxEntitled])
      const used = parseFloat(cols[idxUsed])

      if (!employeeId) { errors.push(`Row ${i + 1}: Missing employeeId`); continue }
      if (isNaN(year) || year < 2020 || year > new Date().getFullYear()) { errors.push(`Row ${i + 1}: Invalid year "${cols[idxYear]}"`); continue }
      if (isNaN(entitled) || entitled < 0) { errors.push(`Row ${i + 1}: Invalid entitled "${cols[idxEntitled]}"`); continue }
      if (isNaN(used) || used < 0) { errors.push(`Row ${i + 1}: Invalid used "${cols[idxUsed]}"`); continue }

      rows.push({ employeeId, year, entitled, used })
    }

    setCsvRows(rows)
    setParseErrors(errors)
  }

  const handleImport = async () => {
    if (csvRows.length === 0) return
    setImporting(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/historical-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'bulk',
          entries: csvRows,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setResult(data)
      setCsvRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      setResult({ created: 0, updated: 0, errors: [err.message] })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          CSV Import
        </CardTitle>
        <CardDescription>
          Upload a CSV file with historical Normal Leave balances (entitled and used days per year).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Select a CSV file to upload</p>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="max-w-sm mx-auto"
          />
        </div>

        {parseErrors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="font-medium text-red-800 dark:text-red-200 text-sm mb-1">Parse errors:</p>
            <ul className="text-sm text-red-700 dark:text-red-300 list-disc pl-5 space-y-0.5">
              {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {csvRows.length > 0 && (
          <>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Employee ID</th>
                      <th className="px-3 py-2 text-left font-medium">Year</th>
                      <th className="px-3 py-2 text-right font-medium">Entitled</th>
                      <th className="px-3 py-2 text-right font-medium">Used</th>
                      <th className="px-3 py-2 text-right font-medium">Unused</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {csvRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 py-1.5 font-mono text-xs">{row.employeeId}</td>
                        <td className="px-3 py-1.5">{row.year}</td>
                        <td className="px-3 py-1.5 text-right">{row.entitled}</td>
                        <td className="px-3 py-1.5 text-right">{row.used}</td>
                        <td className="px-3 py-1.5 text-right">{row.entitled - row.used}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{csvRows.length} rows ready to import</p>
              <Button onClick={handleImport} disabled={importing}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import {csvRows.length} Records
              </Button>
            </div>
          </>
        )}

        {result && (
          <div className={`rounded-lg p-4 ${result.errors.length > 0 && result.created === 0 && result.updated === 0
            ? 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
            : 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {result.errors.length > 0 && result.created === 0 && result.updated === 0 ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <Check className="h-5 w-5 text-green-600" />
              )}
              <span className="font-medium">Import Results</span>
            </div>
            <div className="text-sm space-y-1">
              <p>Created: {result.created} | Updated: {result.updated}</p>
              {result.errors.length > 0 && (
                <ul className="text-red-700 dark:text-red-300 list-disc pl-5 mt-1">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Manual Entry Tab
// ============================================================

function ManualEntryTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [entitled, setEntitled] = useState('')
  const [used, setUsed] = useState('')
  const [carriedForward, setCarriedForward] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [existingBalance, setExistingBalance] = useState<any>(null)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [userError, setUserError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    setUserError(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        setUserError('Failed to load users')
        setUsers([])
        return
      }
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : data.users || [])
    } catch {
      setUserError('Failed to load users')
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchExistingBalance = useCallback(async (userId: string, yr: number) => {
    setBalanceError(null)
    try {
      const res = await fetch(`/api/admin/historical-balances?userId=${userId}&year=${yr}`)
      if (!res.ok) {
        setBalanceError('Failed to load existing balance')
        setExistingBalance(null)
        return
      }
      const data = await res.json()
      if (data.balances?.length > 0) {
        setExistingBalance(data.balances[0])
      } else {
        setExistingBalance(null)
      }
    } catch {
      setBalanceError('Failed to load existing balance')
      setExistingBalance(null)
    }
  }, [])

  const handleSelectUser = (user: User) => {
    setSelectedUser(user)
    setResult(null)
    setEntitled('')
    setUsed('')
    setCarriedForward('')
    fetchExistingBalance(user.id, year)
  }

  const handleYearChange = (yr: number) => {
    setYear(yr)
    setResult(null)
    setEntitled('')
    setUsed('')
    setCarriedForward('')
    if (selectedUser) {
      fetchExistingBalance(selectedUser.id, yr)
    }
  }

  const handleSave = async () => {
    if (!selectedUser) return
    const entitledNum = parseFloat(entitled)
    const usedNum = parseFloat(used)

    if (isNaN(entitledNum) || entitledNum < 0) { setResult({ success: false, message: 'Invalid entitled days' }); return }
    if (isNaN(usedNum) || usedNum < 0) { setResult({ success: false, message: 'Invalid used days' }); return }

    const carriedForwardNum = carriedForward ? parseFloat(carriedForward) : undefined
    if (carriedForwardNum !== undefined && (isNaN(carriedForwardNum) || carriedForwardNum < 0)) {
      setResult({ success: false, message: 'Invalid carried forward days' }); return
    }

    setSaving(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/historical-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          userId: selectedUser.id,
          year,
          entitled: entitledNum,
          used: usedNum,
          ...(carriedForwardNum !== undefined && { carriedForward: carriedForwardNum }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setResult({ success: true, message: `Balance saved: ${data.created} created, ${data.updated} updated` })
      fetchExistingBalance(selectedUser.id, year)
    } catch (err: any) {
      setResult({ success: false, message: err.message })
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter(u => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      (u.firstName || '').toLowerCase().includes(term) ||
      (u.lastName || '').toLowerCase().includes(term) ||
      (u.employeeId || '').toLowerCase().includes(term) ||
      (u.department || '').toLowerCase().includes(term)
    )
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Entry</CardTitle>
        <CardDescription>
          Add or update historical Normal Leave balance for a specific user and year.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: User Selection */}
          <div className="space-y-3">
            <Label>Select User</Label>
            <Input
              placeholder="Search by name, employee ID, or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="border rounded-lg max-h-48 overflow-auto">
              {userError ? (
                <div className="p-4 text-center text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />{userError}
                </div>
              ) : loadingUsers ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No users found</div>
              ) : (
                filteredUsers.slice(0, 50).map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 ${
                      selectedUser?.id === user.id ? 'bg-blue-50 dark:bg-blue-950' : ''
                    }`}
                  >
                    <div className="font-medium">{user.firstName} {user.lastName}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.employeeId} - {user.department}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: Balance Input */}
          <div className="space-y-3">
            {selectedUser ? (
              <>
                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 mb-2">
                  <p className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.employeeId} - {selectedUser.department}</p>
                </div>

                <div>
                  <Label>Year</Label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 3 + i).map((yr) => (
                      <Button
                        key={yr}
                        variant={year === yr ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleYearChange(yr)}
                      >
                        {yr}
                      </Button>
                    ))}
                  </div>
                </div>

                {balanceError && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm">
                    <p className="text-red-800 dark:text-red-200">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />{balanceError}
                    </p>
                  </div>
                )}

                {existingBalance && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">Existing balance for {year}:</p>
                    <p>Entitled: {existingBalance.entitled} | Used: {existingBalance.used} | Carried Forward: {existingBalance.carriedForward}</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Saving will overwrite this balance.</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="entitled">Entitled Days</Label>
                    <Input
                      id="entitled"
                      type="number"
                      min="0"
                      step="0.5"
                      value={entitled}
                      onChange={(e) => setEntitled(e.target.value)}
                      placeholder="e.g. 21"
                    />
                  </div>
                  <div>
                    <Label htmlFor="used">Used Days</Label>
                    <Input
                      id="used"
                      type="number"
                      min="0"
                      step="0.5"
                      value={used}
                      onChange={(e) => setUsed(e.target.value)}
                      placeholder="e.g. 15"
                    />
                  </div>
                  <div>
                    <Label htmlFor="carriedForward">Carried Forward</Label>
                    <Input
                      id="carriedForward"
                      type="number"
                      min="0"
                      step="0.5"
                      value={carriedForward}
                      onChange={(e) => setCarriedForward(e.target.value)}
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>

                {entitled && used && (
                  <p className="text-sm text-muted-foreground">
                    Unused: {Math.max(0, parseFloat(entitled || '0') + parseFloat(carriedForward || '0') - parseFloat(used || '0'))} days
                    {carriedForward && ` (incl. ${carriedForward} carried forward)`}
                  </p>
                )}

                <Button onClick={handleSave} disabled={saving || !entitled || !used} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Balance
                </Button>

                {result && (
                  <div className={`rounded-lg p-3 text-sm ${
                    result.success
                      ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                      : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'
                  }`}>
                    {result.message}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Select a user from the list to enter their historical balance.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Chain Carry-Forward Tab
// ============================================================

function ChainCarryForwardTab() {
  const currentYear = new Date().getFullYear()
  const [startYear, setStartYear] = useState(currentYear - 3)
  const [endYear, setEndYear] = useState(currentYear - 1)
  const [preview, setPreview] = useState<ChainResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [executeResult, setExecuteResult] = useState<ChainResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  const handlePreview = async () => {
    setLoading(true)
    setError(null)
    setExecuteResult(null)

    try {
      const res = await fetch(`/api/admin/historical-balances/chain-rollover?startYear=${startYear}&endYear=${endYear}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to preview')
      setPreview(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    setShowConfirm(false)
    setExecuting(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/historical-balances/chain-rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startYear, endYear }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to execute')
      setExecuteResult(data)
      setPreview(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setExecuting(false)
    }
  }

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const data = executeResult || preview

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Chain Carry-Forward ({startYear} &rarr; ... &rarr; {endYear} &rarr; {endYear + 1})
        </CardTitle>
        <CardDescription>
          Compute and apply carry-forward amounts across years. Only Normal Leave (NL) with carryForward=true is processed.
          The max carry-forward cap from the leave type configuration is applied at each step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <Label className="text-sm">Start Year</Label>
            <Input
              type="number"
              value={startYear}
              onChange={(e) => { setStartYear(parseInt(e.target.value) || currentYear - 3); setPreview(null); setExecuteResult(null) }}
              className="w-24 mt-1"
              min={2020}
              max={endYear}
            />
          </div>
          <div>
            <Label className="text-sm">End Year</Label>
            <Input
              type="number"
              value={endYear}
              onChange={(e) => { setEndYear(parseInt(e.target.value) || currentYear - 1); setPreview(null); setExecuteResult(null) }}
              className="w-24 mt-1"
              min={startYear}
              max={currentYear}
            />
          </div>
          <Button onClick={handlePreview} disabled={loading} variant="outline">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Preview Chain Rollover
          </Button>
          {preview && (
            <Button onClick={() => setShowConfirm(true)} disabled={executing}>
              {executing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Execute Chain Rollover
            </Button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
            </div>
          </div>
        )}

        {executeResult && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-200">Chain rollover executed successfully</span>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{data.summary.totalUsers}</div>
                <div className="text-sm text-muted-foreground">Users Processed</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {data.summary.totalCarriedForward}
                </div>
                <div className="text-sm text-muted-foreground">Total Days Carried Forward</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {data.summary.totalLost}
                </div>
                <div className="text-sm text-muted-foreground">Total Days Lost (Over Cap)</div>
              </div>
            </div>

            {/* Per-user details */}
            <div className="border rounded-lg divide-y">
              {data.users.map((user) => {
                const isExpanded = expandedUsers.has(user.userId)
                return (
                  <div key={user.userId}>
                    <button
                      onClick={() => toggleUser(user.userId)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <span className="font-medium">{user.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({user.employeeId})</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {user.years.filter(y => y.carryToNext > 0).map(y => (
                          <Badge key={y.year} variant="secondary" className="text-xs">
                            {y.year}: +{y.carryToNext}d
                          </Badge>
                        ))}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-1 px-2">Year</th>
                              <th className="text-right py-1 px-2">Entitled</th>
                              <th className="text-right py-1 px-2">Carried In</th>
                              <th className="text-right py-1 px-2">Used</th>
                              <th className="text-right py-1 px-2">Unused</th>
                              <th className="text-right py-1 px-2">Carry Out</th>
                              <th className="text-right py-1 px-2">Lost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {user.years.map((yr) => (
                              <tr key={yr.year} className="border-t">
                                <td className="py-1.5 px-2 font-medium">{yr.year}</td>
                                <td className="text-right py-1.5 px-2">{yr.entitled}</td>
                                <td className="text-right py-1.5 px-2">
                                  {yr.carriedForward > 0 ? (
                                    <span className="text-blue-600 dark:text-blue-400">+{yr.carriedForward}</span>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </td>
                                <td className="text-right py-1.5 px-2">{yr.used}</td>
                                <td className="text-right py-1.5 px-2">{yr.unused}</td>
                                <td className="text-right py-1.5 px-2">
                                  {yr.carryToNext > 0 ? (
                                    <span className="text-green-600 dark:text-green-400 font-medium">{yr.carryToNext}</span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                                <td className="text-right py-1.5 px-2">
                                  {yr.lost > 0 ? (
                                    <span className="text-orange-600 dark:text-orange-400">{yr.lost}</span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}

              {data.users.length === 0 && (
                <div className="p-6 text-center text-muted-foreground">
                  No users with historical NL balances found. Import historical balances first.
                </div>
              )}
            </div>
          </>
        )}

        {/* Confirmation dialog */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Execute Chain Rollover?</AlertDialogTitle>
              <AlertDialogDescription>
                This will update carry-forward amounts for all users across {startYear}&rarr;...&rarr;{endYear}&rarr;{endYear + 1}.
                Existing carry-forward values will be overwritten with the computed chain amounts.
                This action is logged but cannot be automatically undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleExecute}>
                Execute Chain Rollover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
