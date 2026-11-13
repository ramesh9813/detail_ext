import { useState } from 'react';
import type { CustomPrompt, ExtensionSettings } from '../../shared/types';
import { deletePrompt, togglePrompt, upsertPrompt } from '../../storage/prompt-store';
import { DEFAULT_PROMPT } from '../../shared/constants';

interface Props {
  settings: ExtensionSettings;
  onSave: (change: (settings: ExtensionSettings) => ExtensionSettings, message?: string) => Promise<void>;
}

export function PromptManager({ settings, onSave }: Props) {
  const [editing, setEditing] = useState<CustomPrompt | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(0);
  const active = settings.prompts.filter(prompt => prompt.enabled).length;

  function edit(prompt?: CustomPrompt) {
    setEditing(prompt ?? { id: crypto.randomUUID(), name: '', content: '', enabled: true });
    setName(prompt?.name ?? '');
    setContent(prompt?.content ?? '');
    setError('');
  }

  async function run(change: (settings: ExtensionSettings) => ExtensionSettings) {
    setBusy(true); setError(''); setSaved(0);
    try {
      await onSave(change, 'Saved');
      setSaved(Date.now());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
      return false;
    } finally { setBusy(false); }
  }

  async function save() {
    if (!editing) return;
    if (await run(current => upsertPrompt(current, {
      ...editing, name, content,
      enabled: current.prompts.find(prompt => prompt.id === editing.id)?.enabled ?? editing.enabled,
    }))) setEditing(null);
  }

  return <section className="section prompts-section" aria-label="Custom prompts">
    <div className="section-heading"><h2>Prompts <span className="prompt-count" title="All enabled prompts are applied to each selection in one request.">{active ? `${active} active` : 'Default'}</span></h2>
      <button type="button" aria-label="Add prompt" className="text-button" onClick={() => edit()} disabled={busy}>Add</button></div>
    <div className="prompt-list">{settings.prompts.map(prompt => <article className="prompt-row" key={prompt.id}>
      <div className="prompt-heading"><label className="prompt-check"><input type="checkbox" aria-label={`Enable ${prompt.name}`} checked={prompt.enabled} disabled={busy} onChange={event => { const enabled = event.target.checked; void run(current => togglePrompt(current, prompt.id, enabled)); }} /><strong>{prompt.name}</strong></label>
        <div className="actions"><button type="button" aria-label={`Edit prompt ${prompt.name}`} onClick={() => edit(prompt)} disabled={busy}>Edit</button><button type="button" aria-label={`Delete prompt ${prompt.name}`} className="text-button danger" disabled={busy} onClick={() => void run(current => deletePrompt(current, prompt.id))}>Delete</button></div></div>
      <p className="prompt-preview">{prompt.content}</p>
    </article>)}</div>
    {editing && <form className="prompt-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label>Name<input aria-label="Prompt name" autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={100} /></label>
      <label>Prompt<textarea aria-label="Prompt content" rows={4} value={content} onChange={event => setContent(event.target.value)} /></label>
      <div className="actions"><button type="submit" aria-label="Save prompt" className="primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button type="button" aria-label="Reset to default" className="text-button" onClick={() => setContent(DEFAULT_PROMPT)}>Reset</button></div>
    </form>}
    {saved > 0 && <span className="prompt-saved" role="status" key={saved}>Saved</span>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
