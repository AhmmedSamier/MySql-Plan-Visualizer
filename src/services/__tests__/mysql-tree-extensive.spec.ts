import { describe, expect, test } from "vitest"
import { PlanService } from "@/services/plan-service"
import type { IPlanContent } from "@/interfaces"
import { NodeProp } from "@/enums"

describe("PlanService MySQL Tree Extensive", () => {
  test("can parse complex MySQL FORMAT=TREE plan", () => {
    const planService = new PlanService()
    // A more complex example with joins, sorts, limits, and actual timings
    const source = `
-> Limit: 10 row(s)  (cost=1500.00 rows=10) (actual time=50.000..50.005 rows=10 loops=1)
    -> Sort: t1.col1, t2.col2, limit input to 10 row(s)  (cost=1500.00 rows=100) (actual time=50.000..50.002 rows=10 loops=1)
        -> Stream results  (cost=1000.00 rows=100) (actual time=0.500..45.000 rows=100 loops=1)
            -> Nested loop inner join  (cost=1000.00 rows=100) (actual time=0.500..40.000 rows=100 loops=1)
                -> Filter: (t1.col1 > 50)  (cost=100.00 rows=50) (actual time=0.100..5.000 rows=50 loops=1)
                    -> Table scan on t1  (cost=100.00 rows=1000) (actual time=0.050..4.000 rows=1000 loops=1)
                -> Index lookup on t2 using idx_col1 (col1=t1.col1)  (cost=10.00 rows=2) (actual time=0.010..0.500 rows=2 loops=50)
`
    const r = planService.fromSource(source) as IPlanContent
    const plan = r.Plan

    // Root: Limit
    expect(plan[NodeProp.NODE_TYPE]).toBe("Limit: 10 row(s)")
    expect(plan[NodeProp.TOTAL_COST]).toBe(1500.00)
    expect(plan[NodeProp.PLAN_ROWS]).toBe(10)
    expect(plan[NodeProp.ACTUAL_ROWS]).toBe(10)
    expect(plan[NodeProp.ACTUAL_TOTAL_TIME]).toBe(50.005)

    // Child: Sort
    const sortNode = plan[NodeProp.PLANS][0]
    expect(sortNode[NodeProp.NODE_TYPE]).toBe("Sort: t1.col1, t2.col2, limit input to 10 row(s)")
    expect(sortNode[NodeProp.PLAN_ROWS]).toBe(100)

    // Child: Stream results
    const streamNode = sortNode[NodeProp.PLANS][0]
    expect(streamNode[NodeProp.NODE_TYPE]).toBe("Stream results")

    // Child: Nested Loop
    const joinNode = streamNode[NodeProp.PLANS][0]
    expect(joinNode[NodeProp.NODE_TYPE]).toBe("Nested loop inner join")

    // Join Children
    const joinChildren = joinNode[NodeProp.PLANS]
    expect(joinChildren).toHaveLength(2)

    const filterNode = joinChildren[0]
    expect(filterNode[NodeProp.NODE_TYPE]).toBe("Filter: (t1.col1 > 50)")
    expect(filterNode[NodeProp.PLAN_ROWS]).toBe(50)

    const tableScanNode = filterNode[NodeProp.PLANS][0]
    expect(tableScanNode[NodeProp.NODE_TYPE]).toBe("Table scan on t1") // Note: The regex might capture "Table scan on t1" as type
    // Or maybe "Table scan" if it parses "on t1" as extra?
    // In PlanService.fromText:
    // nodeRegex -> prefix + partial + type + ...
    // "-> Table scan on t1  (cost=..."
    // Type will capture "Table scan on t1".
    // Usually visualization might prefer "Table scan" and Relation "t1".
    // The current generic text parser doesn't know about MySQL "on table" syntax specifically, so it treats it as the Node Type.

    const indexLookupNode = joinChildren[1]
    expect(indexLookupNode[NodeProp.NODE_TYPE]).toContain("Index lookup on t2")
    expect(indexLookupNode[NodeProp.ACTUAL_LOOPS]).toBe(50)
  })

  test("can parse MySQL FORMAT=TREE plan with cost only (no actuals)", () => {
    const planService = new PlanService()
    const source = `
-> Nested loop inner join  (cost=10.00 rows=5)
    -> Table scan on t1  (cost=5.00 rows=5)
    -> Table scan on t2  (cost=5.00 rows=1)
`
    const r = planService.fromSource(source) as IPlanContent
    const plan = r.Plan

    expect(plan[NodeProp.NODE_TYPE]).toBe("Nested loop inner join")
    expect(plan[NodeProp.TOTAL_COST]).toBe(10.00)
    expect(plan[NodeProp.ACTUAL_TOTAL_TIME]).toBeUndefined()

    const children = plan[NodeProp.PLANS]
    expect(children).toHaveLength(2)
    expect(children[0][NodeProp.TOTAL_COST]).toBe(5.00)
  })

  test("can parse MySQL FORMAT=TREE plan with 'on table' syntax", () => {
      // This tests if we are okay with the Node Type being long.
      // Ideally we might want to extract table name if possible, but for now just testing current behavior.
      const planService = new PlanService()
      const source = `-> Index lookup on t1 using idx_a (a=10)  (cost=1.10 rows=1)`
      const r = planService.fromSource(source) as IPlanContent
      const plan = r.Plan
      expect(plan[NodeProp.NODE_TYPE]).toBe("Index lookup on t1 using idx_a (a=10)")
  })
})
