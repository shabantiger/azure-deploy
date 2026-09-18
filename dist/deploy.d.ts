import { ActionInputs, ActionOutputs, DetectResult } from './types';
/**
 * Main deploy orchestration.
 */
export declare function deploy(inputs: ActionInputs, detection: DetectResult): Promise<ActionOutputs>;
