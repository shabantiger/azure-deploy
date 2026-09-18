@description('Application name (used as database name and server prefix)')
param appName string

@description('Azure region')
param location string = resourceGroup().location

@description('PostgreSQL SKU name')
param sku string = 'Burstable_B1ms'

@description('Administrator password')
@secure()
param adminPassword string

var adminUser = 'pgadmin${uniqueString(appName)}'
var serverName = 'pg-${appName}-${uniqueString(resourceGroup().id)}'

// ── PostgreSQL Flexible Server ────────────────────────────────────────────
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: sku
    tier: startsWith(sku, 'Burstable') ? 'Burstable' : startsWith(sku, 'GeneralPurpose') ? 'GeneralPurpose' : 'MemoryOptimized'
  }
  properties: {
    administratorLogin: adminUser
    administratorLoginPassword: adminPassword
    version: '15'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// ── Allow Azure services firewall rule ────────────────────────────────────
resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresServer
  name: 'AllowAllAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ── Application database ──────────────────────────────────────────────────
resource appDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: replace(appName, '-', '_')
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────
output postgresHost string = postgresServer.properties.fullyQualifiedDomainName
output postgresPort string = '5432'
output postgresDbName string = appDatabase.name
output postgresAdminUser string = adminUser
output postgresServerName string = postgresServer.name
