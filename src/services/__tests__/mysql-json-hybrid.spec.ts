import { describe, expect, test } from "vitest"
import { PlanService } from "../plan-service"
import { NodeProp } from "@/enums"

describe("MySQL JSON Hybrid Format", () => {
  test("parses hybrid JSON format correctly", () => {
    const json = `
{
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "24.50"
    },
    "operation": "Sort: total_spent DESC",
    "inputs": [
      {
        "operation": "Filter: (total_spent > 100)",
        "inputs": [
          {
            "operation": "Aggregate: u.id",
            "cost_info": {
              "query_cost": "22.50"
            },
            "inputs": [
              {
                "operation": "Nested loop inner join",
                "inputs": [
                  {
                    "operation": "Index lookup on u using idx_active (active=1)",
                    "table_name": "u",
                    "access_type": "ref",
                    "rows_examined_per_scan": 10,
                    "cost_info": {
                      "read_cost": "2.00",
                      "eval_cost": "1.00",
                      "prefix_cost": "3.00"
                    }
                  },
                  {
                    "operation": "Index lookup on o using idx_user_id (user_id=u.id)",
                    "table_name": "o",
                    "access_type": "ref",
                    "rows_examined_per_scan": 5,
                    "cost_info": {
                      "read_cost": "12.50",
                      "eval_cost": "7.00",
                      "prefix_cost": "22.50"
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
`
    const planService = new PlanService()
    const result = planService.fromSource(json)
    const root = result.Plan

    // Check Root
    expect(root[NodeProp.NODE_TYPE]).toBe("Sort: total_spent DESC")
    expect(root[NodeProp.TOTAL_COST]).toBe(24.50)

    // Check Child (Filter)
    const filter = root[NodeProp.PLANS][0]
    expect(filter[NodeProp.NODE_TYPE]).toBe("Filter")
    expect(filter[NodeProp.FILTER]).toBe("(total_spent > 100)")

    // Check Child (Aggregate)
    const aggregate = filter[NodeProp.PLANS][0]
    expect(aggregate[NodeProp.NODE_TYPE]).toBe("Aggregate: u.id")
    expect(aggregate[NodeProp.TOTAL_COST]).toBe(22.50)

    // Check Child (Nested Loop)
    const join = aggregate[NodeProp.PLANS][0]
    expect(join[NodeProp.NODE_TYPE]).toBe("Nested loop inner join")

    // Check Leaves
    const u = join[NodeProp.PLANS][0]
    expect(u[NodeProp.RELATION_NAME]).toBe("u")
    expect(u[NodeProp.PLAN_ROWS]).toBe(10)
    expect(u[NodeProp.TOTAL_COST]).toBe(3.00) // 2.00 read + 1.00 eval

    const o = join[NodeProp.PLANS][1]
    expect(o[NodeProp.RELATION_NAME]).toBe("o")
    expect(o[NodeProp.PLAN_ROWS]).toBe(5)
    expect(o[NodeProp.TOTAL_COST]).toBe(19.50) // 12.50 read + 7.00 eval
  })
})
