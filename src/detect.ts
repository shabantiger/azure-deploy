import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { DetectResult } from './types';

/**
 * Auto-detects the application stack based on files present in the workspace.
 * Priority order:
 *   - package.json + /client or /frontend dir → fullstack
 *   - package.json only → node
 *   - requirements.txt or pyproject.toml → python
 *   - only index.html/dist/public → static
 *   - Dockerfile present → use it regardless of stack detection
 */
export async function detectStack(
  workspaceDir: string,
  dockerfilePath: string
): Promise<DetectResult> {
  core.startGroup('🔍 Detecting application stack');

  const hasFile = (f: string): boolean =>
    fs.existsSync(path.join(workspaceDir, f));
  const hasDir = (d: string): boolean => {
    const full = path.join(workspaceDir, d);
    return fs.existsSync(full) && fs.statSync(full).isDirectory();
  };

  const hasDockerfile = hasFile(dockerfilePath);
  const resolvedDockerfilePath = path.join(workspaceDir, dockerfilePath);

  const hasPackageJson = hasFile('package.json');
  const hasRequirementsTxt = hasFile('requirements.txt');
  const hasPyproject = hasFile('pyproject.toml');
  const hasClientDir = hasDir('client');
  const hasFrontendDir = hasDir('frontend');
  const hasIndexHtml = hasFile('index.html');
  const hasDistDir = hasDir('dist');
  const hasPublicDir = hasDir('public');

  let detectedStack: 'node' | 'python' | 'static' | 'fullstack';

  if (hasPackageJson && (hasClientDir || hasFrontendDir)) {
    detectedStack = 'fullstack';
    core.info(
      `Detected stack: fullstack (package.json + ${hasClientDir ? 'client' : 'frontend'} directory)`
    );
  } else if (hasPackageJson) {
    detectedStack = 'node';
    core.info('Detected stack: node (package.json found)');
  } else if (hasRequirementsTxt || hasPyproject) {
    detectedStack = 'python';
    core.info(
      `Detected stack: python (${hasRequirementsTxt ? 'requirements.txt' : 'pyproject.toml'} found)`
    );
  } else if (hasIndexHtml || hasDistDir || hasPublicDir) {
    detectedStack = 'static';
    core.info(
      `Detected stack: static (${hasIndexHtml ? 'index.html' : hasDistDir ? 'dist/' : 'public/'} found)`
    );
  } else {
    core.warning('Could not auto-detect stack, defaulting to node');
    detectedStack = 'node';
  }

  if (hasDockerfile) {
    core.info(`Dockerfile found at: ${dockerfilePath} — will use existing Dockerfile`);
  } else {
    core.info(`No Dockerfile found — will auto-generate for ${detectedStack} stack`);
  }

  core.endGroup();

  return {
    stack: detectedStack,
    hasDockerfile,
    dockerfilePath: resolvedDockerfilePath,
  };
}

/**
 * Generates a Dockerfile for the given stack.
 */
export function generateDockerfile(
  stack: 'node' | 'python' | 'static' | 'fullstack',
  outputPath: string
): void {
  core.startGroup('🐳 Generating Dockerfile');

  let content: string;

  switch (stack) {
    case 'node':
      content = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
`;
      break;

    case 'fullstack':
      content = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
`;
      break;

    case 'python':
      content = `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
      break;

    case 'static':
      content = `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
      break;
  }

  fs.writeFileSync(outputPath, content, 'utf8');
  core.info(`Generated Dockerfile at: ${outputPath}`);
  core.info('Content:\n' + content);
  core.endGroup();
}

/**
 * Returns the default container port for the given stack.
 */
export function getStackPort(stack: 'node' | 'python' | 'static' | 'fullstack'): number {
  switch (stack) {
    case 'node':
    case 'fullstack':
      return 3000;
    case 'python':
      return 8000;
    case 'static':
      return 80;
  }
}
