import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const upcoming = searchParams.get('upcoming') === 'true'
    
    let whereClause: any = { isActive: true }
    
    if (upcoming) {
      whereClause.date = {
        gte: new Date()
      }
    } else {
      const startOfYear = new Date(`${year}-01-01`)
      const endOfYear = new Date(`${year}-12-31`)
      whereClause.date = {
        gte: startOfYear,
        lte: endOfYear
      }
    }

    const holidays = await prisma.holiday.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
      select: {
        id: true,
        nameEn: true,
        nameRo: true,
        date: true,
        description: true,
        isRecurring: true,
        country: true
      }
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