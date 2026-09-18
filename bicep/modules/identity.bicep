@description('Application name')
param appName string

@description('Azure region')
param location string = resourceGroup().location

@description('Resource IDs to grant the identity contributor access to (optional)')
param contributorScopeIds array = []

// ── User-Assigned Managed Identity ────────────────────────────────────────
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${appName}'
  location: location
}

// ── Optional Contributor Role Assignments ─────────────────────────────────
// Built-in: Contributor = b24988ac-6180-42a0-ab88-20f7382dd24c
resource contributorRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for scopeId in contributorScopeIds: {
  name: guid(scopeId, managedIdentity.id, 'contributor')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'b24988ac-6180-42a0-ab88-20f7382dd24c'
    )
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}]

// ── Outputs ───────────────────────────────────────────────────────────────
output identityId string = managedIdentity.id
output identityClientId string = managedIdentity.properties.clientId
output identityPrincipalId string = managedIdentity.properties.principalId
output identityName string = managedIdentity.name
