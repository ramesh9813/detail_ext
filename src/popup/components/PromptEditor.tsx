import { useEffect, useState } from 'react';

interface Props { prompt: string; onSave: (prompt: string) => Promise<void>; onReset: () => Promise<void> }
export function PromptEditor({ prompt, onSave, onReset }: Props) {
  const [draft, setDraft] = useState(prompt);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(prompt), [prompt]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }
  return <section className="section">
    <h2>Custom Explanation Prompt</h2>
    <p className="hint">Customize how AI explains selected text.</p>
    <label className="sr-only" htmlFor="prompt">Custom Explanation Prompt</label>
    <textarea id="prompt" rows={5} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Leave empty to use the default explanation prompt." />
    <div className="actions"><button disabled={busy} onClick={() => void run(() => onSave(draft))}>Save prompt</button><button className="text-button" disabled={busy} onClick={() => void run(onReset)}>Reset to default</button></div>
  </section>;
}
