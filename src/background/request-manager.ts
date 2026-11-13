interface RunningRequest {
  requestId: string;
  controller: AbortController;
}

/** Ephemeral cancellation only: settings and credentials always come from storage. */
export class RequestManager {
  private readonly active = new Map<string, RunningRequest>();
  private readonly startedAt = new Map<string, number>();

  begin(owner: string, requestId: string, now = Date.now()): AbortController {
    this.prune(now);
    const previous = this.startedAt.get(owner);
    if (previous !== undefined && now - previous < 350) {
      throw new Error('Please wait a moment before selecting more text.');
    }
    this.cancel(owner);
    if (this.active.size >= 12) {
      throw new Error('Too many explanations are running. Try again shortly.');
    }
    const controller = new AbortController();
    this.active.set(owner, { requestId, controller });
    this.startedAt.set(owner, now);
    return controller;
  }

  cancel(owner: string, requestId?: string): void {
    const current = this.active.get(owner);
    if (current && (!requestId || current.requestId === requestId)) {
      current.controller.abort();
      this.active.delete(owner);
    }
  }

  finish(owner: string, requestId: string): void {
    if (this.active.get(owner)?.requestId === requestId) this.active.delete(owner);
  }

  cancelAll(): void {
    for (const owner of this.active.keys()) this.cancel(owner);
  }

  private prune(now: number): void {
    for (const [owner, started] of this.startedAt) {
      if (now - started > 60000 && !this.active.has(owner)) this.startedAt.delete(owner);
    }
  }
}
