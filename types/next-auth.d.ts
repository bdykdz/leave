import { type DefaultSession, type DefaultUser } from "next-auth"
import { type Role } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: Role
      department: string
      firstName: string
      lastName: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    id: string
    role: Role
    department: string
    firstName: string
    lastName: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    department: string
    firstName: string
    lastName: string
  }
}