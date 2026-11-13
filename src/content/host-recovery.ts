export function recoverCardHost(host: HTMLElement): () => void {
  // Observe the host's parent, not every streamed token on the page.
  const observer = new MutationObserver(() => {
    if (host.isConnected || !document.documentElement) return;
    document.documentElement.append(host);
    observeRoot();
  });
  function observeRoot() {
    observer.disconnect();
    observer.observe(document, { childList: true });
    if (document.documentElement) observer.observe(document.documentElement, { childList: true });
  }
  observeRoot();
  return () => observer.disconnect();
}
