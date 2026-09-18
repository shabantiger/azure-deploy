export type Stack = 'node' | 'python' | 'static' | 'fullstack' | 'auto';

export interface AzureCredentials {
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
  tenantId: string;
}

export interface ActionInputs {
  azureCredentials: AzureCredentials;
  appName: string;
  resourceGroup: string;
  location: string;
  stack: Stack;
  envVars: Record<string, string>;
  postgres: boolean;
  postgresSku: string;
  cpu: string;
  memory: string;
  minReplicas: number;
  maxReplicas: number;
  customDomain: string;
  acrName: string;
  dockerFile: string;
  environment: string;
  notifySlack: string;
}

export interface ActionOutputs {
  appUrl: string;
  acrName: string;
  resourceGroup: string;
  revision: string;
  deployTime: string;
}

export interface DetectResult {
  stack: 'node' | 'python' | 'static' | 'fullstack';
  hasDockerfile: boolean;
  dockerfilePath: string;
}

export interface BicepOutputs {
  containerRegistryName?: { value: string };
  containerAppsEnvironmentId?: { value: string };
  managedIdentityId?: { value: string };
  managedIdentityClientId?: { value: string };
  logAnalyticsWorkspaceId?: { value: string };
}

export interface PostgresOutputs {
  postgresHost?: { value: string };
  postgresPort?: { value: string };
  postgresDbName?: { value: string };
  postgresAdminUser?: { value: string };
}

export interface ContainerAppOutputs {
  appUrl?: { value: string };
  revisionName?: { value: string };
}

export interface SlackPayload {
  text?: string;
  blocks?: SlackBlock[];
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
}
