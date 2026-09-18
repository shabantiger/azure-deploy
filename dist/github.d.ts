/**
 * Creates a GitHub Deployment and marks it as successful.
 */
export declare function createDeploymentAnnotation(token: string, appUrl: string, environment: string): Promise<void>;
/**
 * Sends a Slack notification about the deployment.
 */
export declare function notifySlack(webhookUrl: string, appName: string, appUrl: string, environment: string, revision: string, deployTime: string, stack: string, status: 'success' | 'failure', errorMessage?: string): Promise<void>;
