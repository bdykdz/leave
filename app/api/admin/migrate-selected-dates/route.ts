import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow ADMIN role to run migrations
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    console.log(`🔄 Starting selectedDates migration by admin: ${session.user.email}`);

    // Find all leave requests that have selectedDates in supportingDocuments but not in the direct field
    const requestsToMigrate = await prisma.leaveRequest.findMany({
      where: {
        AND: [
          {
            supportingDocuments: {
              path: ['selectedDates'],
              not: null
            }
          },
          {
            OR: [
              { selectedDates: { isEmpty: true } },
              { selectedDates: null }
            ]
          }
        ]
      },
      select: {
        id: true,
        supportingDocuments: true,
        startDate: true,
        endDate: true,
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    console.log(`Found ${requestsToMigrate.length} requests to migrate`);

    let migratedCount = 0;
    let failedCount = 0;
    const failedRequests: string[] = [];

    for (const request of requestsToMigrate) {
      try {
        const supportingDocs = request.supportingDocuments as any;
        const selectedDatesFromJson = supportingDocs?.selectedDates;

        if (selectedDatesFromJson && Array.isArray(selectedDatesFromJson)) {
          // Convert string dates to Date objects
          const selectedDates = selectedDatesFromJson.map((dateStr: string) => new Date(dateStr));

          await prisma.leaveRequest.update({
            where: { id: request.id },
            data: {
              selectedDates: selectedDates
            }
          });

          console.log(`✅ Migrated request ${request.id} for ${request.user.firstName} ${request.user.lastName}: ${selectedDatesFromJson.length} dates`);
          migratedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to migrate request ${request.id}:`, error);
        failedCount++;
        failedRequests.push(request.id);
      }
    }

    const result = {
      success: true,
      message: `Migration completed: ${migratedCount} requests migrated, ${failedCount} failed`,
      statistics: {
        totalFound: requestsToMigrate.length,
        migrated: migratedCount,
        failed: failedCount,
        failedRequests
      },
      performedBy: session.user.email,
      timestamp: new Date().toISOString()
    };

    console.log('🎉 Migration completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error during selectedDates migration:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during migration', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// GET endpoint to check what would be migrated (dry run)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count requests that need migration
    const requestsToMigrate = await prisma.leaveRequest.findMany({
      where: {
        AND: [
          {
            supportingDocuments: {
              path: ['selectedDates'],
              not: null
            }
          },
          {
            OR: [
              { selectedDates: { isEmpty: true } },
              { selectedDates: null }
            ]
          }
        ]
      },
      select: {
        id: true,
        supportingDocuments: true,
        startDate: true,
        endDate: true,
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Dry run - these requests would be migrated',
      count: requestsToMigrate.length,
      requests: requestsToMigrate.map(req => ({
        id: req.id,
        user: `${req.user.firstName} ${req.user.lastName}`,
        dateRange: `${req.startDate.toLocaleDateString()} - ${req.endDate.toLocaleDateString()}`,
        selectedDatesCount: (req.supportingDocuments as any)?.selectedDates?.length || 0
      }))
    });

  } catch (error) {
    console.error('Error in migration dry run:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}