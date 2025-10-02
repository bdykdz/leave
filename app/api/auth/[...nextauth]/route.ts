import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import { prisma } from "@/lib/prisma"
import { NextAuthOptions } from "next-auth"
import { Role } from "@prisma/client"

export const authOptions: NextAuthOptions = {
  // Remove adapter when using JWT strategy - they don't work together
  session: {
    strategy: "jwt"
  },
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: "openid email profile User.Read offline_access",
          prompt: "select_account"
        }
      },
      httpOptions: {
        timeout: 10000
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture || null // Azure AD sometimes provides picture in the profile
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('Sign in attempt:', { 
        provider: account?.provider,
        email: user?.email,
        hasProfile: !!profile 
      })
      
      if (account?.provider === "azure-ad") {
        try {
          if (!user.email) {
            console.error('No email provided by Azure AD')
            return false
          }

          // Check if user exists in our database
          console.log(`Looking for user with email: ${user.email.toLowerCase()}`)
          
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() }
          })

          if (existingUser) {
            console.log(`Found user: ${existingUser.email} with role: ${existingUser.role}`)
            
            // Update user info from Azure AD if available
            const updates: any = {}
            const azureProfile = profile as any
            if (azureProfile?.given_name && azureProfile.given_name !== existingUser.firstName) {
              updates.firstName = azureProfile.given_name
            }
            if (azureProfile?.family_name && azureProfile.family_name !== existingUser.lastName) {
              updates.lastName = azureProfile.family_name
            }
            
            if (Object.keys(updates).length > 0) {
              await prisma.user.update({
                where: { email: user.email.toLowerCase() },
                data: updates
              })
              console.log('Updated user profile from Azure AD')
            }
            
            return true
          } else {
            // User not in database - reject login
            console.log(`User ${user.email} not found in database`)
            
            // List all users in database for debugging
            const allUsers = await prisma.user.findMany({
              select: { email: true }
            })
            console.log('Users in database:', allUsers.map(u => u.email))
            
            return '/login?error=AccessDenied'
          }
        } catch (error) {
          console.error("Error during sign in:", error)
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "azure-ad" && user?.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              department: true
            }
          })

          if (dbUser) {
            token.id = dbUser.id
            token.email = dbUser.email
            token.name = `${dbUser.firstName} ${dbUser.lastName}`
            token.role = dbUser.role
            token.department = dbUser.department
            token.firstName = dbUser.firstName
            token.lastName = dbUser.lastName
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.department = token.department as string
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  debug: process.env.NODE_ENV === "development"
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }