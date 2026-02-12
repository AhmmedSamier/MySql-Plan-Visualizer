import { bench, describe } from "vitest"
import _ from "lodash"

// Mock Node interface
interface Node {
  nodeId: number
  [key: string]: any
}

// Mock FlexHierarchyPointNode interface
interface FlexHierarchyPointNode<T> {
  data: T
  children?: FlexHierarchyPointNode<T>[]
  descendants: () => FlexHierarchyPointNode<T>[]
  x: number
  y: number
}

// Helper to create a mock tree
function createMockTree(depth: number, width: number, startId: { val: number }): FlexHierarchyPointNode<Node> {
  const node: FlexHierarchyPointNode<Node> = {
    data: { nodeId: startId.val++ },
    x: 0,
    y: 0,
    descendants: function() {
        const result: FlexHierarchyPointNode<Node>[] = [this];
        if (this.children) {
            this.children.forEach(c => {
                result.push(...c.descendants());
            });
        }
        return result;
    }
  }

  if (depth > 0) {
    node.children = []
    for (let i = 0; i < width; i++) {
      node.children.push(createMockTree(depth - 1, width, startId))
    }
  }

  return node
}

const startId = { val: 0 }
// Create a reasonably large tree: depth 6, width 4 -> 4^0 + ... + 4^6 = 1365 nodes
const root = createMockTree(6, 4, startId)
const ctes = [createMockTree(4, 3, startId), createMockTree(4, 3, startId)] // Some CTEs

const totalNodes = startId.val
const targetId = Math.floor(totalNodes / 2) // Search for a node in the middle

// Current implementation
function findTreeNodeCurrent(nodeId: number) {
    const trees = [root].concat(ctes)
    let found: undefined | FlexHierarchyPointNode<Node> = undefined
    _.each(trees, (tree) => {
      found = _.find(tree?.descendants(), (o) => o.data.nodeId == nodeId)
      return !found
    })
    return found
}

// Optimized implementation
// Map construction
const nodeMap = new Map<number, FlexHierarchyPointNode<Node>>()
function buildMap() {
    nodeMap.clear()
    const trees = [root].concat(ctes)
    trees.forEach(tree => {
        tree.descendants().forEach(node => {
            nodeMap.set(node.data.nodeId, node)
        })
    })
}
buildMap()

function findTreeNodeOptimized(nodeId: number) {
    return nodeMap.get(nodeId)
}

describe("Layout Tree Search", () => {
  bench("Linear Search (Current)", () => {
    findTreeNodeCurrent(targetId)
  })

  bench("Map Lookup (Optimized)", () => {
    findTreeNodeOptimized(targetId)
  })
})
