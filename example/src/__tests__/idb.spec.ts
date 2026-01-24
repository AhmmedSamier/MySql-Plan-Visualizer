import { describe, it, expect, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import idb from "../idb"
import type { Plan } from "../types"

describe("IndexedDB Service", () => {
  beforeEach(async () => {
    // Clear DB before each test
    await idb.clearPlans()
  })

  it("should save and retrieve plans", async () => {
    const plan: Plan = ["Plan A", "Source A", "Query A", "Date A"]

    // Save
    const id = await idb.savePlan(plan)
    expect(id).toBeDefined()

    // Retrieve list
    const plans = await idb.getPlans()
    expect(plans.length).toBe(1)
    expect(plans[0][0]).toBe("Plan A")
    // Check if ID is attached
    expect((plans[0] as any).id).toBe(id)

    // Retrieve single
    const fetched = await idb.getPlan(id)
    expect(fetched).toBeDefined()
    expect(fetched![0]).toBe("Plan A")
    expect((fetched as any).id).toBe(id)
  })

  it("should delete plans", async () => {
    const plan: Plan = ["Plan to delete", "Source", "Query", "Date"]
    const id = await idb.savePlan(plan)

    const planWithId = { ...plan, id } as Plan & { id: number }
    await idb.deletePlan(planWithId)

    const fetched = await idb.getPlan(id)
    expect(fetched).toBeUndefined()
  })

  it("should import plans without duplicates", async () => {
    const plan1: Plan = ["Plan 1", "Source 1", "Query 1", "Date 1"]
    const plan2: Plan = ["Plan 2", "Source 2", "Query 2", "Date 2"]

    await idb.savePlan(plan1)

    const plansToImport = [plan1, plan2]
    const [count, duplicates] = await idb.importPlans(plansToImport)

    expect(count).toBe(1) // only plan2 is new
    expect(duplicates).toBe(1) // plan1 is duplicate

    const allPlans = await idb.getPlans()
    expect(allPlans.length).toBe(2)
  })
})
