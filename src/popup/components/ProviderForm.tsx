import { useState, type FormEvent } from 'react';
import type { AIProvider } from '../../shared/types';
import { normalizeBaseUrl, providerOrigin } from '../../providers/url';

interface Props {
  provider?: AIProvider;
  onSave: (provider: AIProvider, preserveSavedKey?: boolean) => Promise<void>;
  onCancel: () => void;
}

export function ProviderForm({ provider, onSave, onCancel }: Props) {
  const [name, setName] = useState(provider?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '');
  const [models, setModels] = useState(provider?.models.join(', ') ?? '');
  const [replaceKey, setReplaceKey] = useState(!provider?.apiKey);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (!name.trim()) throw new Error('Enter a provider name.');
      const normalizedUrl = normalizeBaseUrl(baseUrl);
      const modelIds = [...new Set(models.split(/[,\n]/).map((value) => value.trim()).filter(Boolean))];
      if (!modelIds.length) throw new Error('Enter at least one model ID.');
      setSaving(true);
      // Call directly from the submit gesture so Chrome can show its permission prompt.
      const allowed = await chrome.permissions.request({ origins: [providerOrigin(normalizedUrl)] });
      if (!allowed) throw new Error('Allow access to this provider to save and send requests.');
      await onSave({
        id: provider?.id ?? crypto.randomUUID(), name: name.trim(), baseUrl: normalizedUrl,
        apiKey: replaceKey ? key.trim() : provider?.apiKey ?? '', models: modelIds,
        selectedModel: provider && modelIds.includes(provider.selectedModel) ? provider.selectedModel : modelIds[0],
      }, !replaceKey);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this provider.');
    } finally { setSaving(false); }
  }

  return <form className="provider-form" onSubmit={save}>
    <h3>{provider ? 'Edit' : 'Add'}</h3>
    <label>Name<input aria-label="Provider name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" maxLength={100} /></label>
    <label>Endpoint<input aria-label="API base URL" title="API root, usually ending in /v1. HTTP is limited to loopback servers." type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" spellCheck={false} /></label>
    <label>Key
      {replaceKey ? <input aria-label="API key" title="Optional for providers without authentication." type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Key" autoComplete="new-password" spellCheck={false} /> : <span className="saved-key"><span>Saved</span><button type="button" aria-label="Replace key" className="text-button" onClick={() => setReplaceKey(true)}>Replace</button></span>}
    </label>
    {provider?.apiKey && replaceKey && <button type="button" aria-label="Keep saved key" className="text-button" onClick={() => { setReplaceKey(false); setKey(''); }}>Keep</button>}
    <label>Models<textarea aria-label="Model IDs" title="Comma-separated model IDs." rows={2} value={models} onChange={(event) => setModels(event.target.value)} placeholder="model-id" spellCheck={false} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button aria-label="Save provider" type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button type="button" onClick={onCancel} disabled={saving}>Cancel</button></div>
  </form>;
}
