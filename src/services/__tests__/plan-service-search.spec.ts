import { describe, expect, test } from "vitest"
import { PlanService } from "@/services/plan-service"
import { NodeProp } from "@/enums"
import type { IPlanContent } from "@/interfaces"

describe("PlanService Search Optimization", () => {
  test("calculates SEARCH_STRING during plan creation", () => {
    const planService = new PlanService()
    const planContent: IPlanContent = {
      Plan: {
        [NodeProp.NODE_TYPE]: "Index Scan",
        [NodeProp.RELATION_NAME]: "users",
        [NodeProp.ALIAS]: "u",
        [NodeProp.INDEX_NAME]: "users_pkey",
        [NodeProp.FILTER]: "(id > 100)",
        [NodeProp.ACTUAL_ROWS]: 10,
        [NodeProp.PLAN_ROWS]: 10,
        [NodeProp.TOTAL_COST]: 100,
        [NodeProp.PLANS]: [],
      },
    }

    const plan = planService.createPlan("test plan", planContent, "SELECT * FROM users")
    const node = plan.content.Plan

    expect(node[NodeProp.SEARCH_STRING]).toBeDefined()
    const searchString = node[NodeProp.SEARCH_STRING]

    expect(searchString).toContain("index scan")
    expect(searchString).toContain("users")
    expect(searchString).toContain("u")
    expect(searchString).toContain("users_pkey")
    expect(searchString).toContain("(id > 100)")
  })

  test("calculates SEARCH_STRING correctly for CTEs", () => {
      const planService = new PlanService()
      const planContent: IPlanContent = {
        Plan: {
          [NodeProp.NODE_TYPE]: "Result",
          [NodeProp.TOTAL_COST]: 100,
          [NodeProp.PLANS]: [
              {
                  [NodeProp.NODE_TYPE]: "CTE Scan",
                  [NodeProp.PARENT_RELATIONSHIP]: "InitPlan",
                  [NodeProp.SUBPLAN_NAME]: "CTE my_cte",
                  [NodeProp.CTE_NAME]: "my_cte",
                  [NodeProp.ALIAS]: "cte_alias",
                  [NodeProp.TOTAL_COST]: 50,
                  [NodeProp.PLANS]: []
              }
          ],
        },
      }

      const plan = planService.createPlan("cte plan", planContent, "WITH my_cte AS ... SELECT * FROM my_cte")
      // CTEs are extracted to plan.ctes
      const cteNode = plan.ctes[0]
      expect(cteNode).toBeDefined()

      const searchString = cteNode[NodeProp.SEARCH_STRING]
      expect(searchString).toContain("cte scan")
      expect(searchString).toContain("my_cte")
      expect(searchString).toContain("cte_alias")
    })
})
