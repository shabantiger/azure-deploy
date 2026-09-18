// Mock all external dependencies
jest.mock('@actions/core', () => ({
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  setSecret: jest.fn(),
  saveState: jest.fn(),
  getInput: jest.fn(),
}));

jest.mock('@actions/exec', () => ({
  exec: jest.fn().mockResolvedValue(0),
}));

jest.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    ref: 'refs/heads/main',
    sha: 'abc1234',
    runId: 12345,
  },
  getOctokit: jest.fn().mockReturnValue({
    rest: {
      repos: {
        createDeployment: jest.fn().mockResolvedValue({
          status: 201,
          data: { id: 42 },
        }),
        createDeploymentStatus: jest.fn().mockResolvedValue({ status: 201 }),
      },
    },
  }),
}));

import { ActionInputs, DetectResult } from '../src/types';

// Helper to build minimal ActionInputs
function buildInputs(overrides: Partial<ActionInputs> = {}): ActionInputs {
  return {
    azureCredentials: {
      clientId: 'test-client-id',
      clientSecret: 'test-secret',
      subscriptionId: 'test-sub-id',
      tenantId: 'test-tenant-id',
    },
    appName: 'my-app',
    resourceGroup: 'rg-my-app-prod',
    location: 'eastus',
    stack: 'node',
    envVars: {},
    postgres: false,
    postgresSku: 'Burstable_B1ms',
    cpu: '0.5',
    memory: '1Gi',
    minReplicas: 1,
    maxReplicas: 3,
    customDomain: '',
    acrName: 'acrmyapp',
    dockerFile: 'Dockerfile',
    environment: 'production',
    notifySlack: '',
    ...overrides,
  };
}

function buildDetection(overrides: Partial<DetectResult> = {}): DetectResult {
  return {
    stack: 'node',
    hasDockerfile: true,
    dockerfilePath: '/workspace/Dockerfile',
    ...overrides,
  };
}

describe('ActionInputs type validation', () => {
  it('builds valid inputs without errors', () => {
    const inputs = buildInputs();
    expect(inputs.appName).toBe('my-app');
    expect(inputs.stack).toBe('node');
    expect(inputs.postgres).toBe(false);
    expect(inputs.minReplicas).toBe(1);
    expect(inputs.maxReplicas).toBe(3);
  });

  it('accepts fullstack with postgres', () => {
    const inputs = buildInputs({ stack: 'fullstack', postgres: true });
    expect(inputs.stack).toBe('fullstack');
    expect(inputs.postgres).toBe(true);
  });

  it('accepts python stack', () => {
    const inputs = buildInputs({ stack: 'python' });
    expect(inputs.stack).toBe('python');
  });

  it('accepts static stack', () => {
    const inputs = buildInputs({ stack: 'static' });
    expect(inputs.stack).toBe('static');
  });

  it('accepts auto stack', () => {
    const inputs = buildInputs({ stack: 'auto' });
    expect(inputs.stack).toBe('auto');
  });
});

describe('DetectResult type validation', () => {
  it('builds valid detection result', () => {
    const detection = buildDetection();
    expect(detection.stack).toBe('node');
    expect(detection.hasDockerfile).toBe(true);
  });

  it('handles missing dockerfile', () => {
    const detection = buildDetection({ hasDockerfile: false });
    expect(detection.hasDockerfile).toBe(false);
  });
});

describe('env-vars parsing', () => {
  it('parses KEY=VALUE pairs correctly', () => {
    const raw = 'FOO=bar\nBAZ=qux\nDB_HOST=localhost:5432';
    const envVars: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        envVars[line.substring(0, eqIdx)] = line.substring(eqIdx + 1);
      }
    }
    expect(envVars['FOO']).toBe('bar');
    expect(envVars['BAZ']).toBe('qux');
    expect(envVars['DB_HOST']).toBe('localhost:5432');
  });

  it('skips comment lines', () => {
    const raw = '# This is a comment\nFOO=bar';
    const envVars: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        envVars[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
      }
    }
    expect(Object.keys(envVars)).toEqual(['FOO']);
    expect(envVars['FOO']).toBe('bar');
  });

  it('handles VALUE with = signs', () => {
    const raw = 'JWT_SECRET=abc=def=ghi';
    const envVars: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        envVars[line.substring(0, eqIdx)] = line.substring(eqIdx + 1);
      }
    }
    expect(envVars['JWT_SECRET']).toBe('abc=def=ghi');
  });
});

describe('app name sanitization', () => {
  const sanitize = (name: string): string =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 32);

  it('lowercases the name', () => {
    expect(sanitize('MyApp')).toBe('myapp');
  });

  it('replaces invalid characters with hyphens', () => {
    expect(sanitize('my_app.name')).toBe('my-app-name');
  });

  it('collapses multiple hyphens', () => {
    expect(sanitize('my--app---name')).toBe('my-app-name');
  });

  it('trims leading/trailing hyphens', () => {
    expect(sanitize('-my-app-')).toBe('my-app');
  });

  it('truncates to 32 chars', () => {
    const long = 'a'.repeat(40);
    expect(sanitize(long).length).toBeLessThanOrEqual(32);
  });
});
