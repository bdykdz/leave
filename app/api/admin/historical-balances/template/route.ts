import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user?.id },
      select: { role: true }
    })

    if (!currentUser || !['HR', 'ADMIN', 'EXECUTIVE'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const csvContent = [
      'employeeId,year,entitled,used',
      'EMP001,2023,21,15',
      'EMP001,2024,21,18',
      'EMP001,2025,21,10',
      'EMP002,2023,21,20',
      'EMP002,2024,21,14',
      'EMP002,2025,21,12',
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="historical-balance-template.csv"',
      },
    })
  } catch (error) {
    console.error('Error generating template:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
