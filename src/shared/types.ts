export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  selectedModel: string;
}
export interface ExtensionSettings {
  providers: AIProvider[];
  activeProviderId: string | null;
  customPrompt: string;
  enabled: boolean;
}
export interface SettingsStatus {
  enabled: boolean;
  configured: boolean;
  providerName?: string;
  model?: string;
}
export type ExtensionMessage =
  | { type: 'GET_SETTINGS_STATUS' }
  | { type: 'EXPLAIN_TEXT'; requestId: string; selectedText: string }
  | { type: 'CANCEL_EXPLANATION'; requestId: string }
  | { type: 'TEST_PROVIDER'; providerId: string }
  | { type: 'DISCOVER_MODELS'; providerId: string };
export interface MessageResponse {
  requestId?: string;
  content?: string;
  models?: string[];
  status?: SettingsStatus;
  error?: string;
}
