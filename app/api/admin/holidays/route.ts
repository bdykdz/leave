import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'HR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const upcoming = searchParams.get('upcoming') === 'true'
    
    let whereClause: any = { isActive: true }
    
    if (year) {
      const startOfYear = new Date(`${year}-01-01`)
      const endOfYear = new Date(`${year}-12-31`)
      whereClause.date = {
        gte: startOfYear,
        lte: endOfYear
      }
    } else if (upcoming) {
      whereClause.date = {
        gte: new Date()
      }
    }

    const holidays = await prisma.holiday.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    })

    return NextResponse.json({ holidays })
  } catch (error) {
    console.error('Get holidays error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch holidays' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { nameEn, nameRo, date, description, isRecurring, country } = await request.json()

    if (!nameEn || !nameRo || !date) {
      return NextResponse.json(
        { error: 'English name, Romanian name, and date are required' },
        { status: 400 }
      )
    }

    const holiday = await prisma.holiday.create({
      data: {
        nameEn,
        nameRo,
        date: new Date(date),
        description,
        isRecurring: isRecurring || false,
        country: country || 'RO',
        createdBy: session.user.id
      }
    })

    return NextResponse.json({ holiday }, { status: 201 })
  } catch (error) {
    console.error('Create holiday error:', error)
    return NextResponse.json(
      { error: 'Failed to create holiday' },
      { status: 500 }
    )
  }
}