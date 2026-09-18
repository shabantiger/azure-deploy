import { BicepOutputs, PostgresOutputs, ContainerAppOutputs } from './types';
/**
 * Deploys base infrastructure (ACR, Log Analytics, Container Apps Env, Managed Identity).
 */
export declare function deployBase(resourceGroup: string, appName: string, location: string, acrName: string, bicepDir: string): Promise<BicepOutputs>;
/**
 * Deploys PostgreSQL Flexible Server.
 */
export declare function deployPostgres(resourceGroup: string, appName: string, location: string, sku: string, adminPassword: string, bicepDir: string): Promise<PostgresOutputs>;
/**
 * Deploys Azure Container App.
 */
export declare function deployContainerApp(resourceGroup: string, appName: string, location: string, imageRef: string, containerAppsEnvId: string, managedIdentityId: string, managedIdentityClientId: string, port: number, cpu: string, memory: string, minReplicas: number, maxReplicas: number, envVars: Record<string, string>, bicepDir: string): Promise<ContainerAppOutputs>;
/**
 * Deploys Azure Static Web App.
 */
export declare function deployStaticWebApp(resourceGroup: string, appName: string, location: string, bicepDir: string): Promise<ContainerAppOutputs>;
