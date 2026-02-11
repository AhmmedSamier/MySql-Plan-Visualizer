import { ref, computed, nextTick, type Ref } from "vue"
import { scaleLinear, zoom, zoomIdentity, select, path } from "d3"
import {
  flextree,
  type FlexHierarchyPointLink,
  type FlexHierarchyPointNode,
} from "d3-flextree"
import _ from "lodash"
import type { Store } from "@/store"
import { NodeProp, Orientation } from "@/enums"
import type { Node } from "@/interfaces"

// Vertical padding between 2 nodes in the tree layout
const padding = 40

export function usePlanLayout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  planEl: Ref<any>,
  viewOptions: { orientation: Orientation },
  store: Store,
) {
  const transform = ref("")
  const scale = ref(1)
  const layoutRootNode = ref<null | FlexHierarchyPointNode<Node>>(null)
  const ctes = ref<FlexHierarchyPointNode<Node>[]>([])
  const toCteLinks = ref<FlexHierarchyPointLink<Node>[]>([])

  const layout = flextree({
    nodeSize: (node: FlexHierarchyPointNode<Node>) => {
      if (node.data.size) {
        return [node.data.size[0], node.data.size[1] + padding]
      }
      return [0, 0]
    },
    spacing: (
      nodeA: FlexHierarchyPointNode<Node>,
      nodeB: FlexHierarchyPointNode<Node>,
    ) => Math.pow(nodeA.path(nodeB).length, 1.5),
  })

  const tree = ref<FlexHierarchyPointNode<Node>>(layout.hierarchy({} as Node))

  const edgeWeight = computed(() => {
    return scaleLinear()
      .domain([0, store.stats.maxRows])
      .range([1, padding / 1.5])
  })

  const minScale = 0.2
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoomListener: any = zoom()
    .scaleExtent([minScale, 3])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .on("zoom", function (e: any) {
      transform.value = e.transform
      scale.value = e.transform.k
    })

  const rootDescendants = computed(() => {
    return layoutRootNode.value?.descendants() || []
  })

  const rootLinks = computed(() => {
    return layoutRootNode.value?.links() || []
  })

  function initZoom() {
    if (!planEl.value) {
      return
    }
    select(planEl.value.$el).call(zoomListener)
    nextTick(() => {
      fitToScreen()
    })
  }

  function getLayoutExtent(
    layoutRootNode: FlexHierarchyPointNode<Node>,
  ): [number, number, number, number] {
    const descendants = layoutRootNode.descendants()
    if (viewOptions.orientation === Orientation.LeftToRight) {
      const minX =
        _.min(
          _.map(descendants, (childNode) => {
            return childNode.x
          }),
        ) || 0

      const maxX =
        _.max(
          _.map(descendants, (childNode) => {
            // Width is ySize - padding
            return childNode.x + (childNode.ySize - padding)
          }),
        ) || 0

      const minY =
        _.min(
          _.map(descendants, (childNode) => {
            // Height is xSize. centered at y.
            return childNode.y - childNode.xSize / 2
          }),
        ) || 0

      const maxY =
        _.max(
          _.map(descendants, (childNode) => {
            return childNode.y + childNode.xSize / 2
          }),
        ) || 0
      return [minX, maxX, minY, maxY]
    }

    const minX =
      _.min(
        _.map(descendants, (childNode) => {
          return childNode.x - childNode.xSize / 2
        }),
      ) || 0

    const maxX =
      _.max(
        _.map(descendants, (childNode) => {
          return childNode.x + childNode.xSize / 2
        }),
      ) || 0

    const minY =
      _.min(
        _.map(descendants, (childNode) => {
          return childNode.y
        }),
      ) || 0

    const maxY =
      _.max(
        _.map(descendants, (childNode) => {
          return childNode.y + childNode.ySize
        }),
      ) || 0
    return [minX, maxX, minY, maxY]
  }

  function doLayout() {
    layoutRootNode.value = layout(tree.value)

    const mainLayoutExtent = getLayoutExtent(layoutRootNode.value)
    const offset: [number, number] = [
      mainLayoutExtent[0],
      mainLayoutExtent[3] + padding,
    ]
    _.each(ctes.value, (tree) => {
      const cteRootNode = layout(tree)
      const currentCteExtent = getLayoutExtent(cteRootNode)
      const currentWidth = currentCteExtent[1] - currentCteExtent[0]
      cteRootNode.each((node) => {
        node.x += offset[0] - currentCteExtent[0]
        node.y += offset[1]
      })
      offset[0] += currentWidth + padding * 2
    })

    if (viewOptions.orientation === Orientation.LeftToRight) {
      // Swap X and Y for all nodes
      const swap = (node: FlexHierarchyPointNode<Node>) => {
        const temp = node.x
        node.x = node.y
        node.y = temp
      }
      layoutRootNode.value?.each(swap)
      _.each(ctes.value, (tree) => tree.each(swap))
    }

    // compute links from node to CTE
    toCteLinks.value = []
    _.each(layoutRootNode.value?.descendants(), (source) => {
      if (_.has(source.data, NodeProp.CTE_NAME)) {
        const cte = _.find(ctes.value, (cteNode) => {
          return (
            cteNode.data[NodeProp.SUBPLAN_NAME] ==
            "CTE " + source.data[NodeProp.CTE_NAME]
          )
        })
        if (cte) {
          toCteLinks.value.push({
            source: source,
            target: cte,
          })
        }
      }
    })

    // compute links from node in CTE to other CTE
    _.each(ctes.value, (cte) => {
      _.each(cte.descendants(), (sourceCte) => {
        if (_.has(sourceCte.data, NodeProp.CTE_NAME)) {
          const targetCte = _.find(ctes.value, (cteNode) => {
            return (
              cteNode.data[NodeProp.SUBPLAN_NAME] ==
              "CTE " + sourceCte.data[NodeProp.CTE_NAME]
            )
          })
          if (targetCte) {
            toCteLinks.value.push({
              source: sourceCte,
              target: targetCte,
            })
          }
        }
      })
    })
  }

  function fitToScreen() {
    if (!planEl.value || !layoutRootNode.value) {
      return
    }
    const extent = getLayoutExtent(layoutRootNode.value)
    const x0 = extent[0]
    const y0 = extent[2]
    const x1 = extent[1]
    const y1 = extent[3]
    const rect = planEl.value.$el.getBoundingClientRect()

    const diagramWidth = x1 - x0
    const diagramHeight = y1 - y0

    const s = Math.min(
      1,
      Math.max(
        minScale,
        0.95 / Math.max(diagramWidth / rect.width, diagramHeight / rect.height),
      ),
    )

    let sx, sy, px, py

    if (viewOptions.orientation === Orientation.LeftToRight) {
      // Center vertically, Align Left
      sx = 20
      sy = rect.height / 2
      px = x0
      py = (y0 + y1) / 2
    } else {
      // Center horizontally, Align Top
      sx = rect.width / 2
      sy = 20
      px = (x0 + x1) / 2
      py = y0
    }

    select(planEl.value.$el)
      .transition()
      .call(
        zoomListener.transform,
        zoomIdentity.translate(sx, sy).scale(s).translate(-px, -py),
      )
  }

  function zoomIn() {
    if (planEl.value) {
      select(planEl.value.$el).transition().call(zoomListener.scaleBy, 1.2)
    }
  }

  function zoomOut() {
    if (planEl.value) {
      select(planEl.value.$el).transition().call(zoomListener.scaleBy, 0.8)
    }
  }

  function lineGen(link: FlexHierarchyPointLink<Node>) {
    const source = link.source
    const target = link.target
    const p = path()
    if (viewOptions.orientation === Orientation.LeftToRight) {
      const k = Math.abs(target.x - (source.x + source.ySize) - padding)
      p.moveTo(source.x, source.y)
      p.lineTo(source.x + source.ySize - padding, source.y)
      p.bezierCurveTo(
        source.x + source.ySize - padding + k / 2,
        source.y,
        target.x - k / 2,
        target.y,
        target.x,
        target.y,
      )
    } else {
      const k = Math.abs(target.y - (source.y + source.ySize) - padding)
      p.moveTo(source.x, source.y)
      p.lineTo(source.x, source.y + source.ySize - padding)
      p.bezierCurveTo(
        source.x,
        source.y + source.ySize - padding + k / 2,
        target.x,
        target.y - k / 2,
        target.x,
        target.y,
      )
    }
    return p.toString()
  }

  function findTreeNode(nodeId: number) {
    const trees = [layoutRootNode.value].concat(ctes.value)
    let found: undefined | FlexHierarchyPointNode<Node> = undefined
    _.each(trees, (tree) => {
      found = _.find(tree?.descendants(), (o) => o.data.nodeId == nodeId)
      return !found
    })
    return found
  }

  function centerNode(nodeId: number): void {
    const rect = planEl.value.$el.getBoundingClientRect()
    const treeNode = findTreeNode(nodeId)
    if (!treeNode) {
      return
    }
    let x = -treeNode["x"]
    let y = -treeNode["y"]
    const k = scale.value
    x = x * k + rect.width / 2
    y = y * k + rect.height / 2
    select(planEl.value.$el)
      .transition()
      .duration(500)
      .call(zoomListener.transform, zoomIdentity.translate(x, y).scale(k))
  }

  function updateNodeSize(node: Node, size: [number, number]) {
    if (viewOptions.orientation === Orientation.LeftToRight) {
      node.size = [size[1] / scale.value, size[0] / scale.value]
    } else {
      node.size = [size[0] / scale.value, size[1] / scale.value]
    }
  }

  function getNodeX(item: FlexHierarchyPointNode<Node>) {
    if (viewOptions.orientation === Orientation.LeftToRight) {
      return item.x
    }
    return item.x - item.xSize / 2
  }

  function getNodeY(item: FlexHierarchyPointNode<Node>) {
    if (viewOptions.orientation === Orientation.LeftToRight) {
      return item.y - item.xSize / 2
    }
    return item.y
  }

  function getNodeWidth(item: FlexHierarchyPointNode<Node>) {
    if (viewOptions.orientation === Orientation.LeftToRight) {
      // In LTR, ySize is the 'depth' dimension which is Width + padding.
      // xSize is Height.
      // We want Width.
      return item.ySize - padding
    }
    return item.xSize
  }

  function buildTree(plan: any) {
    if (plan?.content?.Plan) {
      tree.value = layout.hierarchy(plan.content.Plan, (v: Node) => v.Plans)
    }
    ctes.value = []
    _.each(plan?.ctes, (cte) => {
      const cteTree = layout.hierarchy(cte, (v: Node) => v.Plans)
      ctes.value.push(cteTree)
    })
    doLayout()
  }

  return {
    transform,
    scale,
    edgeWeight,
    layoutRootNode,
    ctes,
    toCteLinks,
    tree,
    rootDescendants,
    rootLinks,
    doLayout,
    initZoom,
    fitToScreen,
    zoomIn,
    zoomOut,
    lineGen,
    centerNode,
    updateNodeSize,
    getNodeX,
    getNodeY,
    getNodeWidth,
    getLayoutExtent,
    buildTree,
  }
}
