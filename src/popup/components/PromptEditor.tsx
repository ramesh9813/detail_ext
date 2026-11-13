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
    <h2>Prompt</h2>
    <label className="sr-only" htmlFor="prompt">Custom Explanation Prompt</label>
    <textarea id="prompt" rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Default" />
    <div className="actions"><button aria-label="Save prompt" disabled={busy} onClick={() => void run(() => onSave(draft))}>Save</button><button aria-label="Reset to default" className="text-button" disabled={busy} onClick={() => void run(onReset)}>Reset</button></div>
  </section>;
}
