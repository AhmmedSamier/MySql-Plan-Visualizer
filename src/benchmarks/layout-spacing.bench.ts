import { bench, describe } from "vitest"
import { usePlanLayout } from "@/composables/usePlanLayout"
import { Orientation } from "@/enums"
import { ref } from "vue"
import type { IPlan } from "@/interfaces"

// Mock store
const store: any = {
  stats: {
    maxRows: 1000,
  },
}

// Mock viewOptions
const viewOptions = {
  orientation: Orientation.LeftToRight,
}

// Mock planEl
const planEl = ref({
    $el: {
        getBoundingClientRect: () => ({ width: 1000, height: 1000 })
    }
})

// Instantiate composable
const { buildTree } = usePlanLayout(planEl, viewOptions, store)

// Mock Plan structure
function createPlan(depth: number, breadth: number) {
  let idCounter = 0

  function createNode(currentDepth: number): any {
    const node: any = {
      NodeType: "Mock Node",
      "Node Type": "Mock Node",
      "Actual Rows": 1,
      "Actual Total Time": 1,
      size: [100, 50],
      nodeId: idCounter++,
      Plans: []
    }

    if (currentDepth < depth) {
      for (let i = 0; i < breadth; i++) {
        node.Plans.push(createNode(currentDepth + 1))
      }
    }
    return node
  }

  return {
    content: {
      Plan: createNode(0)
    },
    ctes: []
  }
}

const mediumPlan = createPlan(5, 4) // 4^5 nodes approx 1024 + ...
const largePlan = createPlan(7, 3) // 3^7 = 2187 leaf nodes

describe("Layout Performance", () => {
  bench("Medium Plan (depth 5, breadth 4)", () => {
    buildTree(mediumPlan as unknown as IPlan)
  })

  bench("Large Plan (depth 7, breadth 3)", () => {
    buildTree(largePlan as unknown as IPlan)
  })
})
