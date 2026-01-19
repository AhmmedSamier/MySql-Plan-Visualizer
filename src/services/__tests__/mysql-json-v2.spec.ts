import { describe, expect, test } from "vitest"
import { PlanService } from "@/services/plan-service"
import type { IPlanContent } from "@/interfaces"
import { NodeProp } from "@/enums"

describe("PlanService MySQL JSON V2", () => {
  test("can parse MySQL JSON V2 plan with execution_plan wrapper", () => {
    const planService = new PlanService()
    const source = JSON.stringify({
      query_block: {
        select_id: 1,
        cost_info: {
          query_cost: "500.00",
        },
        execution_plan: {
          steps: [
            {
              substeps: [
                {
                  name: "join",
                  cost_info: { query_cost: "400.00" },
                  inputs: [
                    {
                      name: "ALL",
                      table_name: "t1",
                      cost_info: { query_cost: "100.00" },
                    },
                    {
                      name: "range",
                      table_name: "t2",
                      cost_info: { query_cost: "200.00" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    })

    const r = planService.fromSource(source) as IPlanContent
    const plan = r.Plan

    expect(plan).toBeDefined()
    // The top node should probably be Select #1
    expect(plan[NodeProp.NODE_TYPE]).toBe("Select #1")

    // It should have children
    const children = plan[NodeProp.PLANS]
    expect(children).toBeDefined()
    expect(children.length).toBeGreaterThan(0)

    // We expect to find the join node down the tree
    // Note: The structure might be Select #1 -> execution_plan (maybe?) -> ...
    // Or Select #1 -> join if we flatten properly.

    // For now, let's just check if we can find the join node anywhere in the descendants.

    // Helper to find node by type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findNode = (node: any, type: string): any => {
      if (node[NodeProp.NODE_TYPE] === type) return node
      if (node[NodeProp.PLANS]) {
        for (const child of node[NodeProp.PLANS]) {
          const found = findNode(child, type)
          if (found) return found
        }
      }
      return null
    }

    const joinNode = findNode(plan, "join")
    expect(joinNode).toBeDefined()
    expect(joinNode[NodeProp.TOTAL_COST]).toBe(400.00)

    // Check Root Cost (should come from query_block cost_info)
    expect(plan[NodeProp.TOTAL_COST]).toBe(500.00)

    // The root should have children (the execution plan steps)
    expect(plan[NodeProp.PLANS]).toBeDefined()
    expect(plan[NodeProp.PLANS]?.length).toBeGreaterThan(0)
  })

  test("can parse MySQL JSON V2 plan (pure execution_plan)", () => {
    const planService = new PlanService()
    const source = JSON.stringify({
      execution_plan: {
        steps: [
          {
            name: "join",
            cost_info: { query_cost: "50.00" },
            inputs: [
              {
                name: "filesort",
                cost_info: { query_cost: "20.00" },
                inputs: [
                  {
                    name: "table_scan",
                    table_name: "t1",
                    cost_info: { query_cost: "10.00" },
                  },
                ],
              },
              {
                name: "table_scan",
                table_name: "t2",
                cost_info: { query_cost: "15.00" },
              },
            ],
          },
        ],
      },
    })

    const r = planService.fromSource(source) as IPlanContent
    const plan = r.Plan

    // ParseV2 calls itself recursively.
    expect(plan[NodeProp.NODE_TYPE]).toBe("Unknown")

    const steps = plan[NodeProp.PLANS]
    expect(steps).toHaveLength(1)

    const joinNode = steps[0]
    expect(joinNode[NodeProp.NODE_TYPE]).toBe("join")
    expect(joinNode[NodeProp.TOTAL_COST]).toBe(50.0)

    const joinInputs = joinNode[NodeProp.PLANS]
    expect(joinInputs).toHaveLength(2)

    const sortNode = joinInputs[0]
    expect(sortNode[NodeProp.NODE_TYPE]).toBe("filesort")

    const t2Node = joinInputs[1]
    expect(t2Node[NodeProp.NODE_TYPE]).toBe("table_scan")
    expect(t2Node[NodeProp.RELATION_NAME]).toBe("t2")
  })
})
