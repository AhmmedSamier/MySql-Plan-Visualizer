<script lang="ts" setup>
import _ from "lodash"
import {
  computed,
  reactive,
  ref,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  watch,
} from "vue"
import { Splitpanes, Pane } from "splitpanes"

import type { Node } from "@/interfaces"
import {
  HighlightedNodeIdKey,
  SelectedNodeIdKey,
  SelectNodeKey,
  ViewOptionsKey,
  ToggleDetailsKey,
} from "@/symbols"
import Copy from "@/components/Copy.vue"
import Diagram from "@/components/Diagram.vue"
import Grid from "@/components/Grid.vue"
import LogoImage from "@/components/LogoImage.vue"
import PlanNode from "@/components/PlanNode.vue"
import PlanStats from "@/components/PlanStats.vue"
import Stats from "@/components/Stats.vue"
import AnimatedEdge from "@/components/AnimatedEdge.vue"
import KeyboardShortcuts from "@/components/KeyboardShortcuts.vue"
import { findNodeById } from "@/services/help-service"
import { HighlightType, NodeProp, Orientation } from "@/enums"
import { json_, mysql_ } from "@/filters"
import { setDefaultProps } from "vue-tippy"
import { store } from "@/store.ts"
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import {
  faPlus,
  faMinus,
  faArrowsAlt,
  faSearch,
  faChevronLeft,
  faChevronRight,
  faTimes,
  faCompress,
  faExpand,
  faKeyboard,
} from "@fortawesome/free-solid-svg-icons"

setDefaultProps({ theme: "light" })

import "tippy.js/dist/tippy.css"
import "tippy.js/themes/light.css"
import * as d3 from "d3"
import {
  flextree,
  type FlexHierarchyPointLink,
  type FlexHierarchyPointNode,
} from "d3-flextree"

interface Props {
  planSource: string
  planQuery: string
}
const props = defineProps<Props>()

const version = __APP_VERSION__

const rootEl = ref(null) // The root Element of this instance
const activeTab = ref<string>("")
const planEl = ref()
const rootNode = computed(() => store.plan && store.plan.content.Plan)
const selectedNodeId = ref<number>(NaN)
const selectedNode = ref<Node | undefined>(undefined)
const highlightedNodeId = ref<number>(NaN)
const ready = ref(false)
const showSearchInput = ref(false)
const searchInput = ref("")
const searchResults = ref<Node[]>([])
const currentSearchIndex = ref(-1)
const keyboardShortcutsRef = ref<InstanceType<typeof KeyboardShortcuts> | null>(
  null,
)

const viewOptions = reactive({
  showHighlightBar: false,
  showPlanStats: true,
  highlightType: HighlightType.NONE,
  diagramWidth: 20,
  orientation: Orientation.TopToBottom,
  showDiagram: true,
})

// Vertical padding between 2 nodes in the tree layout
const padding = 40
const transform = ref("")
const scale = ref(1)
const edgeWeight = computed(() => {
  return d3
    .scaleLinear()
    .domain([0, store.stats.maxRows])
    .range([1, padding / 1.5])
})
const minScale = 0.2
const zoomListener = d3
  .zoom()
  .scaleExtent([minScale, 3])
  .on("zoom", function (e) {
    transform.value = e.transform
    scale.value = e.transform.k
  })
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

const tree = ref(layout.hierarchy({}))

onMounted(() => {
  watch(() => [props.planSource, props.planQuery], parseAndShow, {
    immediate: true,
  })
  window.addEventListener("keydown", handleKeyDown)
})

