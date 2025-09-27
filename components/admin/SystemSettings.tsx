"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { 
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle,
  Users,
  RefreshCw,
  Database,
} from "lucide-react"

export function SystemSettings() {
  const [initializingBalances, setInitializingBalances] = useState(false)
  const [balanceStats, setBalanceStats] = useState<any>(null)

  const handleInitializeBalances = async () => {
    if (!confirm("This will create leave balances for all users who don't have them. Continue?")) {
      return
    }

    setInitializingBalances(true)
    try {
      const response = await fetch("/api/admin/initialize-leave-balances", {
        method: "POST",
      })

      if (response.ok) {
        const data = await response.json()
        setBalanceStats(data.details)
        toast.success(data.message)
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to initialize leave balances")
      }
    } catch (error) {
      console.error("Error initializing balances:", error)
      toast.error("Failed to initialize leave balances")
    } finally {
      setInitializingBalances(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground">
          Manage system-wide settings and perform administrative actions
        </p>
      </div>

      {/* Leave Balance Initialization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Leave Balance Management
          </CardTitle>
          <CardDescription>
            Initialize or reset leave balances for all users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              This will create leave balances for the current year for all active users who don't already have them.
              Leave types will be assigned based on the configured defaults.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleInitializeBalances}
              disabled={initializingBalances}
              className="flex items-center gap-2"
            >
              {initializingBalances ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  Initialize Leave Balances
                </>
              )}
            </Button>
          </div>

          {balanceStats && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Initialization Complete</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  <p>Year: {balanceStats.year}</p>
                  <p>Users Processed: {balanceStats.usersProcessed}</p>
                  <p>Balances Created: {balanceStats.balancesCreated}</p>
                  <p>Balances Skipped (already exist): {balanceStats.balancesSkipped}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* More settings sections can be added here */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management Tools
          </CardTitle>
          <CardDescription>
            Bulk operations for user management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Additional user management tools coming soon...
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Data Synchronization
          </CardTitle>
          <CardDescription>
            Sync data with external systems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Microsoft 365 sync and other integrations coming soon...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}