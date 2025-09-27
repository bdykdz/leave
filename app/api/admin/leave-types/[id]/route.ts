import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Update request body:', JSON.stringify(body, null, 2))
    
    const {
      name,
      code,
      daysAllowed,
      carryForward,
      maxCarryForward,
      requiresApproval,
      requiresDocument,
      description,
      isSpecialLeave,
      requiresHRVerification,
      documentTypes,
      isActive,
      maxDaysPerRequest,
    } = body

    // Build update data only with provided fields
    const updateData: any = {}
    
    if (name !== undefined) updateData.name = name
    if (code !== undefined) updateData.code = code
    if (daysAllowed !== undefined) updateData.daysAllowed = parseInt(daysAllowed)
    if (carryForward !== undefined) updateData.carryForward = carryForward
    if (carryForward !== undefined) {
      updateData.maxCarryForward = carryForward ? (maxCarryForward !== undefined ? parseInt(maxCarryForward) || 0 : 0) : null
    }
    if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval
    if (requiresDocument !== undefined) updateData.requiresDocument = requiresDocument
    if (description !== undefined) updateData.description = description || null
    if (isSpecialLeave !== undefined) {
      updateData.isSpecialLeave = isSpecialLeave
      updateData.requiresHRVerification = isSpecialLeave ? true : (requiresHRVerification || false)
    } else if (requiresHRVerification !== undefined) {
      updateData.requiresHRVerification = requiresHRVerification
    }
    if (documentTypes !== undefined) updateData.documentTypes = documentTypes
    if (isActive !== undefined) updateData.isActive = isActive
    if (maxDaysPerRequest !== undefined) {
      updateData.maxDaysPerRequest = maxDaysPerRequest ? parseInt(maxDaysPerRequest) : null
    }
    
    console.log('Update data:', JSON.stringify(updateData, null, 2))
    
    // Use transaction for consistency
    const result = await prisma.$transaction(async (tx) => {
      // Check if leave type exists
      const existing = await tx.leaveType.findUnique({
        where: { id: params.id },
      })

      if (!existing) {
        throw new Error('Leave type not found')
      }

      // Check for code conflicts if code is being changed
      if (code && code !== existing.code) {
        const codeExists = await tx.leaveType.findUnique({
          where: { code },
        })

        if (codeExists) {
          throw new Error('Another leave type with this code already exists')
        }
      }
      
      const leaveType = await tx.leaveType.update({
        where: { id: params.id },
        data: updateData,
      })

      // Update leave balances if days allowed changed
      if (daysAllowed !== undefined && parseInt(daysAllowed) !== existing.daysAllowed) {
        const currentYear = new Date().getFullYear()
        const newDaysAllowed = parseInt(daysAllowed)
        
        console.log('Updating leave balances:', { oldDays: existing.daysAllowed, newDays: newDaysAllowed })
        
        // Get all leave balances for this type
        const balances = await tx.leaveBalance.findMany({
          where: {
            leaveTypeId: params.id,
            year: currentYear,
          },
        })

        // Update each balance individually to ensure available doesn't go negative
        for (const balance of balances) {
          const newAvailable = newDaysAllowed - balance.used - balance.pending
          
          console.log(`Updating balance for user ${balance.userId}:`, {
            old: { entitled: balance.entitled, available: balance.available },
            new: { entitled: newDaysAllowed, available: Math.max(0, newAvailable) }
          })
          
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              entitled: parseFloat(newDaysAllowed.toString()),
              available: parseFloat(Math.max(0, newAvailable).toString()), // Ensure available is never negative
            },
          })
        }
      }
      
      return leaveType
    })

    return NextResponse.json({ leaveType: result })
  } catch (error) {
    console.error('Failed to update leave type:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json(
      { error: 'Failed to update leave type', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if leave type is being used
    const requestCount = await prisma.leaveRequest.count({
      where: { leaveTypeId: params.id },
    })

    if (requestCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete leave type that has been used in requests' },
        { status: 400 }
      )
    }

    // Delete related leave balances first
    await prisma.leaveBalance.deleteMany({
      where: { leaveTypeId: params.id },
    })

    // Delete leave type
    await prisma.leaveType.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete leave type:', error)
    return NextResponse.json(
      { error: 'Failed to delete leave type' },
      { status: 500 }
    )
  }
}