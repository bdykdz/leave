import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentYear = new Date().getFullYear()
    
    // Get all active users
    const users = await prisma.user.findMany({
      where: { isActive: true }
    })

    // Get all leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true }
    })

    let balancesCreated = 0
    let balancesSkipped = 0

    // For each user, create leave balances if they don't exist
    for (const user of users) {
      for (const leaveType of leaveTypes) {
        // Check if balance already exists
        const existingBalance = await prisma.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: user.id,
              leaveTypeId: leaveType.id,
              year: currentYear
            }
          }
        })

        if (!existingBalance) {
          // Create balance based on leave type
          let entitled = 0
          
          // Set default entitlements based on leave type code
          if (leaveType.code === 'ANNUAL' || leaveType.code === 'AL' || leaveType.code === 'NL') {
            entitled = leaveType.daysAllowed || 21 // Default annual leave
          } else if (leaveType.code === 'SICK' || leaveType.code === 'SL') {
            entitled = 0 // Sick leave is unlimited (tracked only)
          } else {
            entitled = 0 // Special leaves are as-needed
          }

          await prisma.leaveBalance.create({
            data: {
              userId: user.id,
              leaveTypeId: leaveType.id,
              year: currentYear,
              entitled: entitled,
              used: 0,
              pending: 0,
              available: entitled,
              carriedForward: 0
            }
          })
          
          balancesCreated++
        } else {
          balancesSkipped++
        }
      }
    }

    console.log(`Leave balance initialization complete: ${balancesCreated} created, ${balancesSkipped} skipped`)

    return NextResponse.json({
      success: true,
      message: `Initialized ${balancesCreated} leave balances for ${users.length} users`,
      details: {
        usersProcessed: users.length,
        balancesCreated,
        balancesSkipped,
        year: currentYear
      }
    })
  } catch (error) {
    console.error('Error initializing leave balances:', error)
    return NextResponse.json(
      { error: 'Failed to initialize leave balances' },
      { status: 500 }
    )
  }
}