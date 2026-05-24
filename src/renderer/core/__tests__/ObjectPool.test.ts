import { describe, it, expect, vi } from 'vitest'
import { ObjectPool } from '../ObjectPool'

describe('ObjectPool', () => {
  const factory = vi.fn(() => ({ id: factory.mock.calls.length }))
  const reset = vi.fn()

  function createPool() {
    factory.mockClear()
    reset.mockClear()
    factory.mockImplementation(() => ({ id: factory.mock.calls.length }))
    return new ObjectPool(factory, reset)
  }

  describe('acquire / release', () => {
    it('acquire는 factory로 새 객체 생성', () => {
      const pool = createPool()
      const obj = pool.acquire()
      expect(obj).toBeDefined()
      expect(factory).toHaveBeenCalledTimes(1)
    })

    it('release 후 acquire하면 기존 객체 재사용', () => {
      const pool = createPool()
      const obj = pool.acquire()
      pool.release(obj)
      expect(reset).toHaveBeenCalledWith(obj)
      const obj2 = pool.acquire()
      expect(obj2).toBe(obj)
      // factory는 최초 1회만 호출
      expect(factory).toHaveBeenCalledTimes(1)
    })
  })

  describe('setActiveCount', () => {
    it('0에서 증가 시 factory 호출', () => {
      const pool = createPool()
      pool.setActiveCount(3)
      expect(pool.activeCount).toBe(3)
      expect(factory).toHaveBeenCalledTimes(3)
    })

    it('감소 시 활성 개수 줄어들고 풀에 보관', () => {
      const pool = createPool()
      pool.setActiveCount(5)
      pool.setActiveCount(2)
      expect(pool.activeCount).toBe(2)
      // factory는 5번만 호출 (파괴 없음)
      expect(factory).toHaveBeenCalledTimes(5)
    })

    it('감소 후 재증가 시 factory 추가 호출 없음 (재사용)', () => {
      const pool = createPool()
      pool.setActiveCount(5)
      pool.setActiveCount(2)
      factory.mockClear()
      pool.setActiveCount(5)
      expect(pool.activeCount).toBe(5)
      expect(factory).not.toHaveBeenCalled()
    })

    it('0으로 설정 시 활성 개수 0', () => {
      const pool = createPool()
      pool.setActiveCount(3)
      pool.setActiveCount(0)
      expect(pool.activeCount).toBe(0)
    })

    it('같은 수로 설정 시 변화 없음', () => {
      const pool = createPool()
      pool.setActiveCount(3)
      factory.mockClear()
      pool.setActiveCount(3)
      expect(pool.activeCount).toBe(3)
      expect(factory).not.toHaveBeenCalled()
    })

    it('감소 시 reset 콜백 호출', () => {
      const pool = createPool()
      pool.setActiveCount(3)
      reset.mockClear()
      pool.setActiveCount(1)
      expect(reset).toHaveBeenCalledTimes(2)
    })
  })

  describe('forEachActive', () => {
    it('활성 객체만 순회', () => {
      const pool = createPool()
      pool.setActiveCount(3)
      const visited: unknown[] = []
      pool.forEachActive((item) => visited.push(item))
      expect(visited).toHaveLength(3)
    })

    it('감소 후 활성 객체만 순회', () => {
      const pool = createPool()
      pool.setActiveCount(5)
      pool.setActiveCount(2)
      const visited: unknown[] = []
      pool.forEachActive((item) => visited.push(item))
      expect(visited).toHaveLength(2)
    })
  })

  describe('reset 콜백 미제공', () => {
    it('reset 없어도 정상 동작', () => {
      const f = vi.fn(() => ({ v: f.mock.calls.length }))
      const pool = new ObjectPool(f)
      pool.setActiveCount(2)
      pool.setActiveCount(0)
      expect(pool.activeCount).toBe(0)
    })
  })
})
