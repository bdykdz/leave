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
    const departments = await prisma.department.findMany({
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    console.log(`Fetched ${departments.length} departments from database`)
    
    // Log the first few departments for debugging
    if (departments.length > 0) {
      console.log('Sample departments:', departments.slice(0, 3).map(d => ({ id: d.id, name: d.name, code: d.code })))
    }

    return NextResponse.json(departments)
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch departments: ' + (error instanceof Error ? error.message : 'Unknown error') },
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
    const body = await request.json()
    const { name, code, description } = body
    
    console.log('Creating department with data:', { name, code, description })

    // Validate required fields
    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Check if department already exists
    const existing = await prisma.department.findFirst({
      where: {
        OR: [
          { name },
          { code }
        ]
      }
    })

    if (existing) {
      console.log('Department already exists:', existing)
      return NextResponse.json(
        { error: 'Department with this name or code already exists' },
        { status: 400 }
      )
    }

    // Get max order
    const maxOrder = await prisma.department.aggregate({
      _max: { order: true }
    })

    const department = await prisma.department.create({
      data: {
        name,
        code,
        description: description || null,
        order: (maxOrder._max.order || 0) + 1
      }
    })

    console.log('Department created successfully:', department)

    // Verify the department was saved
    const saved = await prisma.department.findUnique({
      where: { id: department.id }
    })
    
    if (!saved) {
      console.error('Department was not saved properly')
      return NextResponse.json(
        { error: 'Failed to save department' },
        { status: 500 }
      )
    }

    return NextResponse.json(saved)
  } catch (error) {
    console.error('Error creating department:', error)
    return NextResponse.json(
      { error: 'Failed to create department: ' + (error instanceof Error ? error.message : 'Unknown error') },
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
    const body = await request.json()
    const { id, name, code, description, isActive } = body
    
    console.log('Updating department with data:', body)

    if (!id) {
      return NextResponse.json(
        { error: 'Department ID is required for update' },
        { status: 400 }
      )
    }

    // Check if another department has same name or code
    const existing = await prisma.department.findFirst({
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
        { error: 'Another department with this name or code already exists' },
        { status: 400 }
      )
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name,
        code,
        description: description || null,
        isActive
      }
    })

    console.log('Department updated successfully:', department)
    return NextResponse.json(department)
  } catch (error) {
    console.error('Error updating department:', error)
    return NextResponse.json(
      { error: 'Failed to update department: ' + (error instanceof Error ? error.message : 'Unknown error') },
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
        { error: 'Department ID is required' },
        { status: 400 }
      )
    }

    // Check if any users belong to this department
    const usersCount = await prisma.user.count({
      where: { department: { equals: (await prisma.department.findUnique({ where: { id } }))?.name } }
    })

    if (usersCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete department. ${usersCount} users are assigned to this department.` },
        { status: 400 }
      )
    }

    await prisma.department.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting department:', error)
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    )
  }
}