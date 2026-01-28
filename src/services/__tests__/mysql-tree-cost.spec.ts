import { describe, expect, test } from "vitest"
import { PlanService } from "@/services/plan-service"
import type { IPlanContent } from "@/interfaces"

describe("PlanService MySQL Tree Cost", () => {
  test("check single cost value mapping", () => {
    const planService = new PlanService()
    const source = `
-> Limit: 5 row(s)  (cost=10.00 rows=5)
`
    const r = planService.fromSource(source) as IPlanContent
    expect(r.Plan).toBeDefined()
    expect(r.Plan["Total Cost"]).toBe(10.0)
    // Should be undefined because single cost value implies Total Cost, and Startup Cost is unknown
    expect(r.Plan["Startup Cost"]).toBeUndefined()
  })

  test("maps integer cost to Total Cost", () => {
    const planService = new PlanService()
    const source = `-> Limit: 5 row(s)  (cost=10 rows=5)`
    const r = planService.fromSource(source) as IPlanContent
    expect(r.Plan["Total Cost"]).toBe(10)
    expect(r.Plan["Startup Cost"]).toBeUndefined()
  })

  test("maps scientific notation cost to Total Cost", () => {
    const planService = new PlanService()
    const source = `-> Limit: 5 row(s)  (cost=1e3 rows=5)`
    const r = planService.fromSource(source) as IPlanContent
    expect(r.Plan["Total Cost"]).toBe(1000)
    expect(r.Plan["Startup Cost"]).toBeUndefined()
  })

  test("handles Postgres style cost correctly (both startup and total)", () => {
    const planService = new PlanService()
    const source = `-> Limit: 5 row(s)  (cost=0.00..10.00 rows=5)`
    const r = planService.fromSource(source) as IPlanContent
    expect(r.Plan["Total Cost"]).toBe(10.00)
    expect(r.Plan["Startup Cost"]).toBe(0.00)
  })
})
