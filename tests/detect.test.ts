import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { detectStack, generateDockerfile, getStackPort } from '../src/detect';

// Mock @actions/core to avoid GitHub Actions context dependency
jest.mock('@actions/core', () => ({
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('detectStack', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects node stack from package.json', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.stack).toBe('node');
    expect(result.hasDockerfile).toBe(false);
  });

  it('detects fullstack from package.json + client dir', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
    fs.mkdirSync(path.join(tmpDir, 'client'));
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.stack).toBe('fullstack');
  });

  it('detects fullstack from package.json + frontend dir', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
    fs.mkdirSync(path.join(tmpDir, 'frontend'));
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.stack).toBe('fullstack');
  });

  it('detects python from requirements.txt', async () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==3.0.0\n');
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.stack).toBe('python');
  });

  it('detects python from pyproject.toml', async () => {
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[tool.poetry]\nname="test"\n');
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.stack).toBe('python');
  });

  it('detects static from index.html', async () => {
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<html></html>');
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.stack).toBe('static');
  });

  it('detects static from dist directory', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'));
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.stack).toBe('static');
  });

  it('detects static from public directory', async () => {
    fs.mkdirSync(path.join(tmpDir, 'public'));
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.stack).toBe('static');
  });

  it('detects existing Dockerfile', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node:20-alpine\n');
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.hasDockerfile).toBe(true);
  });

  it('defaults to node when nothing is detected', async () => {
    const result = await detectStack(tmpDir, 'Dockerfile');
    expect(result.stack).toBe('node');
  });
});

describe('generateDockerfile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dockerfile-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates node Dockerfile', () => {
    const filePath = path.join(tmpDir, 'Dockerfile');
    generateDockerfile('node', filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('FROM node:20-alpine');
    expect(content).toContain('npm ci');
    expect(content).toContain('EXPOSE 3000');
    expect(content).toContain('dist/main.js');
  });

  it('generates python Dockerfile', () => {
    const filePath = path.join(tmpDir, 'Dockerfile');
    generateDockerfile('python', filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('FROM python:3.11-slim');
    expect(content).toContain('pip install');
    expect(content).toContain('EXPOSE 8000');
    expect(content).toContain('uvicorn');
  });

  it('generates static Dockerfile', () => {
    const filePath = path.join(tmpDir, 'Dockerfile');
    generateDockerfile('static', filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('FROM nginx:alpine');
    expect(content).toContain('EXPOSE 80');
  });

  it('generates fullstack Dockerfile (same as node)', () => {
    const filePath = path.join(tmpDir, 'Dockerfile');
    generateDockerfile('fullstack', filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('FROM node:20-alpine');
    expect(content).toContain('EXPOSE 3000');
  });
});

describe('getStackPort', () => {
  it('returns 3000 for node', () => {
    expect(getStackPort('node')).toBe(3000);
  });

  it('returns 3000 for fullstack', () => {
    expect(getStackPort('fullstack')).toBe(3000);
  });

  it('returns 8000 for python', () => {
    expect(getStackPort('python')).toBe(8000);
  });

  it('returns 80 for static', () => {
    expect(getStackPort('static')).toBe(80);
  });
});
