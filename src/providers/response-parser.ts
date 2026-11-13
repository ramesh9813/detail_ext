function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseExplanation(value: unknown): string {
  if (!record(value) || !Array.isArray(value.choices) || !record(value.choices[0])) {
    throw new Error('The provider returned an unsupported response format.');
  }
  const message = value.choices[0].message;
  if (!record(message) || typeof message.content !== 'string') {
    throw new Error('The provider returned an unsupported response format.');
  }
  const content = message.content.trim();
  if (!content) throw new Error('The model returned an empty explanation. Try another selection or model.');
  return content;
}

export function parseModels(value: unknown): string[] {
  if (!record(value) || !Array.isArray(value.data)) {
    throw new Error('Model discovery is unsupported. Enter model IDs manually.');
  }
  const models = value.data.flatMap((entry: unknown) =>
    record(entry) && typeof entry.id === 'string' && entry.id.trim() ? [entry.id.trim()] : [],
  );
  if (!models.length) throw new Error('No models were discovered. Enter a model ID manually.');
  return [...new Set(models)].sort();
}
