import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if any users are assigned to this position
    const position = await prisma.position.findUnique({
      where: { id: params.id }
    })

    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    const usersWithPosition = await prisma.user.count({
      where: {
        position: position.name
      }
    })

    if (usersWithPosition > 0) {
      return NextResponse.json(
        { error: 'Cannot delete position with assigned users' },
        { status: 400 }
      )
    }

    // Delete the position
    await prisma.position.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting position:', error)
    return NextResponse.json(
      { error: 'Failed to delete position' },
      { status: 500 }
    )
  }
}