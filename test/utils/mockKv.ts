/**
 * Mock KV namespace for testing
 * Simulates Cloudflare Workers KV behavior including TTL support
 */
export class MockKV {
  private store = new Map<string, { value: string; ttl?: number; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const item: { value: string; ttl?: number; expiresAt?: number } = { value };
    
    if (options?.expirationTtl) {
      item.ttl = options.expirationTtl;
      item.expiresAt = Date.now() + (options.expirationTtl * 1000);
    }
    
    this.store.set(key, item);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  // Additional utility methods for testing
  size(): number {
    return this.store.size;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}