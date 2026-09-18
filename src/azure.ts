import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { AzureCredentials } from './types';

/**
 * Logs in to Azure using a service principal.
 */
export async function azureLogin(credentials: AzureCredentials): Promise<void> {
  core.startGroup('🔐 Azure Login');
  core.info(`Logging in as service principal: ${credentials.clientId}`);
  core.info(`Tenant: ${credentials.tenantId}`);
  core.info(`Subscription: ${credentials.subscriptionId}`);

  const exitCode = await exec.exec(
    'az',
    [
      'login',
      '--service-principal',
      '--username', credentials.clientId,
      '--password', credentials.clientSecret,
      '--tenant', credentials.tenantId,
    ],
    {
      silent: true,
      env: {
        ...process.env,
        AZURE_CORE_ONLY_SHOW_ERRORS: 'true',
      },
    }
  );

  if (exitCode !== 0) {
    throw new Error('Azure login failed. Check your azure-credentials secret.');
  }

  await exec.exec('az', ['account', 'set', '--subscription', credentials.subscriptionId]);
  core.info('Azure login successful');
  core.endGroup();
}

/**
 * Ensures a resource group exists, creating it if not.
 */
export async function ensureResourceGroup(
  resourceGroup: string,
  location: string
): Promise<void> {
  core.startGroup(`📦 Ensuring resource group: ${resourceGroup}`);

  let stdout = '';
  const exists = await exec.exec(
    'az',
    ['group', 'exists', '--name', resourceGroup],
    {
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString();
        },
      },
    }
  );

  if (exists !== 0) {
    throw new Error(`Failed to check resource group existence: ${resourceGroup}`);
  }

  if (stdout.trim() === 'false') {
    core.info(`Creating resource group: ${resourceGroup} in ${location}`);
    const createCode = await exec.exec('az', [
      'group',
      'create',
      '--name', resourceGroup,
      '--location', location,
    ]);
    if (createCode !== 0) {
      throw new Error(`Failed to create resource group: ${resourceGroup}`);
    }
    core.info(`Resource group created: ${resourceGroup}`);
  } else {
    core.info(`Resource group already exists: ${resourceGroup}`);
  }

  core.endGroup();
}

/**
 * Builds and pushes a Docker image to Azure Container Registry.
 */
export async function buildAndPushImage(
  acrName: string,
  appName: string,
  dockerfilePath: string,
  buildContext: string,
  tag: string
): Promise<string> {
  core.startGroup('🐳 Build & Push Docker image to ACR');

  const imageRef = `${acrName}.azurecr.io/${appName}:${tag}`;
  core.info(`Building image: ${imageRef}`);
  core.info(`Dockerfile: ${dockerfilePath}`);
  core.info(`Build context: ${buildContext}`);

  // Login to ACR
  const loginCode = await exec.exec('az', [
    'acr', 'login',
    '--name', acrName,
  ]);
  if (loginCode !== 0) {
    throw new Error(`Failed to login to ACR: ${acrName}`);
  }

  // Build image
  const buildCode = await exec.exec('docker', [
    'build',
    '-t', imageRef,
    '-f', dockerfilePath,
    buildContext,
  ]);
  if (buildCode !== 0) {
    throw new Error('Docker build failed');
  }

  // Push image
  const pushCode = await exec.exec('docker', ['push', imageRef]);
  if (pushCode !== 0) {
    throw new Error('Docker push failed');
  }

  core.info(`Image pushed: ${imageRef}`);
  core.endGroup();
  return imageRef;
}

/**
 * Gets the latest git commit SHA (short) for use as image tag.
 */
export async function getGitSha(): Promise<string> {
  let sha = '';
  await exec.exec('git', ['rev-parse', '--short', 'HEAD'], {
    listeners: {
      stdout: (data: Buffer) => {
        sha += data.toString().trim();
      },
    },
    silent: true,
    ignoreReturnCode: true,
  });
  return sha || `build-${Date.now()}`;
}

/**
 * Polls Container App revision until it becomes active.
 */
export async function pollRevisionActive(
  resourceGroup: string,
  appName: string,
  revisionName: string,
  timeoutMs = 300000,
  intervalMs = 10000
): Promise<void> {
  core.startGroup(`⏳ Waiting for revision ${revisionName} to become active`);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let stdout = '';
    const code = await exec.exec(
      'az',
      [
        'containerapp', 'revision', 'show',
        '--resource-group', resourceGroup,
        '--name', appName,
        '--revision', revisionName,
        '--query', 'properties.runningState',
        '--output', 'tsv',
      ],
      {
        listeners: {
          stdout: (data: Buffer) => {
            stdout += data.toString().trim();
          },
        },
        silent: true,
        ignoreReturnCode: true,
      }
    );

    if (code === 0 && stdout.toLowerCase() === 'running') {
      core.info(`Revision ${revisionName} is Running`);
      core.endGroup();
      return;
    }

    core.info(`Revision state: ${stdout || 'unknown'} — waiting ${intervalMs / 1000}s...`);
    await sleep(intervalMs);
  }

  core.endGroup();
  throw new Error(`Timed out waiting for revision ${revisionName} to become active`);
}

/**
 * Retrieves the Container App FQDN (URL).
 */
export async function getContainerAppUrl(
  resourceGroup: string,
  appName: string
): Promise<string> {
  let fqdn = '';
  const code = await exec.exec(
    'az',
    [
      'containerapp', 'show',
      '--resource-group', resourceGroup,
      '--name', appName,
      '--query', 'properties.configuration.ingress.fqdn',
      '--output', 'tsv',
    ],
    {
      listeners: {
        stdout: (data: Buffer) => {
          fqdn += data.toString().trim();
        },
      },
      silent: true,
      ignoreReturnCode: true,
    }
  );

  if (code !== 0 || !fqdn) {
    return '';
  }

  return `https://${fqdn}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
