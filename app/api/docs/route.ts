import { ApiReference } from '@scalar/nextjs-api-reference'
import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

// Read the OpenAPI spec at build time for better performance
let openApiSpec: string | null = null

function getOpenApiSpec(): string {
  if (!openApiSpec) {
    try {
      const specPath = join(process.cwd(), 'openapi.yaml')
      openApiSpec = readFileSync(specPath, 'utf-8')
    } catch {
      // Fallback to a minimal spec if file not found
      openApiSpec = `
openapi: 3.1.0
info:
  title: Leave Management System API
  version: 1.0.0
  description: API documentation not available. Please ensure openapi.yaml exists in the project root.
paths: {}
`
    }
  }
  return openApiSpec
}

const config = {
  spec: {
    content: getOpenApiSpec(),
  },
  theme: 'kepler' as const,
  layout: 'modern' as const,
  darkMode: true,
  hideModels: false,
  hideDownloadButton: false,
  showSidebar: true,
  customCss: `
    .scalar-app {
      --scalar-font: 'Inter', sans-serif;
    }
    .darklight-reference {
      --scalar-background-1: #0f172a;
      --scalar-background-2: #1e293b;
      --scalar-background-3: #334155;
    }
  `,
  metaData: {
    title: 'Leave Management API Documentation',
    description: 'Interactive API documentation for the Leave Management System',
  },
}

// Export the Scalar API reference as GET handler
export const GET = ApiReference(config)
