import type { AIProvider } from '../../shared/types';

interface Props {
  providers: AIProvider[];
  busy: boolean;
  onEdit: (provider: AIProvider) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onDiscover: (id: string) => void;
}
export function ProviderList({ providers, busy, onEdit, onDelete, onTest, onDiscover }: Props) {
  if (!providers.length) return <div className="empty">Empty</div>;
  return <div className="provider-list">{providers.map((provider) => <article className="provider-row" key={provider.id}>
    <div className="provider-name"><strong>{provider.name}</strong><span title={provider.selectedModel}>{provider.selectedModel}</span></div>
    <div className="actions"><button onClick={() => onEdit(provider)}>Edit</button><button title="Sends a request; provider charges may apply." disabled={busy} onClick={() => onTest(provider.id)}>Test</button><button aria-label="Find models" disabled={busy} onClick={() => onDiscover(provider.id)}>Discover</button><button className="text-button danger" aria-label={`Delete ${provider.name}`} onClick={() => onDelete(provider.id)}>Delete</button></div>
  </article>)}</div>;
}
