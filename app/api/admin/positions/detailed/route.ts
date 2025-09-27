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

    // For each position, get users
    const positionsWithUsers = await Promise.all(
      positions.map(async (pos) => {
        const users = await prisma.user.findMany({
          where: {
            position: pos.name
          },
          select: {
            id: true
          }
        })

        return {
          ...pos,
          users
        }
      })
    )

    return NextResponse.json({ positions: positionsWithUsers })
  } catch (error) {
    console.error('Error fetching positions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    )
  }
}