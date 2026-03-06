import { bench, describe } from "vitest"
import { flextree, type FlexHierarchyPointNode } from "d3-flextree"
import { Node } from "@/interfaces"

// Mock Node structure
function createTreeData(depth: number, breadth: number, idCounter = { val: 0 }): any {
  const node = new Node("Seq Scan")
  node.nodeId = idCounter.val++
  node.size = [100, 50]
  const children = []
  if (depth > 0) {
    for (let i = 0; i < breadth; i++) {
      children.push(createTreeData(depth - 1, breadth, idCounter))
    }
  }
  node.Plans = children
  return node
}

const treeData = createTreeData(10, 2) // ~2047 nodes
const layout = flextree()
const tree = layout.hierarchy(treeData, (v: Node) => v.Plans)

const ctesData = [createTreeData(5, 2), createTreeData(5, 2)]
const ctes = ctesData.map(d => layout.hierarchy(d, (v: Node) => v.Plans))

describe("Plan Watcher Getter Performance", () => {
  bench("Current Implementation", () => {
    const data: [number, number][] = []
    const rootSizes = tree
      .descendants()
      .map((item: FlexHierarchyPointNode<Node>) => item.data.size)
    rootSizes.forEach((size) => data.push(size))

    ctes.forEach((tree) => {
      const cteSizes = tree
        .descendants()
        .map((item: FlexHierarchyPointNode<Node>) => item.data.size)
      cteSizes.forEach((size) => data.push(size))
    })
    JSON.stringify(data)
  })

  bench("Optimized Implementation", () => {
    const data: [number, number][] = []
    tree.descendants().forEach((item: FlexHierarchyPointNode<Node>) => {
      data.push(item.data.size)
    })

    ctes.forEach((tree) => {
      tree.descendants().forEach((item: FlexHierarchyPointNode<Node>) => {
        data.push(item.data.size)
      })
    })
    JSON.stringify(data)
  })
})
