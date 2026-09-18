import { AzureCredentials } from './types';
/**
 * Logs in to Azure using a service principal.
 */
export declare function azureLogin(credentials: AzureCredentials): Promise<void>;
/**
 * Ensures a resource group exists, creating it if not.
 */
export declare function ensureResourceGroup(resourceGroup: string, location: string): Promise<void>;
/**
 * Builds and pushes a Docker image to Azure Container Registry.
 */
export declare function buildAndPushImage(acrName: string, appName: string, dockerfilePath: string, buildContext: string, tag: string): Promise<string>;
/**
 * Gets the latest git commit SHA (short) for use as image tag.
 */
export declare function getGitSha(): Promise<string>;
/**
 * Polls Container App revision until it becomes active.
 */
export declare function pollRevisionActive(resourceGroup: string, appName: string, revisionName: string, timeoutMs?: number, intervalMs?: number): Promise<void>;
/**
 * Retrieves the Container App FQDN (URL).
 */
export declare function getContainerAppUrl(resourceGroup: string, appName: string): Promise<string>;
