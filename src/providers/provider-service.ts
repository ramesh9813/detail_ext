/** Validate an API root before permissions are requested or credentials are used. */
export function normalizeBaseUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Enter a valid API base URL, such as https://api.example.com/v1.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('Use HTTPS for remote providers. HTTP is allowed only for loopback servers.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('API base URLs cannot include credentials, query parameters, or fragments.');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (/\/(?:chat\/completions|models)$/i.test(url.pathname)) {
    throw new Error('Enter the API root (for example /v1), without /chat/completions or /models.');
  }
  return url.toString().replace(/\/+$/, '');
}

/** Chrome host patterns cover every port at the selected host. */
export function providerOrigin(baseUrl: string): string {
  const url = new URL(normalizeBaseUrl(baseUrl));
  return `${url.protocol}//${url.hostname}/*`;
}

export async function requireProviderPermission(baseUrl: string): Promise<void> {
  const granted = await chrome.permissions.contains({ origins: [providerOrigin(baseUrl)] });
  if (!granted) {
    throw new Error('Allow access to this provider in the extension settings, then try again.');
  }
}
