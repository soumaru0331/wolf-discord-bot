export class GameTimer {
  private timeout: NodeJS.Timeout | null = null;

  schedule(ms: number, callback: () => void): void {
    this.clear();
    this.timeout = setTimeout(callback, ms);
  }

  clear(): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  isRunning(): boolean {
    return this.timeout !== null;
  }
}
