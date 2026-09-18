@description('Application name')
param appName string

@description('Azure region')
param location string = resourceGroup().location

@description('Address prefix for the VNet')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('Address prefix for the Container Apps subnet')
param containerAppsSubnetPrefix string = '10.0.0.0/23'

@description('Address prefix for the private endpoints subnet')
param privateEndpointsSubnetPrefix string = '10.0.2.0/24'

// ── Virtual Network ───────────────────────────────────────────────────────
resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: 'vnet-${appName}'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [vnetAddressPrefix]
    }
    subnets: [
      {
        name: 'snet-containerApps'
        properties: {
          addressPrefix: containerAppsSubnetPrefix
          delegations: []
        }
      }
      {
        name: 'snet-privateEndpoints'
        properties: {
          addressPrefix: privateEndpointsSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────
output vnetId string = vnet.id
output vnetName string = vnet.name
output containerAppsSubnetId string = vnet.properties.subnets[0].id
output privateEndpointsSubnetId string = vnet.properties.subnets[1].id
