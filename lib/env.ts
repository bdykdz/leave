// Explicitly load environment variables for Azure AD
export const azureAdConfig = {
  clientId: process.env.AZURE_AD_CLIENT_ID || "",
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
  tenantId: process.env.AZURE_AD_TENANT_ID || ""
}

// Log on load to debug
if (typeof window === 'undefined') {
  console.log('Azure AD Config loaded:', {
    hasClientId: !!azureAdConfig.clientId,
    hasClientSecret: !!azureAdConfig.clientSecret,
    hasTenantId: !!azureAdConfig.tenantId,
  })
}