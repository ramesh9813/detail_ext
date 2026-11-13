import { startExplanationController } from './explanation-controller';

const context = globalThis as typeof globalThis & { __aiSelectionExplainer?: () => void };
context.__aiSelectionExplainer?.();
context.__aiSelectionExplainer = startExplanationController();
