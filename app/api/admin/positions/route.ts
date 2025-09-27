import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const positions = await prisma.position.findMany({
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(positions)
  } catch (error) {
    console.error('Error fetching positions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, code, description } = await request.json()

    // Check if position already exists
    const existing = await prisma.position.findFirst({
      where: {
        OR: [
          { name },
          { code }
        ]
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Position with this name or code already exists' },
        { status: 400 }
      )
    }

    // Get max order
    const maxOrder = await prisma.position.aggregate({
      _max: { order: true }
    })

    const position = await prisma.position.create({
      data: {
        name,
        code,
        description,
        order: (maxOrder._max.order || 0) + 1
      }
    })

    return NextResponse.json(position)
  } catch (error) {
    console.error('Error creating position:', error)
    return NextResponse.json(
      { error: 'Failed to create position' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id, name, code, description, isActive } = await request.json()

    // Check if another position has same name or code
    const existing = await prisma.position.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [
              { name },
              { code }
            ]
          }
        ]
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Another position with this name or code already exists' },
        { status: 400 }
      )
    }

    const position = await prisma.position.update({
      where: { id },
      data: {
        name,
        code,
        description,
        isActive
      }
    })

    return NextResponse.json(position)
  } catch (error) {
    console.error('Error updating position:', error)
    return NextResponse.json(
      { error: 'Failed to update position' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Position ID is required' },
        { status: 400 }
      )
    }

    // Check if any users have this position
    const usersCount = await prisma.user.count({
      where: { position: { equals: (await prisma.position.findUnique({ where: { id } }))?.name } }
    })

    if (usersCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete position. ${usersCount} users have this position.` },
        { status: 400 }
      )
    }

    await prisma.position.delete({
      where: { id }
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