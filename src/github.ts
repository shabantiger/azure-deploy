import * as core from '@actions/core';
import * as github from '@actions/github';
import * as https from 'https';

/**
 * Creates a GitHub Deployment and marks it as successful.
 */
export async function createDeploymentAnnotation(
  token: string,
  appUrl: string,
  environment: string
): Promise<void> {
  core.startGroup('📌 Creating GitHub Deployment annotation');

  try {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const ref = github.context.ref || github.context.sha;

    // Create deployment
    const deployment = await octokit.rest.repos.createDeployment({
      owner,
      repo,
      ref,
      environment,
      auto_merge: false,
      required_contexts: [],
      description: `Deploying to Azure: ${environment}`,
    });

    if (deployment.status !== 201) {
      core.warning('Could not create GitHub deployment');
      core.endGroup();
      return;
    }

    const deploymentId = (deployment.data as { id: number }).id;

    // Mark as success
    await octokit.rest.repos.createDeploymentStatus({
      owner,
      repo,
      deployment_id: deploymentId,
      state: 'success',
      environment_url: appUrl,
      log_url: `https://github.com/${owner}/${repo}/actions/runs/${github.context.runId}`,
      description: 'Deployed to Azure Container Apps',
      auto_inactive: true,
    });

    core.info(`GitHub Deployment created: ID ${deploymentId}`);
    core.info(`Environment: ${environment}`);
    core.info(`URL: ${appUrl}`);
  } catch (err) {
    core.warning(`Could not create GitHub Deployment: ${String(err)}`);
  }

  core.endGroup();
}

/**
 * Sends a Slack notification about the deployment.
 */
export async function notifySlack(
  webhookUrl: string,
  appName: string,
  appUrl: string,
  environment: string,
  revision: string,
  deployTime: string,
  stack: string,
  status: 'success' | 'failure',
  errorMessage?: string
): Promise<void> {
  core.startGroup('💬 Sending Slack notification');

  const color = status === 'success' ? '#36a64f' : '#ff0000';
  const emoji = status === 'success' ? '✅' : '❌';
  const { owner, repo } = github.context.repo;
  const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${github.context.runId}`;

  const payload = {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${emoji} *Azure Deploy — ${status === 'success' ? 'Success' : 'Failed'}*`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*App:*\n${appName}` },
              { type: 'mrkdwn', text: `*Environment:*\n${environment}` },
              { type: 'mrkdwn', text: `*Stack:*\n${stack}` },
              { type: 'mrkdwn', text: `*Revision:*\n${revision || 'N/A'}` },
              { type: 'mrkdwn', text: `*Deployed at:*\n${deployTime}` },
              {
                type: 'mrkdwn',
                text: `*URL:*\n${appUrl ? `<${appUrl}|Open App>` : 'N/A'}`,
              },
            ],
          },
          ...(errorMessage
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*Error:*\n\`\`\`${errorMessage}\`\`\``,
                  },
                },
              ]
            : []),
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View Run' },
                url: runUrl,
              },
            ],
          },
        ],
      },
    ],
  };

  await postJson(webhookUrl, payload);
  core.info('Slack notification sent');
  core.endGroup();
}

function postJson(url: string, payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Slack webhook returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
