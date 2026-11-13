import type { AIProvider, ExtensionSettings } from '../../shared/types';

interface Props {
  settings: ExtensionSettings;
  active?: AIProvider;
  onProvider: (id: string) => void;
  onModel: (model: string) => void;
  onEnabled: (enabled: boolean) => void;
}
export function ActiveConfiguration({ settings, active, onProvider, onModel, onEnabled }: Props) {
  return <section className="section active-section">
    <div className="section-heading"><h2>Automatic explanations</h2><label className="toggle"><input aria-label="Enable automatic explanations" type="checkbox" checked={settings.enabled} onChange={(event) => onEnabled(event.target.checked)} /><span /></label></div>
    <p className="hint">Select text on a webpage. An explanation appears nearby.</p>
    <label>Active provider<select value={settings.activeProviderId ?? ''} onChange={(event) => onProvider(event.target.value)}><option value="" disabled>Choose a provider</option>{settings.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
    {active && <label>Active model<select value={active.selectedModel} onChange={(event) => onModel(event.target.value)}>{active.models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>}
    <div className="status"><span className={`status-dot ${settings.enabled && active ? 'ready' : ''}`} /><span>{!settings.enabled ? 'Paused' : active ? `Ready - ${active.name}` : 'Add a provider to get started'}</span></div>
  </section>;
}
