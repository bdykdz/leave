const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function updatePlanningWindows() {
  console.log('🔄 Updating planning windows...')
  
  const now = new Date()
  const currentYear = now.getFullYear()
  const nextYear = currentYear + 1
  const currentMonth = now.getMonth()
  
  console.log(`Current date: ${now.toISOString()}`)
  console.log(`Current month: ${currentMonth} (November = 10)`)
  console.log(`Current year: ${currentYear}, Planning year: ${nextYear}`)
  
  // Update next year's planning window based on current date
  let stage = 'CLOSED'
  let isActive = false
  
  if (currentMonth >= 9 && currentMonth <= 11) { // October-December (months 9, 10, 11)
    stage = 'DRAFT' // Use DRAFT as "OPEN" status
    isActive = true
    console.log('✅ Setting planning window to OPEN (DRAFT)')
  } else {
    console.log('❌ Setting planning window to CLOSED')
  }
  
  try {
    // Update or create the planning window for next year
    const window = await prisma.holidayPlanningWindow.upsert({
      where: { year: nextYear },
      update: {
        stage,
        isActive,
        updatedAt: now
      },
      create: {
        year: nextYear,
        openDate: new Date(currentYear, 9, 1), // October 1st current year
        closeDate: new Date(currentYear, 11, 31), // December 31st current year
        stage,
        isActive
      }
    })
    
    console.log(`✅ Updated planning window for ${nextYear}:`, {
      id: window.id,
      year: window.year,
      stage: window.stage,
      isActive: window.isActive
    })
    
    // Also update current year to LOCKED if it exists
    const currentWindow = await prisma.holidayPlanningWindow.findUnique({
      where: { year: currentYear }
    })
    
    if (currentWindow) {
      await prisma.holidayPlanningWindow.update({
        where: { year: currentYear },
        data: {
          stage: 'LOCKED',
          isActive: false,
          updatedAt: now
        }
      })
      console.log(`✅ Locked planning window for ${currentYear}`)
    }
    
  } catch (error) {
    console.error('❌ Error updating planning windows:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updatePlanningWindows()