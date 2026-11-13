/**
 * Native Chrome MV3 API surface used by this extension (Chrome 102+).
 * Kept local so production type checking needs no external browser type package.
 * Messages and storage values cross trust boundaries as unknown unless contracted.
 */
declare namespace chrome {
  interface ChromeEvent<Listener> {
    addListener(callback: Listener): void;
    removeListener(callback: Listener): void;
    hasListener(callback: Listener): boolean;
    hasListeners(): boolean;
  }

  namespace runtime {
    const id: string;
    const lastError: { message?: string } | undefined;
    interface MessageSender {
      id?: string;
      url?: string;
      origin?: string;
      frameId?: number;
      documentId?: string;
      tab?: tabs.Tab;
    }
    type MessageListener = (
      message: unknown,
      sender: MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => boolean | void;
    const onMessage: ChromeEvent<MessageListener>;
    function getURL(path: string): string;
    function sendMessage(
      message: import('./types').ExtensionMessage,
    ): Promise<import('./types').MessageResponse | undefined>;
    function sendMessage(
      message: import('./types').ExtensionMessage,
      callback: (response: import('./types').MessageResponse | undefined) => void,
    ): void;
  }

  namespace storage {
    interface StorageChange {
      oldValue?: unknown;
      newValue?: unknown;
    }
    interface StorageArea {
      get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
      setAccessLevel(options: { accessLevel: 'TRUSTED_CONTEXTS' | 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }): Promise<void>;
    }
    const local: StorageArea;
    const onChanged: ChromeEvent<(
      changes: Record<string, StorageChange>,
      areaName: string,
    ) => void>;
  }

  namespace permissions {
    interface Permissions {
      origins?: string[];
      permissions?: string[];
    }
    function contains(permissions: Permissions): Promise<boolean>;
    function request(permissions: Permissions): Promise<boolean>;
    function remove(permissions: Permissions): Promise<boolean>;
  }

  namespace scripting {
    function executeScript(options: {
      target: { tabId: number; allFrames?: boolean };
      files: string[];
    }): Promise<unknown[]>;
  }
  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      active?: boolean;
      windowId?: number;
    }
    interface QueryInfo {
      active?: boolean;
      currentWindow?: boolean;
      url?: string | string[];
    }
    function query(queryInfo: QueryInfo): Promise<Tab[]>;
    function sendMessage(tabId: number, message: unknown): Promise<unknown>;
    const onRemoved: ChromeEvent<(tabId: number, removeInfo: { windowId: number; isWindowClosing: boolean }) => void>;
  }
}
