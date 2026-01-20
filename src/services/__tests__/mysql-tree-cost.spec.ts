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
    expect(r.Plan["Total Cost"]).toBe(10.00)
    // Should be undefined because single cost value implies Total Cost, and Startup Cost is unknown
    expect(r.Plan["Startup Cost"]).toBeUndefined()
  })
})
