import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../[...nextauth]/route'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    return NextResponse.json({
      authenticated: !!session,
      session: session,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}