import { bench, describe } from "vitest"
import { usePlanLayout } from "@/composables/usePlanLayout"
import { Orientation } from "@/enums"
import { ref } from "vue"

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
const planEl = ref(null)

// Instantiate composable
const { getLayoutExtent } = usePlanLayout(planEl, viewOptions, store)

// Mock Node structure with traversal cost
function createTree(count: number) {
  const root = {
    x: 0,
    y: 0,
    xSize: 100,
    ySize: 50,
    children: [] as any[],
    descendants: function (this: any) {
      const result = [this]
      const stack = [...this.children]
      while (stack.length) {
        const node = stack.pop()
        result.push(node)
        if (node.children) {
          stack.push(...node.children)
        }
      }
      return result
    },
  }

  // Build a tree
  let currentLayer: any[] = [root]
  let created = 1
  while (created < count) {
    const nextLayer: any[] = []
    for (const node of currentLayer) {
      // Add 2 children
      for (let i = 0; i < 2; i++) {
        if (created >= count) break
        const child = {
          x: created * 10,
          y: created * 5,
          xSize: 100,
          ySize: 50,
          children: [] as any[],
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
    getLayoutExtent(smallTree as any)
  })

  bench("Medium Tree (1,000 nodes)", () => {
    getLayoutExtent(mediumTree as any)
  })

  bench("Large Tree (10,000 nodes)", () => {
    getLayoutExtent(largeTree as any)
  })

  bench("Huge Tree (50,000 nodes)", () => {
    getLayoutExtent(hugeTree as any)
  })
})
