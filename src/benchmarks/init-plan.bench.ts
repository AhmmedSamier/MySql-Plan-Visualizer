import { bench, describe } from "vitest"
import { PlanService } from "@/services/plan-service"
import { NodeProp } from "@/enums"
import type { IPlanContent } from "@/interfaces"
import _ from "lodash"

const planService = new PlanService()

function generateLargePlan(
  initPlanCount: number,
  normalNodeCount: number,
): IPlanContent {
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

  // Create InitPlans
  for (let i = 0; i < initPlanCount; i++) {
    root[NodeProp.PLANS].push({
      [NodeProp.NODE_TYPE]: "Seq Scan",
      [NodeProp.PARENT_RELATIONSHIP]: "InitPlan",
      [NodeProp.SUBPLAN_NAME]: `InitPlan ${i + 1} (returns $${i})`,
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

  // Create many normal nodes
  // We add them as children of the root to keep it simple, but we don't nest them deeply
  // to avoid huge recursion depth during setup/teardown if that matters.
  // Flattening in PlanService handles this.
  for (let i = 0; i < normalNodeCount; i++) {
    const node: any = {
      [NodeProp.NODE_TYPE]: "Seq Scan",
      [NodeProp.PARENT_RELATIONSHIP]: "Outer",
      [NodeProp.FILTER]: `(x = $${i % initPlanCount})`, // Reference an InitPlan
      [NodeProp.ACTUAL_ROWS]: 1,
      [NodeProp.PLAN_ROWS]: 1,
      [NodeProp.TOTAL_COST]: 10,
      [NodeProp.STARTUP_COST]: 0,
      [NodeProp.ACTUAL_TOTAL_TIME]: 1,
      [NodeProp.ACTUAL_STARTUP_TIME]: 0,
      [NodeProp.ACTUAL_LOOPS]: 1,
      [NodeProp.PLANS]: [],
    }
    // Add some dummy string properties to increase iteration count per node
    for (let j = 0; j < 10; j++) {
      node[`dummy_prop_${j}`] =
        `some random string value $${i % initPlanCount} extra text`
    }

    root[NodeProp.PLANS].push(node)
  }

  return {
    Plan: root,
  }
}

// 50 InitPlans, 1000 nodes.
// Total regex checks: 50 * 1050 * (props per node ~15) ~= 787,500 iterations.
const largePlan = generateLargePlan(50, 1000)

describe("InitPlan Performance", () => {
  bench("createPlan with many InitPlans", () => {
    // Clone to avoid mutation side effects affecting subsequent runs
    const planCopy = _.cloneDeep(largePlan)
    planService.createPlan("benchmark", planCopy, "SELECT * FROM t")
  })
})
