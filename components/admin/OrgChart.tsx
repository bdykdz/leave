"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Building, 
  Users, 
  UserCog, 
  Shield, 
  ChevronDown,
  ChevronRight,
  User,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  Crown
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  position: string
  department: string
  role: string
  phoneNumber?: string
  joiningDate: string
  profileImage?: string
  managerId?: string
  manager?: Employee
  subordinates?: Employee[]
  departmentDirectorId?: string
}

interface Department {
  id: string
  name: string
  code: string
  description?: string
  director?: Employee
  managers: Employee[]
  employees: Employee[]
  employeeCount: number
  _count?: { users: number }
}

interface OrgNode {
  employee: Employee
  children: OrgNode[]
}

export function OrgChart() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [executives, setExecutives] = useState<Employee[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"tree" | "department">("tree")

  useEffect(() => {
    fetchOrgData()
  }, [])

  const fetchOrgData = async () => {
    try {
      setLoading(true)
      
      // Fetch all users with full details
      const usersResponse = await fetch('/api/admin/users', {
        cache: 'no-store'
      })
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        console.log('Users API response:', usersData)
        
        // Ensure usersData is an array
        const employees = Array.isArray(usersData) ? usersData : []
        console.log('Processed employees:', employees.length)
        
        // Log some sample data to debug
        if (employees.length > 0) {
          console.log('Sample employee data:', {
            id: employees[0].id,
            name: `${employees[0].firstName} ${employees[0].lastName}`,
            role: employees[0].role,
            managerId: employees[0].managerId,
            hasManager: !!employees[0].manager
          })
          
          // Count employees by role
          const roleCounts = employees.reduce((acc: any, emp: any) => {
            acc[emp.role] = (acc[emp.role] || 0) + 1
            return acc
          }, {})
          console.log('Employee counts by role:', roleCounts)
          
          // Count employees with managers
          const withManagers = employees.filter((e: any) => e.managerId).length
          console.log(`Employees with managers: ${withManagers}/${employees.length}`)
        }
        
        setAllEmployees(employees)
        
        // Filter executives
        const execs = employees.filter((u: any) => u.role === 'EXECUTIVE')
        console.log('Executives found:', execs.length)
        setExecutives(execs)
      } else {
        console.error('Failed to fetch users:', usersResponse.status)
        setAllEmployees([])
      }
      
      // Fetch departments with details
      const deptResponse = await fetch('/api/admin/departments/detailed', {
        cache: 'no-store'
      })
      if (deptResponse.ok) {
        const deptData = await deptResponse.json()
        const departments = Array.isArray(deptData) ? deptData : []
        setDepartments(departments)
      } else {
        console.error('Failed to fetch departments:', deptResponse.status)
        setDepartments([])
      }
    } catch (error) {
      console.error('Error loading organizational data:', error)
      toast.error('Failed to load organizational data')
      setAllEmployees([])
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'EXECUTIVE': return 'default'
      case 'DEPARTMENT_DIRECTOR': return 'secondary'
      case 'MANAGER': return 'outline'
      case 'HR': return 'default'
      case 'ADMIN': return 'destructive'
      default: return 'outline'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'EXECUTIVE': return <Crown className="h-4 w-4" />
      case 'DEPARTMENT_DIRECTOR': return <Building className="h-4 w-4" />
      case 'MANAGER': return <UserCog className="h-4 w-4" />
      case 'HR': return <Users className="h-4 w-4" />
      case 'ADMIN': return <Shield className="h-4 w-4" />
      default: return <User className="h-4 w-4" />
    }
  }

  // Build organizational tree
  const buildOrgTree = (): OrgNode[] => {
    // Safety check
    if (!Array.isArray(allEmployees) || allEmployees.length === 0) {
      console.log('No employees to build tree from')
      return []
    }

    console.log('Building org tree with', allEmployees.length, 'employees')

    const employeeMap = new Map<string, Employee>()
    const addedToTree = new Set<string>()
    
    allEmployees.forEach(emp => {
      if (emp && emp.id) {
        employeeMap.set(emp.id, emp)
      }
    })
    
    const nodes = new Map<string, OrgNode>()
    const rootNodes: OrgNode[] = []
    
    // Create nodes for all employees
    allEmployees.forEach(emp => {
      if (emp && emp.id) {
        nodes.set(emp.id, { employee: emp, children: [] })
      }
    })
    
    // First pass: Build tree structure based on managerId
    allEmployees.forEach(emp => {
      if (!emp || !emp.id) return
      
      const node = nodes.get(emp.id)
      if (!node) return
      
      if (emp.managerId && nodes.has(emp.managerId)) {
        // Add as child to manager
        const managerNode = nodes.get(emp.managerId)
        if (managerNode) {
          managerNode.children.push(node)
          addedToTree.add(emp.id)
        }
      }
    })
    
    // Second pass: Add all nodes that aren't children to root
    // This ensures everyone appears in the tree
    allEmployees.forEach(emp => {
      if (!emp || !emp.id) return
      if (addedToTree.has(emp.id)) return // Already in tree as someone's child
      
      const node = nodes.get(emp.id)
      if (!node) return
      
      // Add to root - prioritize executives and admins
      rootNodes.push(node)
    })
    
    console.log('Root nodes:', rootNodes.length)
    console.log('Root node roles:', rootNodes.map(n => ({
      name: `${n.employee.firstName} ${n.employee.lastName}`,
      role: n.employee.role,
      children: n.children.length
    })))
    
    // Sort children by role importance and name
    const sortNodes = (nodes: OrgNode[]) => {
      const roleOrder = ['EXECUTIVE', 'ADMIN', 'DEPARTMENT_DIRECTOR', 'HR', 'MANAGER', 'EMPLOYEE']
      nodes.sort((a, b) => {
        const roleA = a.employee.role || 'EMPLOYEE'
        const roleB = b.employee.role || 'EMPLOYEE'
        const roleCompare = roleOrder.indexOf(roleA) - roleOrder.indexOf(roleB)
        if (roleCompare !== 0) return roleCompare
        
        const nameA = `${a.employee.lastName || ''} ${a.employee.firstName || ''}`
        const nameB = `${b.employee.lastName || ''} ${b.employee.firstName || ''}`
        return nameA.localeCompare(nameB)
      })
      nodes.forEach(node => sortNodes(node.children))
    }
    
    sortNodes(rootNodes)
    return rootNodes
  }

  const TreeNode = ({ node, level = 0 }: { node: OrgNode, level?: number }) => {
    const isExpanded = expandedNodes.has(node.employee.id)
    const hasChildren = node.children.length > 0
    const employee = node.employee

    return (
      <div className={cn("relative", level > 0 && "ml-8")}>
        {/* Connection line */}
        {level > 0 && (
          <div className="absolute -left-8 top-0 w-8 h-12">
            <div className="absolute left-0 top-6 w-6 h-px bg-border" />
            <div className="absolute left-0 top-0 w-px h-6 bg-border" />
          </div>
        )}
        
        {/* Employee card */}
        <div className="mb-4">
          <div 
            className={cn(
              "border rounded-lg p-4 bg-card transition-all",
              hasChildren && "cursor-pointer hover:shadow-md",
              level === 0 && "border-primary"
            )}
            onClick={() => hasChildren && toggleNode(employee.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {hasChildren && (
                  <div className="mt-1">
                    {isExpanded ? 
                      <ChevronDown className="h-4 w-4 text-muted-foreground" /> : 
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                )}
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  {getRoleIcon(employee.role)}
                </div>
                <div>
                  <h4 className="font-semibold">
                    {employee?.firstName || ''} {employee?.lastName || ''}
                  </h4>
                  <p className="text-sm text-muted-foreground">{employee.position}</p>
                  <p className="text-xs text-muted-foreground">{employee.department}</p>
                  {level < 2 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Mail className="h-3 w-3" />
                      {employee.email}
                    </p>
                  )}
                  {hasChildren && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {node.children.length} direct report{node.children.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              {employee.role && (
                <Badge variant={getRoleBadgeVariant(employee.role)} className="text-xs">
                  {employee.role.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="relative">
            {/* Vertical line for multiple children */}
            {node.children.length > 1 && (
              <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
            )}
            {node.children.map((child, index) => (
              <div key={child.employee.id} className="relative">
                {/* Last child doesn't need the vertical line extended */}
                {index === node.children.length - 1 && node.children.length > 1 && (
                  <div className="absolute -left-8 bottom-0 w-px h-full bg-background" />
                )}
                <TreeNode node={child} level={level + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const DepartmentCard = ({ department }: { department: Department }) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {department.name}
          </CardTitle>
          <CardDescription>
            {department.code} • {department.description || 'No description'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Director */}
          <div>
            <h4 className="font-medium mb-3 text-sm text-muted-foreground">Department Director</h4>
            {department.director ? (
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {department.director?.firstName || ''} {department.director?.lastName || ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{department.director?.position || ''}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-dashed rounded-lg p-3 text-muted-foreground text-sm">
                No director assigned
              </div>
            )}
          </div>

          {/* Managers */}
          <div>
            <h4 className="font-medium mb-3 text-sm text-muted-foreground">
              Managers ({department.managers.length})
            </h4>
            {department.managers.length > 0 ? (
              <div className="space-y-2">
                {department.managers.map((manager) => (
                  <div key={manager.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <UserCog className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {manager?.firstName || ''} {manager?.lastName || ''}
                        </p>
                        <p className="text-xs text-muted-foreground">{manager?.position || ''}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed rounded-lg p-3 text-muted-foreground text-sm">
                No managers assigned
              </div>
            )}
          </div>

          {/* Total employees */}
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
            <p className="text-2xl font-bold">{department._count?.users || department.employeeCount || 0}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading organizational chart...</div>
        </CardContent>
      </Card>
    )
  }

  const orgTree = buildOrgTree()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organizational Chart</CardTitle>
          <CardDescription>
            Company structure and reporting hierarchy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="mb-6">
              <TabsTrigger value="tree">Tree View</TabsTrigger>
              <TabsTrigger value="department">Department View</TabsTrigger>
            </TabsList>

            <TabsContent value="tree" className="space-y-6">
              {orgTree.length > 0 && (
                <div className="flex justify-end mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (expandedNodes.size === 0) {
                        // Expand all
                        const allNodeIds = new Set<string>()
                        const collectIds = (nodes: OrgNode[]) => {
                          nodes.forEach(node => {
                            if (node.children.length > 0) {
                              allNodeIds.add(node.employee.id)
                            }
                            collectIds(node.children)
                          })
                        }
                        collectIds(orgTree)
                        setExpandedNodes(allNodeIds)
                      } else {
                        // Collapse all
                        setExpandedNodes(new Set())
                      }
                    }}
                  >
                    {expandedNodes.size === 0 ? 'Expand All' : 'Collapse All'}
                  </Button>
                </div>
              )}
              
              <div className="space-y-6">
                {orgTree.length > 0 ? (
                  orgTree.map(node => (
                    <TreeNode key={node.employee.id} node={node} />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No employees found in the system.</p>
                    <p className="text-sm mt-2">Import users from Microsoft 365 or add them manually.</p>
                  </div>
                )}
              </div>
              
              {/* Legend */}
              <div className="mt-8 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-3 text-sm">Role Legend</h4>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    <span className="text-sm">Executive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="text-sm">Admin</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <span className="text-sm">Department Director</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    <span className="text-sm">Manager</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">HR</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-sm">Employee</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="department" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {departments.map((dept) => (
                  <DepartmentCard key={dept.id} department={dept} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}