@description('Application name')
param appName string

@description('Azure region')
param location string = resourceGroup().location

@description('Log retention in days')
param retentionDays int = 30

@description('Enable Application Insights')
param enableAppInsights bool = true

// ── Log Analytics Workspace ───────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'law-${appName}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
      disableLocalAuth: false
    }
    workspaceCapping: {
      dailyQuotaGb: 1
    }
  }
}

// ── Application Insights ──────────────────────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = if (enableAppInsights) {
  name: 'appi-${appName}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: retentionDays
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────
resource dashboard 'Microsoft.Portal/dashboards@2020-09-01-preview' = {
  name: 'dash-${appName}'
  location: location
  tags: {
    'hidden-title': '${appName} Monitoring'
  }
  properties: {
    lenses: []
    metadata: {
      model: {
        timeRange: {
          value: {
            relative: {
              duration: 24
              timeUnit: 1
            }
          }
          type: 'MsPortalFx.Composition.Configuration.ValueTypes.TimeRange'
        }
      }
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────
output logAnalyticsId string = logAnalytics.id
output logAnalyticsWorkspaceId string = logAnalytics.properties.customerId
output logAnalyticsKey string = logAnalytics.listKeys().primarySharedKey
output appInsightsId string = enableAppInsights ? appInsights.id : ''
output appInsightsConnectionString string = enableAppInsights ? appInsights.properties.ConnectionString : ''
output appInsightsInstrumentationKey string = enableAppInsights ? appInsights.properties.InstrumentationKey : ''
