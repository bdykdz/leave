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

    // Get the current user with their manager details
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            department: true,
            position: true,
          }
        },
        departmentDirector: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            department: true,
            position: true,
          }
        }
      }
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine the superior based on the user's role and relationships
    let superior = null;
    let superiorType = null;
    
    if (currentUser.manager) {
      superior = currentUser.manager;
      superiorType = "Direct Manager";
    } else if (currentUser.departmentDirector) {
      superior = currentUser.departmentDirector;
      superiorType = "Department Director";
    } else {
      // If no direct manager or department director, check for HR or Executive
      // based on the user's role
      if (currentUser.role === "MANAGER" || currentUser.role === "DEPARTMENT_DIRECTOR") {
        // Find an HR director or executive
        const hrOrExecutive = await prisma.user.findFirst({
          where: {
            role: { in: ["HR", "EXECUTIVE"] },
            isActive: true
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            department: true,
            position: true,
          }
        });
        
        if (hrOrExecutive) {
          superior = hrOrExecutive;
          superiorType = hrOrExecutive.role === "HR" ? "HR Leadership" : "Executive Team";
        }
      }
    }

    // Format the response
    const response = {
      hasSuperior: superior !== null,
      superior: superior ? {
        id: superior.id,
        name: `${superior.firstName} ${superior.lastName}`,
        firstName: superior.firstName,
        lastName: superior.lastName,
        email: superior.email,
        role: superior.role,
        department: superior.department,
        position: superior.position,
        type: superiorType,
        displayTitle: getDisplayTitle(superior.role, superior.position),
        description: getDescription(superiorType, superior.role)
      } : null
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching superior:", error);
    return NextResponse.json(
      { error: "Failed to fetch superior information" },
      { status: 500 }
    );
  }
}

function getDisplayTitle(role: string, position?: string | null): string {
  if (position) {
    return position;
  }
  
  switch (role) {
    case "MANAGER":
      return "Department Manager";
    case "DEPARTMENT_DIRECTOR":
      return "Department Director";
    case "HR":
      return "HR Director";
    case "EXECUTIVE":
      return "Executive";
    default:
      return role;
  }
}

function getDescription(superiorType: string | null, role: string): string {
  if (superiorType === "Direct Manager") {
    return "Submit requests to your direct manager";
  } else if (superiorType === "Department Director") {
    return "Submit requests to your department director";
  } else if (superiorType === "HR Leadership") {
    return "Submit requests to HR leadership";
  } else if (superiorType === "Executive Team") {
    return "Submit requests to executive team";
  } else {
    return "Submit requests for approval";
  }
}