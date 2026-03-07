import { bench, describe } from "vitest"
import _ from "lodash"
import { NodeProp } from "../enums"

// Minimal Mock Interfaces
interface Node {
  [key: string]: any
}

interface FlexHierarchyPointNode<T> {
  data: T
  descendants: () => FlexHierarchyPointNode<T>[]
}

// Helper to create a mock CTE node
function createCteNode(name: string): FlexHierarchyPointNode<Node> {
  return {
    data: {
      [NodeProp.SUBPLAN_NAME]: name,
    },
    descendants: () => [], // Simplified: descendants don't matter for the key lookup
  }
}

// Helper to create a source node referencing a CTE
function createSourceNode(cteName: string): FlexHierarchyPointNode<Node> {
  return {
    data: {
      [NodeProp.CTE_NAME]: cteName,
    },
    descendants: () => [],
  }
}

// Setup
const numCtes = 100
const numSources = 1000

const ctes: FlexHierarchyPointNode<Node>[] = []
for (let i = 0; i < numCtes; i++) {
  ctes.push(createCteNode(`CTE CTE ${i}`))
}

const sourceNodes: FlexHierarchyPointNode<Node>[] = []
for (let i = 0; i < numSources; i++) {
  // Randomly assign a reference to one of the CTEs
  const targetCteIndex = i % numCtes
  sourceNodes.push(createSourceNode(`CTE ${targetCteIndex}`))
}

// Current Implementation: Linear Search
function linkCtesLinear() {
  const toCteLinks: any[] = []
  _.each(sourceNodes, (source) => {
    if (_.has(source.data, NodeProp.CTE_NAME)) {
      const cte = _.find(ctes, (cteNode) => {
        return (
          cteNode.data[NodeProp.SUBPLAN_NAME] ==
          "CTE " + source.data[NodeProp.CTE_NAME]
        )
      })
      if (cte) {
        toCteLinks.push({
          source: source,
          target: cte,
        })
      }
    }
  })
  return toCteLinks
}

// Optimized Implementation: Map Lookup
function linkCtesOptimized() {
  const toCteLinks: any[] = []
  const cteMap = new Map<string, FlexHierarchyPointNode<Node>>()

  // Pre-populate map
  _.each(ctes, (cte) => {
      // The logic in original code uses exact match on SUBPLAN_NAME
      if (cte.data[NodeProp.SUBPLAN_NAME]) {
          cteMap.set(cte.data[NodeProp.SUBPLAN_NAME], cte)
      }
  })

  _.each(sourceNodes, (source) => {
    if (_.has(source.data, NodeProp.CTE_NAME)) {
      const targetName = "CTE " + source.data[NodeProp.CTE_NAME]
      const cte = cteMap.get(targetName)

      if (cte) {
        toCteLinks.push({
          source: source,
          target: cte,
        })
      }
    }
  })
  return toCteLinks
}

describe("CTE Lookup Performance", () => {
  bench("Linear Search (Current)", () => {
    linkCtesLinear()
  })

  bench("Map Lookup (Optimized)", () => {
    linkCtesOptimized()
  })
})
