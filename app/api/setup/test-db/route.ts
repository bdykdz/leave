import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Simple count query
    const userCount = await prisma.user.count()
    
    return NextResponse.json({
      success: true,
      userCount,
      message: `Database connected. Found ${userCount} users.`
    })
  } catch (error: any) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      details: error.toString()
    }, { status: 500 })
  }
}