import { describe, expect, test } from "vitest"
import { PlanService } from "@/services/plan-service"
import type { IPlanContent } from "@/interfaces"

describe("PlanService MySQL Tree", () => {
  test("can parse MySQL FORMAT=TREE plan", () => {
    const planService = new PlanService()
    const source = `
-> Nested loop inner join  (cost=1334.80 rows=100) (actual time=0.123..4.567 rows=100 loops=1)
    -> Filter: (t1.col1 = 5)  (cost=2.00 rows=1) (actual time=0.010..0.010 rows=1 loops=1)
        -> Index lookup on t1 using idx_col1 (col1=5)  (cost=2.00 rows=1) (actual time=0.005..0.005 rows=1 loops=1)
    -> Index lookup on t2 using idx_col2 (col2=t1.col2)  (cost=0.25 rows=100) (actual time=0.002..0.300 rows=100 loops=1)
`
    const r = planService.fromSource(source) as IPlanContent
    expect(r.Plan).toBeDefined()
    expect(r.Plan["Node Type"]).toBe("Nested loop inner join")
    expect(r.Plan["Total Cost"]).toBe(1334.8)
    expect(r.Plan["Plan Rows"]).toBe(100)
    expect(r.Plan["Actual Total Time"]).toBe(4.567)
  })
})
