import { describe, it, expect, beforeEach } from 'vitest'
import "fake-indexeddb/auto"
import idb from '../idb'
import type { Plan } from '../types'

describe('IndexedDB Service', () => {
  beforeEach(async () => {
    // Clear DB before each test
    // Note: clearPlans/RecentPlans might fail if DB not open/upgraded yet in test env?
    // But getDb handles opening.
    await idb.clearPlans()
    await idb.clearRecentPlans()
  })

  it('should save and retrieve recent plans', async () => {
    const plan: Plan = ['Plan A', 'Source A', 'Query A', 'Date A']
    
    // Save
    const id = await idb.saveRecentPlan(plan)
    expect(id).toBeDefined()

    // Retrieve list
    const recents = await idb.getRecentPlans()
    expect(recents.length).toBe(1)
    expect(recents[0][0]).toBe('Plan A')
    // Check if ID is attached
    expect((recents[0] as any).id).toBe(id)

    // Retrieve single
    const fetched = await idb.getRecentPlan(id)
    expect(fetched).toBeDefined()
    expect(fetched![0]).toBe('Plan A')
    expect((fetched as any).id).toBe(id)
  })

  it('should limit recent plans to 10', async () => {
    // Add 11 plans
    for (let i = 1; i <= 11; i++) {
        const p: Plan = [`Plan ${i}`, `Source ${i}`, `Query ${i}`, `Date ${i}`]
        await idb.saveRecentPlan(p)
    }

    const recents = await idb.getRecentPlans()
    expect(recents.length).toBe(10)
    
    // getRecentPlans returns reversed (newest first)
    expect(recents[0][0]).toBe('Plan 11') 
    expect(recents[9][0]).toBe('Plan 2') 
  })

  it('should save arrays correctly', async () => {
      const plan: Plan = ['Plan Array', 'Source', 'Query', 'Date']
      const id = await idb.saveRecentPlan(plan)
      const fetched = await idb.getRecentPlan(id)
      
      expect(Array.isArray(fetched)).toBe(true)
      expect(fetched!.length).toBeGreaterThanOrEqual(4)
      expect(fetched![0]).toBe('Plan Array')
  })
})
