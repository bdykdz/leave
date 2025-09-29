import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { holidayId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const holiday = await prisma.holiday.findUnique({
      where: { id: params.holidayId }
    })

    if (!holiday) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
    }

    return NextResponse.json({ holiday })
  } catch (error) {
    console.error('Get holiday error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch holiday' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { holidayId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, date, description, isRecurring, country, isActive } = await request.json()

    const holiday = await prisma.holiday.update({
      where: { id: params.holidayId },
      data: {
        name,
        date: date ? new Date(date) : undefined,
        description,
        isRecurring,
        country,
        isActive
      }
    })

    return NextResponse.json({ holiday })
  } catch (error) {
    console.error('Update holiday error:', error)
    return NextResponse.json(
      { error: 'Failed to update holiday' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { holidayId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.holiday.delete({
      where: { id: params.holidayId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete holiday error:', error)
    return NextResponse.json(
      { error: 'Failed to delete holiday' },
      { status: 500 }
    )
  }
}