function parseAndShow() {
  ready.value = false
  store.parse(props.planSource, props.planQuery)
  const savedOptions = localStorage.getItem("viewOptions")
  if (savedOptions) {
    _.assignIn(viewOptions, JSON.parse(savedOptions))
  }
  setActiveTab("plan")

  nextTick(() => {
    onHashChange()
  })
  window.addEventListener("hashchange", onHashChange)
  if (store.plan?.content.Plan) {
    tree.value = layout.hierarchy(
      store.plan?.content.Plan,
      (v: Node) => v.Plans,
    )
  }
  ctes.value = []
  _.each(store.plan?.ctes, (cte) => {
    const tree = layout.hierarchy(cte, (v: Node) => v.Plans)
    ctes.value.push(tree)
  })
  nextTick(() => {
    initZoom()
    ready.value = true
  })
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
    layoutRootNode.value.each(swap)
    _.each(ctes.value, (tree) => tree.each(swap))
  }

  // compute links from node to CTE
  toCteLinks.value = []
  _.each(layoutRootNode.value.descendants(), (source) => {
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

function initZoom() {
  if (!planEl.value) {
    return
  }
  d3.select(planEl.value.$el).call(zoomListener)
  nextTick(() => {
    fitToScreen()
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

  d3.select(planEl.value.$el)
    .transition()
    .call(
      zoomListener.transform,
      d3.zoomIdentity.translate(sx, sy).scale(s).translate(-px, -py),
    )
}

function zoomIn() {
  if (planEl.value) {
    d3.select(planEl.value.$el).transition().call(zoomListener.scaleBy, 1.2)
  }
}

function zoomOut() {
  if (planEl.value) {
    d3.select(planEl.value.$el).transition().call(zoomListener.scaleBy, 0.8)
  }
}

onBeforeUnmount(() => {
  window.removeEventListener("hashchange", onHashChange)
  window.removeEventListener("keydown", handleKeyDown)
})

watch(viewOptions, onViewOptionsChanged)

function onViewOptionsChanged() {
  localStorage.setItem("viewOptions", JSON.stringify(viewOptions))
}

watch(selectedNodeId, onSelectedNode)

function onSelectedNode(v: number) {
  window.location.hash = v ? "plan/node/" + v : ""
  if (store.plan && v) {
    selectedNode.value = findNodeById(store.plan, v)
  }
}

function lineGen(link: FlexHierarchyPointLink<object>) {
  const source = link.source
  const target = link.target
  const path = d3.path()
  if (viewOptions.orientation === Orientation.LeftToRight) {
    const k = Math.abs(target.x - (source.x + source.ySize) - padding)
    path.moveTo(source.x, source.y)
    path.lineTo(source.x + source.ySize - padding, source.y)
    path.bezierCurveTo(
      source.x + source.ySize - padding + k / 2,
      source.y,
      target.x - k / 2,
      target.y,
      target.x,
      target.y,
    )
  } else {
    const k = Math.abs(target.y - (source.y + source.ySize) - padding)
    path.moveTo(source.x, source.y)
    path.lineTo(source.x, source.y + source.ySize - padding)
    path.bezierCurveTo(
      source.x,
      source.y + source.ySize - padding + k / 2,
      target.x,
      target.y - k / 2,
      target.x,
      target.y,
    )
  }
  return path.toString()
}

function onHashChange(): void {
  const reg = /#([a-zA-Z]*)(\/node\/([0-9]*))*/
  const matches = reg.exec(window.location.hash)
  if (matches) {
    const tab = matches[1] || "plan"
    setActiveTab(tab)
    const nodeId = parseInt(matches[3], 0)
    if (
      tab == "plan" &&
      nodeId !== undefined &&
      nodeId != selectedNodeId.value
    ) {
      // Delayed to make sure the tab has changed before recentering
      setTimeout(() => {
        selectNode(nodeId, true)
      }, 1)
    }
  }
}

provide(SelectedNodeIdKey, selectedNodeId)
provide(HighlightedNodeIdKey, highlightedNodeId)
provide("updateNodeSize", updateNodeSize)

function selectNode(nodeId: number, center: boolean): void {
  center = !!center
  selectedNodeId.value = nodeId
  if (center) {
    centerNode(nodeId)
  }
}
provide(SelectNodeKey, selectNode)
provide(ViewOptionsKey, viewOptions)

const toggleDetails = ref<{ show: boolean; counter: number }>({
  show: false,
  counter: 0,
})
provide(ToggleDetailsKey, toggleDetails)

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
  d3.select(planEl.value.$el)
    .transition()
    .duration(500)
    .call(zoomListener.transform, d3.zoomIdentity.translate(x, y).scale(k))
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

const setActiveTab = (tab: string) => {
  activeTab.value = tab
}

function getLayoutExtent(
  layoutRootNode: FlexHierarchyPointNode<Node>,
): [number, number, number, number] {
  if (viewOptions.orientation === Orientation.LeftToRight) {
    const minX =
      _.min(
        _.map(layoutRootNode.descendants(), (childNode) => {
          return childNode.x
        }),
      ) || 0

    const maxX =
      _.max(
        _.map(layoutRootNode.descendants(), (childNode) => {
          // Width is ySize - padding
          return childNode.x + (childNode.ySize - padding)
        }),
      ) || 0

    const minY =
      _.min(
        _.map(layoutRootNode.descendants(), (childNode) => {
          // Height is xSize. centered at y.
          return childNode.y - childNode.xSize / 2
        }),
      ) || 0

    const maxY =
      _.max(
        _.map(layoutRootNode.descendants(), (childNode) => {
          return childNode.y + childNode.xSize / 2
        }),
      ) || 0
    return [minX, maxX, minY, maxY]
  }

  const minX =
    _.min(
      _.map(layoutRootNode.descendants(), (childNode) => {
        return childNode.x - childNode.xSize / 2
      }),
    ) || 0

  const maxX =
    _.max(
      _.map(layoutRootNode.descendants(), (childNode) => {
        return childNode.x + childNode.xSize / 2
      }),
    ) || 0

  const minY =
    _.min(
      _.map(layoutRootNode.descendants(), (childNode) => {
        return childNode.y
      }),
    ) || 0

  const maxY =
    _.max(
      _.map(layoutRootNode.descendants(), (childNode) => {
        return childNode.y + childNode.ySize
      }),
    ) || 0
  return [minX, maxX, minY, maxY]
}

function isNeverExecuted(node: Node): boolean {
  return !!store.stats.executionTime && !node[NodeProp.ACTUAL_LOOPS]
}

const shouldAutoFit = ref(false)

watch(
  () => viewOptions.orientation,
  () => {
    shouldAutoFit.value = true
  },
)

watch(
  () => {
    const data: [number, number][] = []
    data.concat(
      tree.value
        .descendants()
        .map((item: FlexHierarchyPointNode<Node>) => item.data.size),
    )
    _.each(ctes.value, (tree) => {
      data.concat(
        tree
          .descendants()
          .map((item: FlexHierarchyPointNode<Node>) => item.data.size),
      )
    })
    return data
  },
  () => {
    doLayout()
    if (shouldAutoFit.value) {
      fitToScreen()
      shouldAutoFit.value = false
    }
  },
)

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

const searchInputRef = ref<HTMLInputElement | null>(null)

function toggleSearch() {
  showSearchInput.value = !showSearchInput.value
  if (showSearchInput.value) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  } else {
    searchInput.value = ""
    searchResults.value = []
    currentSearchIndex.value = -1
  }
}

watch(searchInput, (val) => {
  if (!val || val.trim().length === 0) {
    searchResults.value = []
    currentSearchIndex.value = -1
    return
  }

  const term = val.toLowerCase()
  const results: Node[] = []

  if (layoutRootNode.value) {
    layoutRootNode.value.descendants().forEach((node) => {
      if (nodeMatches(node.data, term)) {
        results.push(node.data)
      }
    })
  }

  // Also search CTEs
  ctes.value.forEach((cte) => {
    cte.descendants().forEach((node) => {
      if (nodeMatches(node.data, term)) {
        results.push(node.data)
      }
    })
  })

  searchResults.value = results
  if (results.length > 0) {
    currentSearchIndex.value = 0
    highlightResult(0)
  } else {
    currentSearchIndex.value = -1
  }
})

function nodeMatches(node: Node, term: string): boolean {
  const fieldsToCheck = [
    NodeProp.NODE_TYPE,
    NodeProp.RELATION_NAME,
    NodeProp.ALIAS,
    NodeProp.INDEX_NAME,
    NodeProp.CTE_NAME,
    NodeProp.FUNCTION_NAME,
    NodeProp.FILTER,
    NodeProp.JOIN_TYPE,
    NodeProp.HASH_CONDITION,
    NodeProp.GROUP_KEY,
    NodeProp.SORT_KEY,
  ]

  return fieldsToCheck.some((field) => {
    const val = node[field]
    if (typeof val === "string") {
      return val.toLowerCase().includes(term)
    } else if (Array.isArray(val)) {
      return val.some(
        (v) => typeof v === "string" && v.toLowerCase().includes(term),
      )
    }
    return false
  })
}

function nextSearchMatch() {
  if (searchResults.value.length === 0) return

  let nextIndex = currentSearchIndex.value + 1
  if (nextIndex >= searchResults.value.length) {
    nextIndex = 0
  }
  currentSearchIndex.value = nextIndex
  highlightResult(nextIndex)
}

function prevSearchMatch() {
  if (searchResults.value.length === 0) return

  let prevIndex = currentSearchIndex.value - 1
  if (prevIndex < 0) {
    prevIndex = searchResults.value.length - 1
  }
  currentSearchIndex.value = prevIndex
  highlightResult(prevIndex)
}

function highlightResult(index: number) {
  const node = searchResults.value[index]
  if (node) {
    selectNode(node.nodeId, true)
    // We can also reuse the highlightedNodeId to show the highlight effect
    highlightedNodeId.value = node.nodeId
  }
}

function handleKeyDown(event: KeyboardEvent) {
  // Don't trigger shortcuts when typing in input fields
  const target = event.target as HTMLElement
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
    if (event.key === "Escape") {
      showSearchInput.value = false
    }
    return
  }

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
  const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey

  // Ctrl/Cmd + F - Open search
  if (ctrlOrCmd && event.key === "f") {
    event.preventDefault()
    toggleSearch()
    return
  }

  // + - Zoom in
  if (event.key === "+" || event.key === "=") {
    event.preventDefault()
    zoomIn()
    return
  }

  // - - Zoom out
  if (event.key === "-" || event.key === "_") {
    event.preventDefault()
    zoomOut()
    return
  }

  // 0 - Fit to screen
  if (event.key === "0") {
    event.preventDefault()
    fitToScreen()
    return
  }

  // Escape - Close search or deselect node
  if (event.key === "Escape") {
    event.preventDefault()
    if (showSearchInput.value) {
      showSearchInput.value = false
    } else if (selectedNodeId.value) {
      selectedNodeId.value = NaN
    }
    return
  }

  // ? - Show keyboard shortcuts
  if (event.key === "?" && event.shiftKey) {
    event.preventDefault()
    keyboardShortcutsRef.value?.show()
    return
  }

  // E - Expand all
  if (event.key === "e" || event.key === "E") {
    event.preventDefault()
    toggleDetails.value = {
      show: true,
      counter: toggleDetails.value.counter + 1,
    }
    return
  }

  // C - Collapse all
  if (event.key === "c" || event.key === "C") {
    event.preventDefault()
    toggleDetails.value = {
      show: false,
      counter: toggleDetails.value.counter + 1,
    }
    return
  }
}
</script>

<template>
  <div v-if="!store.plan" class="flex-grow-1 d-flex justify-content-center">
    <div class="card align-self-center border-danger w-50">
      <div class="card-body">
        <h5 class="card-title text-danger">Couldn't parse plan</h5>
        <h6 class="card-subtitle mb-2 text-body-secondary">
          An error occured while parsing the plan
        </h6>
        <div class="overflow-hidden d-flex w-100 h-100 position-relative mb-3">
          <div class="overflow-auto flex-grow-1">
            <pre
              class="small p-2 mb-0"
              style="max-height: 200px"
            ><code v-html="planSource"></code></pre>
          </div>
          <Copy :content="planSource" />
        </div>
        <p class="card-text text-body-dark">
          The plan you submited couldn't be parsed. This may be a bug. You can
          help us fix it by opening a new issue.
        </p>
        <div class="d-flex align-items-center">
          <span class="text-secondary">
            <LogoImage />
            MysqlPlanVisualizer <i>version {{ version }}</i>
          </span>
          <a
            href="https://github.com/ahmmedsamier/MySql-Plan-Visualizer/issues/new?template=parsing_error.md&labels=parsing&title=Failed+to+parse+plan"
            target="_blank"
            class="btn btn-primary ms-auto"
            >Open an issue on Github</a
          >
        </div>
      </div>
    </div>
  </div>
  <div
    class="plan-container d-flex flex-column overflow-hidden flex-grow-1 bg-light"
    v-else
    ref="rootEl"
  >
    <Teleport to="#header-tabs">
      <ul class="nav nav-tabs mysql-tabs flex-nowrap border-0">
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'plan' }"
            href="#plan"
            >Plan</a
          >
        </li>
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'grid' }"
            href="#grid"
            >Grid</a
          >
        </li>
        <li class="nav-item p-1" v-if="store.plan?.content.Diagram">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'diagram' }"
            href="#diagram"
            >Diagram</a
          >
        </li>
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'raw' }"
            href="#raw"
            >Raw</a
          >
        </li>
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'query' }"
            href="#query"
            >Query</a
          >
        </li>
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'stats' }"
            href="#stats"
            >Stats</a
          >
        </li>
      </ul>
    </Teleport>
    <div id="header-tools" class="d-flex align-items-center me-2"></div>
    <div class="tab-content flex-grow-1 d-flex overflow-hidden">
      <div
        class="tab-pane flex-grow-1 overflow-hidden"
        :class="{ 'show active d-flex': activeTab === 'plan' }"
      >
        <!-- Plan tab -->
        <div class="d-flex flex-column flex-grow-1 overflow-hidden">
          <PlanStats />
          <div class="flex-grow-1 d-flex overflow-hidden">
            <div class="flex-grow-1 overflow-hidden">
              <Splitpanes
                class="default-theme"
                @resize="viewOptions.diagramWidth = $event[0].size"
              >
                <Pane
                  :size="viewOptions.diagramWidth"
                  class="d-flex flex-column"
                  v-if="store.plan && viewOptions.showDiagram"
                >
                  <Diagram
                    ref="diagram"
                    class="d-flex flex-column flex-grow-1 overflow-hidden plan-diagram"
                  />
                </Pane>
                <Pane
                  ref="planEl"
                  class="plan grab-bing position-relative"
                  style="overflow: visible !important"
                >
                  <!-- Sidebar Toggle Button -->
                  <button
                    class="btn rounded-circle shadow-sm position-absolute d-flex align-items-center justify-content-center"
                    :style="{
                      left: viewOptions.showDiagram ? '-15px' : '5px',
                      top: '15px',
                      width: '30px',
                      height: '30px',
                      padding: '0',
                      zIndex: '9999',
                      border: '2px solid white',
                      backgroundColor: '#00758f',
                      transition: 'all 0.2s ease',
                    }"
                    @click="viewOptions.showDiagram = !viewOptions.showDiagram"
                    :title="viewOptions.showDiagram ? 'Hide Grid' : 'Show Grid'"
                  >
                    <FontAwesomeIcon
                      :icon="
                        viewOptions.showDiagram ? faChevronLeft : faChevronRight
                      "
                      size="xs"
                      color="white"
                    />
                  </button>
                  <div
                    class="position-absolute m-1 p-1 bottom-0 end-0 rounded bg-white d-flex"
                    v-if="store.plan"
                  >
                    <div class="btn-group btn-group-xs">
                      <button
                        class="btn btn-outline-secondary"
                        :class="{
                          active:
                            viewOptions.highlightType === HighlightType.NONE,
                        }"
                        v-on:click="
                          viewOptions.highlightType = HighlightType.NONE
                        "
                      >
                        none
                      </button>
                      <button
                        class="btn btn-outline-secondary"
                        :class="{
                          active:
                            viewOptions.highlightType ===
                            HighlightType.DURATION,
                        }"
                        v-on:click="
                          viewOptions.highlightType = HighlightType.DURATION
                        "
                        :disabled="!store.plan?.isAnalyze"
                      >
                        duration
                      </button>
                      <button
                        class="btn btn-outline-secondary"
                        :class="{
                          active:
                            viewOptions.highlightType === HighlightType.ROWS,
                        }"
                        v-on:click="
                          viewOptions.highlightType = HighlightType.ROWS
                        "
                        :disabled="
                          !rootNode ||
                          rootNode[NodeProp.ACTUAL_ROWS] === undefined
                        "
                      >
                        rows
                      </button>
                      <button
                        class="btn btn-outline-secondary"
                        :class="{
                          active:
                            viewOptions.highlightType === HighlightType.COST,
                        }"
                        v-on:click="
                          viewOptions.highlightType = HighlightType.COST
                        "
                      >
                        cost
                      </button>
                    </div>
                  </div>
                  <div
                    class="position-absolute m-1 p-1 bottom-0 start-0 rounded bg-white d-flex"
                    v-if="store.plan"
                  >
                    <div class="btn-group btn-group-xs">
                      <button
                        class="btn btn-outline-secondary"
                        :class="{
                          active:
                            viewOptions.orientation === Orientation.TopToBottom,
                        }"
                        v-on:click="
                          viewOptions.orientation = Orientation.TopToBottom
                        "
                        title="Vertical Layout"
                      >
                        Vertical
                      </button>
                      <button
                        class="btn btn-outline-secondary"
                        :class="{
                          active:
                            viewOptions.orientation === Orientation.LeftToRight,
                        }"
                        v-on:click="
                          viewOptions.orientation = Orientation.LeftToRight
                        "
                        title="Horizontal Layout"
                      >
                        Horizontal
                      </button>
                    </div>
                  </div>
                  <div
                    class="position-absolute m-1 p-1 bottom-0 end-0 d-flex flex-column"
                    style="margin-bottom: 50px !important"
                    v-if="store.plan"
                  >
                    <button
                      class="btn btn-light btn-sm mb-1"
                      title="Search (Ctrl+F)"
                      aria-label="Search nodes in the plan"
                      @click="toggleSearch"
                    >
                      <FontAwesomeIcon :icon="faSearch" />
                    </button>
                    <button
                      class="btn btn-light btn-sm mb-1"
                      title="Collapse All (C)"
                      aria-label="Collapse all nodes"
                      @click="
                        toggleDetails = {
                          show: false,
                          counter: toggleDetails.counter + 1,
                        }
                      "
                    >
                      <FontAwesomeIcon :icon="faCompress" />
                    </button>
                    <button
                      class="btn btn-light btn-sm mb-1"
                      title="Expand All (E)"
                      aria-label="Expand all nodes"
                      @click="
                        toggleDetails = {
                          show: true,
                          counter: toggleDetails.counter + 1,
                        }
                      "
                    >
                      <FontAwesomeIcon :icon="faExpand" />
                    </button>
                    <button
                      class="btn btn-light btn-sm mb-1"
                      title="Zoom In (+)"
                      aria-label="Zoom in on the plan diagram"
                      @click="zoomIn"
                    >
                      <FontAwesomeIcon :icon="faPlus" />
                    </button>
                    <button
                      class="btn btn-light btn-sm mb-1"
                      title="Zoom Out (-)"
                      aria-label="Zoom out on the plan diagram"
                      @click="zoomOut"
                    >
                      <FontAwesomeIcon :icon="faMinus" />
                    </button>
                    <button
                      class="btn btn-light btn-sm mb-1"
                      title="Fit to Screen (0)"
                      aria-label="Fit plan diagram to screen"
                      @click="fitToScreen"
                    >
                      <FontAwesomeIcon :icon="faArrowsAlt" />
                    </button>
                    <button
                      class="btn btn-light btn-sm"
                      title="Keyboard Shortcuts (?)"
                      aria-label="Show keyboard shortcuts help"
                      @click="keyboardShortcutsRef?.show()"
                    >
                      <FontAwesomeIcon :icon="faKeyboard" />
                    </button>
                  </div>
                  <div
                    class="position-absolute m-1 p-1 top-0 end-0 bg-white border rounded shadow-sm"
                    v-if="showSearchInput"
                    style="z-index: 100; min-width: 250px"
                  >
                    <div class="input-group input-group-sm">
                      <input
                        type="text"
                        class="form-control"
                        placeholder="Search nodes..."
                        v-model="searchInput"
                        ref="searchInputRef"
                        @keydown.enter.prevent="nextSearchMatch"
                        @keydown.esc.prevent="showSearchInput = false"
                      />
                      <button
                        class="btn btn-outline-secondary"
                        type="button"
                        @click="prevSearchMatch"
                        :disabled="searchResults.length === 0"
                      >
                        <FontAwesomeIcon :icon="faChevronLeft" />
                      </button>
                      <button
                        class="btn btn-outline-secondary"
                        type="button"
                        @click="nextSearchMatch"
                        :disabled="searchResults.length === 0"
                      >
                        <FontAwesomeIcon :icon="faChevronRight" />
                      </button>
                      <button
                        class="btn btn-outline-secondary"
                        type="button"
                        @click="showSearchInput = false"
                      >
                        <FontAwesomeIcon :icon="faTimes" />
                      </button>
                    </div>
                    <div
                      class="small text-secondary mt-1 px-1 d-flex justify-content-between"
                    >
                      <span v-if="searchResults.length > 0">
                        {{ currentSearchIndex + 1 }} /
                        {{ searchResults.length }} matches
                      </span>
                      <span v-else-if="searchInput.length > 0">
                        No matches found
                      </span>
                      <span v-else>Type to search</span>
                    </div>
                  </div>
                  <svg width="100%" height="100%" :class="{ ready }">
                    <g :transform="transform">
                      <!-- Links -->
                      <AnimatedEdge
                        v-for="(link, index) in toCteLinks"
                        :key="`${store.plan?.id}_linkcte${index}`"
                        :d="lineGen(link)"
                        stroke-color="#B3D7D7"
                        :stroke-width="
                          edgeWeight(
                            link.target.data[NodeProp.ACTUAL_ROWS_REVISED],
                          )
                        "
                        :rows="link.target.data[NodeProp.ACTUAL_ROWS_REVISED]"
                      />
                      <AnimatedEdge
                        v-for="(link, index) in layoutRootNode?.links()"
                        :key="`${store.plan?.id}_link${index}`"
                        :d="lineGen(link)"
                        :class="{
                          'never-executed': isNeverExecuted(link.target.data),
                        }"
                        stroke-color="grey"
                        :stroke-width="
                          edgeWeight(
                            link.target.data[NodeProp.ACTUAL_ROWS_REVISED],
                          )
                        "
                        :rows="link.target.data[NodeProp.ACTUAL_ROWS_REVISED]"
                      />
                      <foreignObject
                        v-for="(item, index) in layoutRootNode?.descendants()"
                        :key="`${store.plan?.id}_${index}`"
                        :x="getNodeX(item)"
                        :y="getNodeY(item)"
                        :width="getNodeWidth(item)"
                        height="1"
                        ref="root"
                      >
                        <PlanNode
                          :node="item.data"
                          class="d-flex justify-content-center position-fixed"
                        />
                      </foreignObject>
                      <g v-for="cte in ctes" :key="cte.data.nodeId">
                        <rect
                          :x="getLayoutExtent(cte)[0] - padding / 4"
                          :y="getLayoutExtent(cte)[2] - padding / 2"
                          :width="
                            getLayoutExtent(cte)[1] -
                            getLayoutExtent(cte)[0] +
                            padding / 2
                          "
                          :height="
                            getLayoutExtent(cte)[3] - getLayoutExtent(cte)[2]
                          "
                          stroke="#cfcfcf"
                          stroke-width="2"
                          fill="#cfcfcf"
                          fill-opacity="10%"
                          rx="5"
                          ry="5"
                        ></rect>
                        <AnimatedEdge
                          v-for="(link, index) in cte.links()"
                          :key="`${store.plan?.id}_link${index}`"
                          :d="lineGen(link)"
                          stroke-color="grey"
                          :stroke-width="
                            edgeWeight(
                              link.target.data[NodeProp.ACTUAL_ROWS_REVISED],
                            )
                          "
                          :rows="link.target.data[NodeProp.ACTUAL_ROWS_REVISED]"
                        />
                        <foreignObject
                          v-for="(item, index) in cte.descendants()"
                          :key="`${store.plan?.id}_${index}`"
                          :x="getNodeX(item)"
                          :y="getNodeY(item)"
                          :width="getNodeWidth(item)"
                          height="1"
                          ref="root"
                        >
                          <PlanNode
                            :node="item.data"
                            class="d-flex justify-content-center position-fixed"
                          />
                        </foreignObject>
                      </g>
                    </g>
                  </svg>
                </Pane>
              </Splitpanes>
            </div>
          </div>
          <!-- end Plan tab -->
        </div>
      </div>
      <div
        class="tab-pane flex-grow-1 overflow-hidden position-relative"
        :class="{ 'show active': activeTab === 'grid' }"
        v-if="activeTab === 'grid'"
      >
        <div class="overflow-hidden d-flex w-100 h-100 flex-column">
          <PlanStats />
          <Grid class="flex-grow-1 overflow-auto plan-grid" />
        </div>
      </div>
      <div
        class="tab-pane flex-grow-1 overflow-hidden position-relative"
        :class="{ 'show active': activeTab === 'raw' }"
      >
        <div class="overflow-hidden d-flex w-100 h-100">
          <div class="overflow-auto flex-grow-1">
            <pre
              class="small p-2 mb-0"
            ><code v-html="json_(planSource)"></code></pre>
          </div>
          <Copy :content="planSource" />
        </div>
      </div>
      <div
        class="tab-pane flex-grow-1 overflow-hidden position-relative"
        :class="{ 'show active': activeTab === 'query' }"
        v-if="store.query"
      >
        <div class="overflow-hidden d-flex w-100 h-100">
          <div class="overflow-auto flex-grow-1">
            <pre
              class="small p-2 mb-0"
            ><code v-html="mysql_(store.query)"></code></pre>
          </div>
        </div>
        <Copy :content="store.query" />
      </div>
      <div
        class="tab-pane flex-grow-1 overflow-auto"
        :class="{ 'show active': activeTab === 'stats' }"
      >
        <Stats v-if="store.plan" />
      </div>
    </div>
  </div>
  <KeyboardShortcuts ref="keyboardShortcutsRef" />
