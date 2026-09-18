@description('Application name')
param appName string

@description('Azure region')
param location string = resourceGroup().location

@description('Docker image reference (registry/image:tag)')
param imageRef string

@description('Container Apps Environment resource ID')
param containerAppsEnvironmentId string

@description('User-assigned Managed Identity resource ID')
param managedIdentityId string

@description('User-assigned Managed Identity client ID')
param managedIdentityClientId string

@description('Container port')
param port int = 3000

@description('CPU allocation in vCPUs')
param cpu string = '0.5'

@description('Memory allocation')
param memory string = '1Gi'

@description('Minimum replica count')
param minReplicas int = 1

@description('Maximum replica count')
param maxReplicas int = 3

@description('Environment variables as JSON array: [{name: string, value: string}]')
param envVarsJson string = '[]'

var envVarsArray = json(envVarsJson)

// ── Container App ─────────────────────────────────────────────────────────
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    environmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: true
        targetPort: port
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: split(imageRef, '/')[0]
          identity: managedIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: imageRef
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: [for envVar in envVarsArray: {
            name: envVar.name
            value: envVar.value
          }]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────
output appUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output revisionName string = containerApp.properties.latestRevisionName
output fqdn string = containerApp.properties.configuration.ingress.fqdn
