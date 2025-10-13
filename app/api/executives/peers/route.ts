import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active executives except the current user
    const executives = await prisma.user.findMany({
      where: {
        role: "EXECUTIVE",
        isActive: true,
        id: {
          not: session.user.id  // Exclude current user
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        position: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });

    // Format the response
    const formattedExecutives = executives.map(exec => ({
      id: exec.id,
      name: `${exec.firstName} ${exec.lastName}`,
      email: exec.email,
      department: exec.department || 'Executive',
      position: exec.position || 'Executive',
    }));

    return NextResponse.json({ 
      executives: formattedExecutives,
      count: formattedExecutives.length 
    });
  } catch (error) {
    console.error("Error fetching executive peers:", error);
    return NextResponse.json(
      { error: "Failed to fetch executive peers" },
      { status: 500 }
    );
  }
}