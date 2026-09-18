import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as crypto from 'crypto';
import { ActionInputs, ActionOutputs, DetectResult } from './types';
import {
  buildAndPushImage,
  getGitSha,
  pollRevisionActive,
  getContainerAppUrl,
} from './azure';
import {
  deployBase,
  deployPostgres,
  deployContainerApp,
  deployStaticWebApp,
} from './bicep';
import { getStackPort } from './detect';

// Bicep templates live alongside the compiled action
const BICEP_DIR = path.join(__dirname, '..', 'bicep');

/**
 * Main deploy orchestration.
 */
export async function deploy(
  inputs: ActionInputs,
  detection: DetectResult
): Promise<ActionOutputs> {
  const deployTime = new Date().toISOString();
  const stack = inputs.stack === 'auto' ? detection.stack : inputs.stack;

  // Sanitize app name (lowercase, alphanumeric + hyphens, max 32 chars)
  const safeAppName = inputs.appName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 32);

  const resourceGroup =
    inputs.resourceGroup || `rg-${safeAppName}-prod`;

  // ACR names must be globally unique, 5-50 alphanumeric chars
  const acrName =
    inputs.acrName ||
    sanitizeAcrName(`acr${safeAppName}${shortHash(safeAppName)}`);

  core.info(`App name: ${safeAppName}`);
  core.info(`Resource group: ${resourceGroup}`);
  core.info(`ACR name: ${acrName}`);
  core.info(`Stack: ${stack}`);
  core.info(`Location: ${inputs.location}`);

  // ── Static Web App path ──────────────────────────────────────────────────
  if (stack === 'static') {
    const outputs = await deployStaticWebApp(
      resourceGroup,
      safeAppName,
      inputs.location,
      BICEP_DIR
    );

    const appUrl = outputs.appUrl?.value ?? '';
    return {
      appUrl,
      acrName: '',
      resourceGroup,
      revision: '',
      deployTime,
    };
  }

  // ── Container-based path ─────────────────────────────────────────────────

  // 1. Deploy base infra
  const baseOutputs = await deployBase(
    resourceGroup,
    safeAppName,
    inputs.location,
    acrName,
    BICEP_DIR
  );

  const resolvedAcrName = baseOutputs.containerRegistryName?.value ?? acrName;
  const containerAppsEnvId = baseOutputs.containerAppsEnvironmentId?.value ?? '';
  const managedIdentityId = baseOutputs.managedIdentityId?.value ?? '';
  const managedIdentityClientId = baseOutputs.managedIdentityClientId?.value ?? '';

  // 2. Optionally deploy Postgres
  let envVars: Record<string, string> = { ...inputs.envVars };

  if (inputs.postgres) {
    const pgPassword = generatePassword();
    const pgOutputs = await deployPostgres(
      resourceGroup,
      safeAppName,
      inputs.location,
      inputs.postgresSku,
      pgPassword,
      BICEP_DIR
    );

    // Inject DATABASE_URL
    const pgHost = pgOutputs.postgresHost?.value ?? '';
    const pgPort = pgOutputs.postgresPort?.value ?? '5432';
    const pgDb = pgOutputs.postgresDbName?.value ?? safeAppName;
    const pgUser = pgOutputs.postgresAdminUser?.value ?? 'pgadmin';

    envVars['DATABASE_URL'] =
      `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDb}?sslmode=require`;
    envVars['POSTGRES_HOST'] = pgHost;
    envVars['POSTGRES_PORT'] = pgPort;
    envVars['POSTGRES_DB'] = pgDb;
    envVars['POSTGRES_USER'] = pgUser;
    envVars['POSTGRES_PASSWORD'] = pgPassword;

    // Store the password as a GitHub Actions secret (best-effort)
    core.setSecret(pgPassword);
    core.saveState('pgPassword', pgPassword);
  }

  // 3. Build + push Docker image
  const gitSha = await getGitSha();
  const imageRef = await buildAndPushImage(
    resolvedAcrName,
    safeAppName,
    detection.dockerfilePath,
    process.env.GITHUB_WORKSPACE || process.cwd(),
    gitSha
  );

  // 4. Deploy Container App
  const port = getStackPort(stack as 'node' | 'python' | 'static' | 'fullstack');
  const containerOutputs = await deployContainerApp(
    resourceGroup,
    safeAppName,
    inputs.location,
    imageRef,
    containerAppsEnvId,
    managedIdentityId,
    managedIdentityClientId,
    port,
    inputs.cpu,
    inputs.memory,
    inputs.minReplicas,
    inputs.maxReplicas,
    envVars,
    BICEP_DIR
  );

  const revisionName = containerOutputs.revisionName?.value ?? '';

  // 5. Poll for revision to become active
  if (revisionName) {
    await pollRevisionActive(resourceGroup, safeAppName, revisionName);
  }

  // 6. Get app URL
  let appUrl = containerOutputs.appUrl?.value ?? '';
  if (!appUrl) {
    appUrl = await getContainerAppUrl(resourceGroup, safeAppName);
  }

  // 7. Bind custom domain if provided
  if (inputs.customDomain) {
    await bindCustomDomain(resourceGroup, safeAppName, inputs.customDomain);
  }

  return {
    appUrl,
    acrName: resolvedAcrName,
    resourceGroup,
    revision: revisionName,
    deployTime,
  };
}

async function bindCustomDomain(
  resourceGroup: string,
  appName: string,
  customDomain: string
): Promise<void> {
  core.startGroup(`🌐 Binding custom domain: ${customDomain}`);
  const code = await exec.exec(
    'az',
    [
      'containerapp', 'hostname', 'bind',
      '--resource-group', resourceGroup,
      '--name', appName,
      '--hostname', customDomain,
      '--validation-method', 'CNAME',
    ],
    { ignoreReturnCode: true }
  );
  if (code !== 0) {
    core.warning(
      `Custom domain binding failed (may require manual DNS setup for ${customDomain})`
    );
  }
  core.endGroup();
}

function sanitizeAcrName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 50);
}

function shortHash(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex').substring(0, 6);
}

function generatePassword(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const bytes = crypto.randomBytes(32);
  for (const byte of bytes) {
    password += chars[byte % chars.length];
  }
  return password;
}
