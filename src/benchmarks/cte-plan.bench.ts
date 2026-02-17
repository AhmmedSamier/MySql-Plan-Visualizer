import { bench, describe } from "vitest"
import { PlanService } from "../services/plan-service"
import { NodeProp } from "../enums"
import type { IPlanContent } from "../interfaces"
import _ from "lodash"

const planService = new PlanService()

function generateLargeCtePlan(
  cteCount: number,
  cteScanCount: number,
): IPlanContent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root: any = {
    [NodeProp.NODE_TYPE]: "Result",
    [NodeProp.PLANS]: [],
    [NodeProp.ACTUAL_ROWS]: 100,
    [NodeProp.PLAN_ROWS]: 100,
    [NodeProp.TOTAL_COST]: 100,
    [NodeProp.STARTUP_COST]: 0,
    [NodeProp.ACTUAL_TOTAL_TIME]: 100,
    [NodeProp.ACTUAL_STARTUP_TIME]: 0,
    [NodeProp.ACTUAL_LOOPS]: 1,
  }

  // Create CTEs
  for (let i = 0; i < cteCount; i++) {
    root[NodeProp.PLANS].push({
      [NodeProp.NODE_TYPE]: "CTE Scan",
      [NodeProp.PARENT_RELATIONSHIP]: "InitPlan",
      [NodeProp.SUBPLAN_NAME]: `CTE CTE ${i}`,
      [NodeProp.CTE_NAME]: `CTE ${i}`,
      [NodeProp.ACTUAL_TOTAL_TIME]: 10,
      [NodeProp.ACTUAL_LOOPS]: 1,
      [NodeProp.TOTAL_COST]: 10,
      [NodeProp.STARTUP_COST]: 0,
      [NodeProp.ACTUAL_STARTUP_TIME]: 0,
      [NodeProp.ACTUAL_ROWS]: 1,
      [NodeProp.PLAN_ROWS]: 1,
      [NodeProp.PLANS]: [],
    })
  }

  // Create many CTE Scan nodes
  for (let i = 0; i < cteScanCount; i++) {
    const cteIndex = i % cteCount
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node: any = {
      [NodeProp.NODE_TYPE]: "CTE Scan",
      [NodeProp.PARENT_RELATIONSHIP]: "Outer",
      [NodeProp.CTE_NAME]: `CTE ${cteIndex}`,
      [NodeProp.ACTUAL_ROWS]: 1,
      [NodeProp.PLAN_ROWS]: 1,
      [NodeProp.TOTAL_COST]: 10,
      [NodeProp.STARTUP_COST]: 0,
      [NodeProp.ACTUAL_TOTAL_TIME]: 1,
      [NodeProp.ACTUAL_STARTUP_TIME]: 0,
      [NodeProp.ACTUAL_LOOPS]: 1,
      [NodeProp.PLANS]: [],
    }

    root[NodeProp.PLANS].push(node)
  }

  return {
    Plan: root,
  }
}

// 50 CTEs, 2000 CTE Scans.
const largePlan = generateLargeCtePlan(50, 2000)

describe("CTE Performance", () => {
  bench("createPlan with many CTEs", () => {
    // Clone to avoid mutation side effects affecting subsequent runs
    const planCopy = _.cloneDeep(largePlan)
    planService.createPlan("benchmark", planCopy, "SELECT * FROM t")
  })
})