</template>

<style lang="scss">
@import "../assets/scss/variables";
@import "../assets/scss/mpv";
@import "splitpanes/dist/splitpanes.css";
@import "highlight.js/scss/stackoverflow-light.scss";

.ready {
  rect,
  foreignObject {
    transition: all 0.2s ease-in-out;
  }
}

// MySQL Header Styling
.mysql-tabs {
  border: none;
  gap: 0.25rem;

  .nav-link {
    color: rgba(255, 255, 255, 0.75);
    border: none !important;
    border-radius: 4px;
    padding: 0.25rem 0.75rem !important;
    transition: all 0.2s ease;
    font-weight: 500;
    font-size: 0.9rem;

    &:hover {
      color: white;
      background-color: rgba(255, 255, 255, 0.1);
    }

    &.active {
      color: white;
      background-color: rgba(255, 255, 255, 0.15);
      box-shadow: inset 0 -2px 0 white;
      border-radius: 0;
      font-weight: 600;

      [data-theme="dark"] & {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }

    &.disabled {
      color: rgba(255, 255, 255, 0.3) !important;
      cursor: not-allowed;
    }
  }
}
.mysql-version {
  a {
    color: rgba(255, 255, 255, 0.9);
    transition: color 0.2s ease;

    &:hover {
      color: white;
    }
  }
}

.mysql-header-btn {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.3);
    color: white;
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }
}

.mysql-header-btn-link {
  background-color: transparent;
  color: rgba(255, 255, 255, 0.9);
  border: none;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
  }
}

.header-divider {
  width: 1px;
  height: 24px;
  background-color: rgba(255, 255, 255, 0.3);
  margin: 0 0.25rem;
}
</style>
