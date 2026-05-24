export class ObjectPool<T> {
  private readonly _factory: () => T
  private readonly _reset?: (item: T) => void
  private _active: T[] = []
  private _inactive: T[] = []

  constructor(factory: () => T, reset?: (item: T) => void) {
    this._factory = factory
    this._reset = reset
  }

  get activeCount(): number {
    return this._active.length
  }

  acquire(): T {
    if (this._inactive.length > 0) {
      const item = this._inactive.pop()!
      this._active.push(item)
      return item
    }
    const item = this._factory()
    this._active.push(item)
    return item
  }

  release(item: T): void {
    const idx = this._active.indexOf(item)
    if (idx === -1) return
    this._active.splice(idx, 1)
    this._reset?.(item)
    this._inactive.push(item)
  }

  setActiveCount(n: number): void {
    // 현재보다 줄여야 하면 뒤에서부터 release
    while (this._active.length > n) {
      const item = this._active.pop()!
      this._reset?.(item)
      this._inactive.push(item)
    }
    // 현재보다 늘려야 하면 acquire
    while (this._active.length < n) {
      this.acquire()
    }
  }

  forEachActive(fn: (item: T, index: number) => void): void {
    for (let i = 0; i < this._active.length; i++) {
      fn(this._active[i], i)
    }
  }
}
