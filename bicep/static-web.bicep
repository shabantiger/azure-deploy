@description('Application name')
param appName string

@description('Azure region (Static Web Apps support limited regions; defaults to centralus)')
param location string = 'centralus'

// ── Azure Static Web App (Free SKU) ──────────────────────────────────────
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'swa-${appName}'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────
output appUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppName string = staticWebApp.name
output staticWebAppId string = staticWebApp.id
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
