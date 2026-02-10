import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { AuthProvider } from "@/components/auth-provider"
import { DevRoleSwitcher } from "@/components/dev-role-switcher"
import { LanguageProvider } from "@/components/language-provider"
import { AppProviders } from "@/components/providers/app-providers"

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: "TPF - Sistem de Management Concedii",
  description: "Manage leave requests and work remote arrangements",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans" suppressHydrationWarning>
        <AuthProvider>
          <AppProviders>
            <ThemeProvider 
              attribute="class" 
              defaultTheme="light" 
              enableSystem={false}
              disableTransitionOnChange
              forcedTheme="light"
            >
              <LanguageProvider>
                {children}
                <Toaster />
                {process.env.NODE_ENV === 'development' && <DevRoleSwitcher />}
              </LanguageProvider>
            </ThemeProvider>
          </AppProviders>
        </AuthProvider>
      </body>
    </html>
  )
}
