import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year') || new Date().getFullYear().toString()
    const upcoming = searchParams.get('upcoming') === 'true'
    
    // Validate year parameter
    const yearNumber = parseInt(yearParam, 10)
    if (isNaN(yearNumber) || yearNumber < 1900 || yearNumber > 2100) {
      return NextResponse.json(
        { error: 'Invalid year parameter. Must be between 1900 and 2100.' },
        { status: 400 }
      )
    }
    
    let whereClause: any = { isActive: true }
    
    if (upcoming) {
      whereClause.date = {
        gte: new Date()
      }
    } else {
      // Use validated year number instead of direct string interpolation
      const startOfYear = new Date(yearNumber, 0, 1) // January 1st
      const endOfYear = new Date(yearNumber, 11, 31) // December 31st
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