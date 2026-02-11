import { describe, expect, test } from "vitest"
import { PlanParser } from "../plan-parser"
import { NodeProp } from "@/enums"

describe("PlanParser Async", () => {
  const parser = new PlanParser()

  test("can parse simple text plan asynchronously", async () => {
    const source = `
-> Limit: 10 row(s)  (cost=1500.00 rows=10) (actual time=50.000..50.005 rows=10 loops=1)
    -> Sort: t1.col1, t2.col2, limit input to 10 row(s)  (cost=1500.00 rows=100) (actual time=50.000..50.002 rows=10 loops=1)
`
    const result = await parser.parseAsync(source)
    expect(result.Plan[NodeProp.NODE_TYPE]).toBe("Limit: 10 row(s)")
  })

  test("can parse large text plan asynchronously (chunked)", async () => {
    // Construct a large plan
    const sampleNode = `-> Nested loop inner join  (cost=1000.00 rows=100) (actual time=0.500..40.000 rows=100 loops=1)
    -> Filter: (t1.col1 > 50)  (cost=100.00 rows=50) (actual time=0.100..5.000 rows=50 loops=1)
        -> Table scan on t1  (cost=100.00 rows=1000) (actual time=0.050..4.000 rows=1000 loops=1)
`
    const source = Array(2000).fill(sampleNode).join("\n")
    const result = await parser.parseAsync(source)
    expect(result.Plan).toBeDefined()
    // It should have children
    expect(result.Plan[NodeProp.PLANS]?.length).toBeGreaterThan(0)
  })

  test("can parse JSON plan asynchronously", async () => {
     const source = JSON.stringify({
        Plan: {
            "Node Type": "Limit",
            "Total Cost": 10.0
        }
     })
     const result = await parser.parseAsync(source)
     expect(result.Plan[NodeProp.NODE_TYPE]).toBe("Limit")
  })
})
