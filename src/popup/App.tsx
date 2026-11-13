import { useEffect, useRef, useState } from 'react';
import type { AIProvider, ExtensionSettings } from '../shared/types';
import { readSettings, saveSettings, subscribeSettings } from '../storage/settings-store';
import { deleteProvider, resetPrompt, savePrompt, selectModel, selectProvider, upsertProvider } from '../storage/provider-store';
import { sendMessage } from '../messaging/send-message';
import { ActiveConfiguration } from './components/ActiveConfiguration';
import { ProviderForm } from './components/ProviderForm';
import { ProviderList } from './components/ProviderList';
import { PromptEditor } from './components/PromptEditor';

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [editing, setEditing] = useState<AIProvider | null | undefined>(undefined);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const refreshVersion = useRef(0);

  useEffect(() => {
    let alive = true;
    const refresh = () => { const version = ++refreshVersion.current; void readSettings().then((value) => { if (alive && version === refreshVersion.current) setSettings(value); }).catch(() => {
      if (alive) { setFailed(true); setNotice('Could not load settings. Reopen the extension to try again.'); }
    }); };
    refresh();
    const unsubscribe = subscribeSettings(refresh);
    return () => { alive = false; unsubscribe(); };
  }, []);

  function persist(transform: (current: ExtensionSettings) => ExtensionSettings, message = 'Settings saved.') {
    const operation = writes.current.catch(() => undefined).then(async () => {
      const next = transform(await readSettings());
      await saveSettings(next);
      ++refreshVersion.current;
      setSettings(next);
      setFailed(false);
      setNotice(message);
    });
    writes.current = operation;
    return operation;
  }
  async function run(action: () => Promise<void>) {
    try { await action(); } catch (cause) {
      setFailed(true);
      setNotice(cause instanceof Error ? cause.message : 'Could not save settings. Please try again.');
    }
  }
  async function checkProvider(providerId: string, discover: boolean) {
    setBusy(true); setFailed(false); setNotice(discover ? 'Looking for models...' : 'Testing connection...');
    try {
      const snapshot = (await readSettings()).providers.find((provider) => provider.id === providerId);
      if (!snapshot) throw new Error('This provider was removed.');
      const response = await sendMessage({ type: discover ? 'DISCOVER_MODELS' : 'TEST_PROVIDER', providerId });
      if (response.error) throw new Error(response.error);
      if (discover) {
        if (!response.models?.length) throw new Error('No models were found. You can still enter model IDs manually.');
        const models = response.models;
        await persist((latest) => {
          const provider = latest.providers.find((item) => item.id === providerId);
          if (!provider) throw new Error('This provider was removed.');
          if (provider.baseUrl !== snapshot.baseUrl || provider.apiKey !== snapshot.apiKey) throw new Error('The provider changed during discovery. Find models again.');
          return upsertProvider(latest, { ...provider, models: [...new Set([...provider.models, ...models])] });
        }, `${models.length} model IDs found. Choose an active model to use it.`);
      } else { setNotice('Connection successful. The selected model responded.'); }
    } catch (cause) {
      setFailed(true); setNotice(cause instanceof Error ? cause.message : 'The provider could not be reached.');
    } finally { setBusy(false); }
  }

  const active = settings?.providers.find((provider) => provider.id === settings.activeProviderId);
  return <main>
    <header className="app-header"><span className="brand-icon" aria-hidden="true">&#10022;</span><div><h1>Selection Explainer</h1><p>Clarity, right where you read.</p></div><span className="version">v1.0</span></header>
    {notice && <p className={`notice ${failed ? 'error' : ''}`} role={failed ? 'alert' : 'status'}>{notice}</p>}
    {!settings ? <p className="loading" role="status">Loading your settings...</p> : <>
      <ActiveConfiguration settings={settings} active={active}
        onProvider={(id) => void run(() => persist((current) => selectProvider(current, id)))}
        onModel={(model) => { if (active) void run(() => persist((current) => selectModel(current, active.id, model))); }}
        onEnabled={(enabled) => void run(() => persist((current) => ({ ...current, enabled }), enabled ? 'Automatic explanations enabled.' : 'Automatic explanations paused.'))} />
      <section className="section">
        <div className="section-heading"><h2>Your providers</h2>{editing === undefined && <button className="text-button" onClick={() => setEditing(null)}>+ Add provider</button>}</div>
        {editing !== undefined ? <ProviderForm key={editing?.id ?? 'new'} provider={editing ?? undefined} onCancel={() => setEditing(undefined)} onSave={async (provider, preserveSavedKey) => {
          await persist((current) => {
            const saved = current.providers.find((item) => item.id === provider.id);
            if (editing && !saved) throw new Error('This provider was removed. Cancel and add it again.');
            return upsertProvider(current, {
              ...provider,
              apiKey: preserveSavedKey && saved ? saved.apiKey : provider.apiKey,
              selectedModel: saved && provider.models.includes(saved.selectedModel) ? saved.selectedModel : provider.selectedModel,
            });
          }, 'Provider saved. Select text on a webpage to try it.'); setEditing(undefined);
        }} /> : <ProviderList providers={settings.providers} busy={busy} onEdit={setEditing}
          onDelete={(id) => void run(() => persist((current) => deleteProvider(current, id), 'Provider deleted.'))}
          onTest={(id) => void checkProvider(id, false)} onDiscover={(id) => void checkProvider(id, true)} />}
        <p className="hint">Connection tests send a short request and may incur provider charges. Model discovery does not test model access.</p>
      </section>
      <PromptEditor prompt={settings.customPrompt} onSave={(prompt) => run(() => persist((current) => savePrompt(current, prompt), 'Explanation prompt saved.'))} onReset={() => run(() => persist((current) => resetPrompt(current), 'Default explanation prompt restored.'))} />
      <footer className="privacy"><strong>Your text, your provider.</strong><p>When enabled, selected webpage text and your prompt are sent to your configured provider. Full pages and editable fields are not collected. Keys stay in local extension storage, which is not encrypted against every threat on your device. No analytics or tracking.</p><p>Works on ordinary HTTP/HTTPS pages. Chrome pages, the Web Store, and inaccessible frames are unsupported.</p></footer>
    </>}
  </main>;
}
