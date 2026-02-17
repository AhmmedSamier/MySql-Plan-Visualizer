import { bench, describe } from "vitest"
import { flextree } from "d3-flextree"
import _ from "lodash"

// Mock Node data
const createNode = (id: number) => ({
  id,
  size: [100, 50],
})

// Create a deep tree
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTreeData(depth: number, breadth: number, idCounter = { val: 0 }): any {
  const node = createNode(idCounter.val++)
  const children = []
  if (depth > 0) {
    for (let i = 0; i < breadth; i++) {
      children.push(createTreeData(depth - 1, breadth, idCounter))
    }
  }
  return { ...node, children }
}

const treeData = createTreeData(5, 3) // ~364 nodes
const layout = flextree({
  nodeSize: () => [100, 50],
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const root: any = layout.hierarchy(treeData)
layout(root)

// Mock getLayoutExtent function from usePlanLayout.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLayoutExtent(layoutRootNode: any) {
  const descendants = layoutRootNode.descendants()

  // minX
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _.min(_.map(descendants, (d: any) => d.x))
  // maxX
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _.max(_.map(descendants, (d: any) => d.x + d.ySize))
  // minY
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _.min(_.map(descendants, (d: any) => d.y))
  // maxY
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _.max(_.map(descendants, (d: any) => d.y + d.xSize))

  return [0, 100, 0, 100]
}

describe("CTE Render Loop", () => {
  bench("Unoptimized (repeated calls)", () => {
    // Simulate what happens in the template for one CTE

    // v-for links
    const links = root.links()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const link of links) {
        // render link
    }

    // v-for descendants
    const descendants = root.descendants()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const d of descendants) {
        // render node
    }

    // getLayoutExtent called 4 times in template for rect attributes
    getLayoutExtent(root)
    getLayoutExtent(root)
    getLayoutExtent(root)
    getLayoutExtent(root)
  })

  bench("Optimized (cached calls)", () => {
    // Simulate computing it once
    const links = root.links()
    const descendants = root.descendants()
    const extent = getLayoutExtent(root) // Computed once

    // Usage in template
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const link of links) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const d of descendants) {}
    // usage of extent
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const x = extent[0]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const width = extent[1]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const y = extent[2]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const height = extent[3]
  })
})
