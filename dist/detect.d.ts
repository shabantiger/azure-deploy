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
export declare function detectStack(workspaceDir: string, dockerfilePath: string): Promise<DetectResult>;
/**
 * Generates a Dockerfile for the given stack.
 */
export declare function generateDockerfile(stack: 'node' | 'python' | 'static' | 'fullstack', outputPath: string): void;
/**
 * Returns the default container port for the given stack.
 */
export declare function getStackPort(stack: 'node' | 'python' | 'static' | 'fullstack'): number;
