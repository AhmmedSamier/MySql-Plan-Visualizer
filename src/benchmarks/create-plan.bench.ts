import { bench, describe } from "vitest"
import { PlanService } from "@/services/plan-service"
import { Node } from "@/interfaces"
import { NodeProp } from "@/enums"

const planService = new PlanService()

function createNode(depth: number, width: number): Node {
  const node = new Node("Seq Scan")
  node[NodeProp.PLAN_ROWS] = 100
  node[NodeProp.ACTUAL_ROWS] = 100
  node[NodeProp.TOTAL_COST] = 100
  node[NodeProp.EXCLUSIVE_DURATION] = 10
  node[NodeProp.ACTUAL_TOTAL_TIME] = 10

  if (depth > 0) {
    node[NodeProp.PLANS] = []
    for (let i = 0; i < width; i++) {
      node[NodeProp.PLANS].push(createNode(depth - 1, width))
    }
  }
  return node
}

// Create a large plan
// Depth 10, width 2 => 2^11 - 1 = 2047 nodes
const deepPlan = createNode(12, 2)

const planContent = {
  Plan: deepPlan,
  "Query Text": "SELECT * FROM foo",
}

describe("Create Plan", () => {
  bench("Deep Plan", () => {
    planService.createPlan("test", planContent, "SELECT * FROM foo")
  })
})
