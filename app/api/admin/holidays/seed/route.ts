import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

const ROMANIAN_HOLIDAYS_2025 = [
  { nameEn: "New Year's Day", nameRo: "Anul Nou", date: "2025-01-01" },
  { nameEn: "Epiphany", nameRo: "Bobotează", date: "2025-01-06" },
  { nameEn: "Orthodox Easter", nameRo: "Paștele Ortodox", date: "2025-04-20" },
  { nameEn: "Orthodox Easter Monday", nameRo: "Lunea Paștelui", date: "2025-04-21" },
  { nameEn: "Labour Day", nameRo: "Ziua Muncii", date: "2025-05-01" },
  { nameEn: "Children's Day", nameRo: "Ziua Copilului", date: "2025-06-01" },
  { nameEn: "Orthodox Pentecost", nameRo: "Rusaliile", date: "2025-06-08" },
  { nameEn: "Orthodox Pentecost Monday", nameRo: "Lunea Rusaliilor", date: "2025-06-09" },
  { nameEn: "Assumption of Mary", nameRo: "Adormirea Maicii Domnului", date: "2025-08-15" },
  { nameEn: "St. Andrew's Day", nameRo: "Sfântul Andrei", date: "2025-11-30" },
  { nameEn: "National Day", nameRo: "Ziua Națională", date: "2025-12-01" },
  { nameEn: "Christmas Day", nameRo: "Crăciunul", date: "2025-12-25" },
  { nameEn: "Boxing Day", nameRo: "A doua zi de Crăciun", date: "2025-12-26" }
]

const ROMANIAN_HOLIDAYS_2026 = [
  { nameEn: "New Year's Day", nameRo: "Anul Nou", date: "2026-01-01" },
  { nameEn: "Epiphany", nameRo: "Bobotează", date: "2026-01-06" },
  { nameEn: "Orthodox Easter", nameRo: "Paștele Ortodox", date: "2026-04-12" },
  { nameEn: "Orthodox Easter Monday", nameRo: "Lunea Paștelui", date: "2026-04-13" },
  { nameEn: "Labour Day", nameRo: "Ziua Muncii", date: "2026-05-01" },
  { nameEn: "Children's Day", nameRo: "Ziua Copilului", date: "2026-06-01" },
  { nameEn: "Orthodox Pentecost", nameRo: "Rusaliile", date: "2026-05-31" },
  { nameEn: "Orthodox Pentecost Monday", nameRo: "Lunea Rusaliilor", date: "2026-06-01" },
  { nameEn: "Assumption of Mary", nameRo: "Adormirea Maicii Domnului", date: "2026-08-15" },
  { nameEn: "St. Andrew's Day", nameRo: "Sfântul Andrei", date: "2026-11-30" },
  { nameEn: "National Day", nameRo: "Ziua Națională", date: "2026-12-01" },
  { nameEn: "Christmas Day", nameRo: "Crăciunul", date: "2026-12-25" },
  { nameEn: "Boxing Day", nameRo: "A doua zi de Crăciun", date: "2026-12-26" }
]

const ROMANIAN_HOLIDAYS_2027 = [
  { nameEn: "New Year's Day", nameRo: "Anul Nou", date: "2027-01-01" },
  { nameEn: "Epiphany", nameRo: "Bobotează", date: "2027-01-06" },
  { nameEn: "Orthodox Easter", nameRo: "Paștele Ortodox", date: "2027-05-02" },
  { nameEn: "Orthodox Easter Monday", nameRo: "Lunea Paștelui", date: "2027-05-03" },
  { nameEn: "Labour Day", nameRo: "Ziua Muncii", date: "2027-05-01" },
  { nameEn: "Children's Day", nameRo: "Ziua Copilului", date: "2027-06-01" },
  { nameEn: "Orthodox Pentecost", nameRo: "Rusaliile", date: "2027-06-20" },
  { nameEn: "Orthodox Pentecost Monday", nameRo: "Lunea Rusaliilor", date: "2027-06-21" },
  { nameEn: "Assumption of Mary", nameRo: "Adormirea Maicii Domnului", date: "2027-08-15" },
  { nameEn: "St. Andrew's Day", nameRo: "Sfântul Andrei", date: "2027-11-30" },
  { nameEn: "National Day", nameRo: "Ziua Națională", date: "2027-12-01" },
  { nameEn: "Christmas Day", nameRo: "Crăciunul", date: "2027-12-25" },
  { nameEn: "Boxing Day", nameRo: "A doua zi de Crăciun", date: "2027-12-26" }
]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allHolidays = [...ROMANIAN_HOLIDAYS_2025, ...ROMANIAN_HOLIDAYS_2026, ...ROMANIAN_HOLIDAYS_2027]
    
    // Clear existing holidays
    await prisma.holiday.deleteMany({})
    
    // Create new holidays
    const createdHolidays = []
    for (const holiday of allHolidays) {
      const created = await prisma.holiday.create({
        data: {
          nameEn: holiday.nameEn,
          nameRo: holiday.nameRo,
          date: new Date(holiday.date),
          country: 'RO',
          isRecurring: true,
          createdBy: session.user.id
        }
      })
      createdHolidays.push(created)
    }

    return NextResponse.json({ 
      message: `Successfully seeded ${createdHolidays.length} Romanian holidays`,
      holidays: createdHolidays 
    })
  } catch (error) {
    console.error('Seed holidays error:', error)
    return NextResponse.json(
      { error: 'Failed to seed holidays' },
      { status: 500 }
    )
  }
}