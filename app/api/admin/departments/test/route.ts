import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test database connection
    const count = await prisma.department.count()
    const departments = await prisma.department.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({
      success: true,
      count,
      departments,
      database: 'connected'
    })
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      database: 'error'
    }, { status: 500 })
  }
}