import { bench, describe } from "vitest"
import { usePlanLayout } from "@/composables/usePlanLayout"
import { Orientation } from "@/enums"
import { ref } from "vue"
import type { Store } from "@/store"
import type { Node } from "@/interfaces"
import type { FlexHierarchyPointNode } from "d3-flextree"

// Mock store
const store = {
  stats: {
    maxRows: 1000,
  },
} as unknown as Store

// Mock viewOptions
const viewOptions = {
  orientation: Orientation.LeftToRight,
}

// Mock planEl
const planEl = ref(null)

// Instantiate composable
const { getLayoutExtent } = usePlanLayout(planEl, viewOptions, store)

interface LayoutNode {
  x: number
  y: number
  xSize: number
  ySize: number
  children: LayoutNode[]
  descendants(): LayoutNode[]
}

// Mock Node structure with traversal cost
function createTree(count: number) {
  const root: LayoutNode = {
    x: 0,
    y: 0,
    xSize: 100,
    ySize: 50,
    children: [],
    descendants: function (this: LayoutNode) {
      const result: LayoutNode[] = [this]
      const stack: LayoutNode[] = [...this.children]
      while (stack.length) {
        const node = stack.pop()
        if (!node) {
          continue
        }
        result.push(node)
        if (node.children) {
          stack.push(...node.children)
        }
      }
      return result
    },
  }

  // Build a tree
  let currentLayer: LayoutNode[] = [root]
  let created = 1
  while (created < count) {
    const nextLayer: LayoutNode[] = []
    for (const node of currentLayer) {
      // Add 2 children
      for (let i = 0; i < 2; i++) {
        if (created >= count) break
        const child: LayoutNode = {
          x: created * 10,
          y: created * 5,
          xSize: 100,
          ySize: 50,
          children: [],
          descendants: root.descendants,
        }
        node.children.push(child)
        nextLayer.push(child)
        created++
      }
    }
    currentLayer = nextLayer
  }
  return root
}

const smallTree = createTree(100)
const mediumTree = createTree(1000)
const largeTree = createTree(10000)
const hugeTree = createTree(50000)

describe("getLayoutExtent Performance", () => {
  bench("Small Tree (100 nodes)", () => {
    getLayoutExtent(smallTree as unknown as FlexHierarchyPointNode<Node>)
  })

  bench("Medium Tree (1,000 nodes)", () => {
    getLayoutExtent(mediumTree as unknown as FlexHierarchyPointNode<Node>)
  })

  bench("Large Tree (10,000 nodes)", () => {
    getLayoutExtent(largeTree as unknown as FlexHierarchyPointNode<Node>)
  })

  bench("Huge Tree (50,000 nodes)", () => {
    getLayoutExtent(hugeTree as unknown as FlexHierarchyPointNode<Node>)
  })
})
