import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionInputs, AzureCredentials } from './types';
import { azureLogin, ensureResourceGroup } from './azure';
import { detectStack, generateDockerfile } from './detect';
import { deploy } from './deploy';
import { createDeploymentAnnotation, notifySlack } from './github';

async function run(): Promise<void> {
  const deployTime = new Date().toISOString();
  let appUrl = '';
  let revision = '';
  let resourceGroup = '';
  let acrName = '';
  let detectedStack = 'unknown';

  try {
    // ── 1. Parse inputs ──────────────────────────────────────────────────
    core.startGroup('📋 Parsing action inputs');

    let credentials: AzureCredentials;
    try {
      credentials = JSON.parse(
        core.getInput('azure-credentials', { required: true })
      ) as AzureCredentials;
    } catch {
      throw new Error(
        'Invalid azure-credentials JSON. Expected output from: az ad sp create-for-rbac --sdk-auth'
      );
    }

    const appName = core.getInput('app-name', { required: true });
    if (!appName || appName.trim() === '') {
      throw new Error('app-name input is required and cannot be empty');
    }

    // Parse env-vars
    const envVarsRaw = core.getInput('env-vars');
    const envVars: Record<string, string> = {};
    if (envVarsRaw.trim()) {
      for (const line of envVarsRaw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim();
          envVars[key] = val;
        }
      }
    }

    const inputs: ActionInputs = {
      azureCredentials: credentials,
      appName: appName.trim(),
      resourceGroup: core.getInput('resource-group').trim(),
      location: core.getInput('location') || 'eastus',
      stack: (core.getInput('stack') || 'auto') as ActionInputs['stack'],
      envVars,
      postgres: core.getInput('postgres').toLowerCase() === 'true',
      postgresSku: core.getInput('postgres-sku') || 'Burstable_B1ms',
      cpu: core.getInput('cpu') || '0.5',
      memory: core.getInput('memory') || '1Gi',
      minReplicas: parseInt(core.getInput('min-replicas') || '1', 10),
      maxReplicas: parseInt(core.getInput('max-replicas') || '3', 10),
      customDomain: core.getInput('custom-domain').trim(),
      acrName: core.getInput('acr-name').trim(),
      dockerFile: core.getInput('docker-file') || 'Dockerfile',
      environment: core.getInput('environment') || 'production',
      notifySlack: core.getInput('notify-slack').trim(),
    };

    core.info(`App name: ${inputs.appName}`);
    core.info(`Location: ${inputs.location}`);
    core.info(`Stack: ${inputs.stack}`);
    core.info(`Environment: ${inputs.environment}`);
    core.info(`Postgres: ${inputs.postgres}`);
    core.endGroup();

    // ── 2. Azure Login ───────────────────────────────────────────────────
    await azureLogin(inputs.azureCredentials);

    // ── 3. Detect stack ──────────────────────────────────────────────────
    const workspaceDir = process.env.GITHUB_WORKSPACE || process.cwd();
    const detection = await detectStack(workspaceDir, inputs.dockerFile);

    detectedStack =
      inputs.stack === 'auto' ? detection.stack : inputs.stack;
    core.info(`Effective stack: ${detectedStack}`);

    // ── 4. Generate Dockerfile if missing ────────────────────────────────
    if (!detection.hasDockerfile && detectedStack !== 'static') {
      core.startGroup('🐳 Auto-generating Dockerfile');
      generateDockerfile(
        detection.stack,
        detection.dockerfilePath
      );
      // Update detection flag
      detection.hasDockerfile = true;
      core.endGroup();
    }

    // ── 5. Ensure resource group ─────────────────────────────────────────
    resourceGroup =
      inputs.resourceGroup ||
      `rg-${inputs.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 32)}-prod`;

    await ensureResourceGroup(resourceGroup, inputs.location);

    // ── 6–11. Deploy ─────────────────────────────────────────────────────
    const outputs = await deploy(inputs, detection);

    appUrl = outputs.appUrl;
    acrName = outputs.acrName;
    resourceGroup = outputs.resourceGroup;
    revision = outputs.revision;

    // ── Set action outputs ───────────────────────────────────────────────
    core.setOutput('app-url', appUrl);
    core.setOutput('acr-name', acrName);
    core.setOutput('resource-group', resourceGroup);
    core.setOutput('revision', revision);
    core.setOutput('deploy-time', outputs.deployTime);

    core.info('');
    core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    core.info('✅ Deployment complete!');
    core.info(`   App URL:        ${appUrl}`);
    core.info(`   ACR:            ${acrName}`);
    core.info(`   Resource Group: ${resourceGroup}`);
    core.info(`   Revision:       ${revision}`);
    core.info(`   Deployed at:    ${outputs.deployTime}`);
    core.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ── 11. GitHub Deployment annotation ────────────────────────────────
    const ghToken = process.env.GITHUB_TOKEN || '';
    if (ghToken && github.context.repo.owner) {
      await createDeploymentAnnotation(
        ghToken,
        appUrl,
        inputs.environment
      );
    }

    // ── 10. Slack notification ───────────────────────────────────────────
    if (inputs.notifySlack) {
      await notifySlack(
        inputs.notifySlack,
        inputs.appName,
        appUrl,
        inputs.environment,
        revision,
        outputs.deployTime,
        detectedStack,
        'success'
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);

    // Set partial outputs
    core.setOutput('app-url', appUrl);
    core.setOutput('acr-name', acrName);
    core.setOutput('resource-group', resourceGroup);
    core.setOutput('revision', revision);
    core.setOutput('deploy-time', deployTime);

    // Slack failure notification
    const notifySlackUrl = core.getInput('notify-slack');
    if (notifySlackUrl) {
      try {
        await notifySlack(
          notifySlackUrl,
          core.getInput('app-name') || 'unknown',
          appUrl,
          core.getInput('environment') || 'production',
          revision,
          deployTime,
          detectedStack,
          'failure',
          message
        );
      } catch {
        // Swallow notification errors on failure path
      }
    }
  }
}

run();
