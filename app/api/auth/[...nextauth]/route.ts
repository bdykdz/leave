import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  // Remove adapter when using JWT strategy - they don't work together
  session: {
    strategy: "jwt"
  },
  providers: [
    // Development and UAT credentials provider
    ...(process.env.NODE_ENV === "development" || process.env.APP_ENV === "uat" || process.env.SHOW_DEV_LOGIN === "true" ? [
      CredentialsProvider({
        name: "Development Login",
        credentials: {
          email: { label: "Email", type: "email", placeholder: "dev@example.com" },
          role: { 
            label: "Role", 
            type: "select",
            placeholder: "Select role"
          }
        },
        async authorize(credentials) {
          console.log('NextAuth authorize called with:', { 
            email: credentials?.email, 
            role: credentials?.role,
            userId: credentials?.userId,
            env: process.env.APP_ENV 
          })
          
          if (!credentials?.email) {
            console.log('No email provided, returning null')
            return null
          }
          
          // If a userId is provided, fetch the actual user from database
          if (credentials.userId) {
            try {
              const user = await prisma.user.findUnique({
                where: { id: credentials.userId },
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  department: true
                }
              })
              
              if (user) {
                return {
                  id: user.id,
                  email: user.email,
                  name: `${user.firstName} ${user.lastName}`,
                  role: user.role,
                  department: user.department,
                  firstName: user.firstName,
                  lastName: user.lastName
                }
              }
            } catch (error) {
              console.error('Error fetching user:', error)
            }
          }
          
          // Otherwise create a mock user with the selected role
          const devUser = {
            id: "dev-user",
            email: credentials.email,
            name: credentials.email.split('@')[0],
            role: credentials.role || "EMPLOYEE"
          }
          
          console.log('Returning dev user:', devUser)
          return devUser
        }
      })
    ] : []),
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
      
      // Allow development credentials provider in development and UAT
      if (account?.provider === "credentials" && (process.env.NODE_ENV === "development" || process.env.APP_ENV === "uat" || process.env.SHOW_DEV_LOGIN === "true")) {
        console.log('Allowing credentials provider login')
        return true
      }
      
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
            if (profile?.given_name && profile.given_name !== existingUser.firstName) {
              updates.firstName = profile.given_name
            }
            if (profile?.family_name && profile.family_name !== existingUser.lastName) {
              updates.lastName = profile.family_name
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
      // Handle development credentials provider
      if (account?.provider === "credentials" && process.env.NODE_ENV === "development") {
        const devUser = user as any
        token.id = devUser.id
        token.email = devUser.email
        token.name = devUser.name
        token.role = devUser.role || "EMPLOYEE"
        token.department = devUser.department || "Development"
        token.firstName = devUser.firstName || devUser.name?.split(' ')[0] || "Dev"
        token.lastName = devUser.lastName || devUser.name?.split(' ')[1] || "User"
      }
      
      if (account?.provider === "azure-ad") {
        // Store the image URL from the initial sign in
        if (user?.image) {
          token.image = user.image
        }
        
        // Get user from database to get their role and details
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
          select: { 
            id: true, 
            role: true, 
            department: true,
            firstName: true,
            lastName: true 
          }
        })
        
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.department = dbUser.department
          token.firstName = dbUser.firstName
          token.lastName = dbUser.lastName
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.department = token.department as string
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
        if (token.image) {
          session.user.image = token.image as string
        }
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }