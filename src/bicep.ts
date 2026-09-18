import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';
import { BicepOutputs, PostgresOutputs, ContainerAppOutputs } from './types';

/**
 * Deploys a Bicep template and returns its outputs.
 */
async function deployBicep<T>(
  resourceGroup: string,
  deploymentName: string,
  templatePath: string,
  parameters: Record<string, unknown>
): Promise<T> {
  core.info(`Deploying Bicep template: ${templatePath}`);
  core.info(`Deployment name: ${deploymentName}`);

  // Build parameter args
  const paramArgs: string[] = [];
  for (const [key, value] of Object.entries(parameters)) {
    paramArgs.push(`${key}=${JSON.stringify(value)}`);
  }

  let stdout = '';
  const args = [
    'deployment', 'group', 'create',
    '--resource-group', resourceGroup,
    '--name', deploymentName,
    '--template-file', templatePath,
    '--output', 'json',
  ];

  if (paramArgs.length > 0) {
    args.push('--parameters', ...paramArgs);
  }

  const code = await exec.exec('az', args, {
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
    },
    ignoreReturnCode: true,
  });

  if (code !== 0) {
    throw new Error(`Bicep deployment failed: ${deploymentName}`);
  }

  try {
    const result = JSON.parse(stdout);
    return (result?.properties?.outputs ?? {}) as T;
  } catch {
    core.warning('Could not parse Bicep deployment outputs');
    return {} as T;
  }
}

/**
 * Deploys base infrastructure (ACR, Log Analytics, Container Apps Env, Managed Identity).
 */
export async function deployBase(
  resourceGroup: string,
  appName: string,
  location: string,
  acrName: string,
  bicepDir: string
): Promise<BicepOutputs> {
  core.startGroup('🏗️ Deploying base infrastructure (ACR, Log Analytics, Container Apps Env)');

  const templatePath = path.join(bicepDir, 'base.bicep');
  const outputs = await deployBicep<BicepOutputs>(
    resourceGroup,
    `${appName}-base`,
    templatePath,
    { appName, location, acrName }
  );

  core.info(`ACR name: ${outputs.containerRegistryName?.value ?? 'unknown'}`);
  core.info(`Container Apps Env: ${outputs.containerAppsEnvironmentId?.value ?? 'unknown'}`);
  core.endGroup();

  return outputs;
}

/**
 * Deploys PostgreSQL Flexible Server.
 */
export async function deployPostgres(
  resourceGroup: string,
  appName: string,
  location: string,
  sku: string,
  adminPassword: string,
  bicepDir: string
): Promise<PostgresOutputs> {
  core.startGroup('🐘 Deploying PostgreSQL Flexible Server');

  const templatePath = path.join(bicepDir, 'postgres.bicep');
  const outputs = await deployBicep<PostgresOutputs>(
    resourceGroup,
    `${appName}-postgres`,
    templatePath,
    { appName, location, sku, adminPassword }
  );

  core.info(`Postgres host: ${outputs.postgresHost?.value ?? 'unknown'}`);
  core.info(`Postgres DB: ${outputs.postgresDbName?.value ?? appName}`);
  core.endGroup();

  return outputs;
}

/**
 * Deploys Azure Container App.
 */
export async function deployContainerApp(
  resourceGroup: string,
  appName: string,
  location: string,
  imageRef: string,
  containerAppsEnvId: string,
  managedIdentityId: string,
  managedIdentityClientId: string,
  port: number,
  cpu: string,
  memory: string,
  minReplicas: number,
  maxReplicas: number,
  envVars: Record<string, string>,
  bicepDir: string
): Promise<ContainerAppOutputs> {
  core.startGroup('🚀 Deploying Azure Container App');

  const templatePath = path.join(bicepDir, 'container-app.bicep');

  // Serialize envVars as JSON string for Bicep
  const envVarsJson = JSON.stringify(
    Object.entries(envVars).map(([name, value]) => ({ name, value }))
  );

  const outputs = await deployBicep<ContainerAppOutputs>(
    resourceGroup,
    `${appName}-containerapp`,
    templatePath,
    {
      appName,
      location,
      imageRef,
      containerAppsEnvironmentId: containerAppsEnvId,
      managedIdentityId,
      managedIdentityClientId,
      port,
      cpu,
      memory,
      minReplicas,
      maxReplicas,
      envVarsJson,
    }
  );

  core.info(`App URL: ${outputs.appUrl?.value ?? 'pending'}`);
  core.info(`Revision: ${outputs.revisionName?.value ?? 'unknown'}`);
  core.endGroup();

  return outputs;
}

/**
 * Deploys Azure Static Web App.
 */
export async function deployStaticWebApp(
  resourceGroup: string,
  appName: string,
  location: string,
  bicepDir: string
): Promise<ContainerAppOutputs> {
  core.startGroup('🌐 Deploying Azure Static Web App');

  const templatePath = path.join(bicepDir, 'static-web.bicep');
  const outputs = await deployBicep<ContainerAppOutputs>(
    resourceGroup,
    `${appName}-staticweb`,
    templatePath,
    { appName, location }
  );

  core.info(`Static Web App URL: ${outputs.appUrl?.value ?? 'pending'}`);
  core.endGroup();

  return outputs;
}
