<script lang="ts" setup>
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
import { HighlightType, NodeProp, Orientation } from "@/enums"
import { json_, mysql_ } from "@/filters"
import { setDefaultProps } from "vue-tippy"
import { createStore } from "@/store.ts"
import { StoreKey } from "@/symbols"
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
  faShareAlt,
  faFileImage,
  faCheck,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons"
import * as htmlToImage from "html-to-image"
import { compressPlanToUrl, copyToClipboard } from "@/services/share-service"

import { usePlanLayout } from "@/composables/usePlanLayout"

setDefaultProps({ theme: "light" })

import "tippy.js/dist/tippy.css"
import "tippy.js/themes/light.css"

import type { FlexHierarchyPointNode } from "d3-flextree"

interface Props {
  planSource: string
  planQuery: string
}
const props = defineProps<Props>()

const version = __APP_VERSION__

const rootEl = ref(null) // The root Element of this instance
const activeTab = ref<string>("")
const planEl = ref()

const store = createStore()
provide(StoreKey, store)

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

const {
  transform,
  edgeWeight,
  layoutRootNode,
  ctes,
  cteGraphs,
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
  buildTree,
} = usePlanLayout(planEl, viewOptions, store)

// Vertical padding between 2 nodes in the tree layout
const padding = 40

const headerTabsSelector = ref<string | null>(null)
const headerToolsSelector = ref<string | null>(null)

onMounted(() => {
  if (document.getElementById("header-tabs")) {
    headerTabsSelector.value = "#header-tabs"
  }
  if (document.getElementById("header-tools")) {
    headerToolsSelector.value = "#header-tools"
  }

  watch(
    () => [props.planSource, props.planQuery],
    () => {
      parseAndShow()
    },
    {
      immediate: true,
    },
  )
  window.addEventListener("keydown", handleKeyDown)
  window.addEventListener("hashchange", onHashChange)
})

let parseCounter = 0
async function parseAndShow() {
  const currentCounter = ++parseCounter
  ready.value = false
  await store.parse(props.planSource, props.planQuery)
  if (currentCounter !== parseCounter) {
    return
  }
  const savedOptions = localStorage.getItem("viewOptions")
  if (savedOptions) {
    Object.assign(viewOptions, JSON.parse(savedOptions))
  }

  // Set initial tab from hash or default to plan
  onHashChange()

  buildTree(store.plan)

  nextTick(() => {
    initZoom()
    ready.value = true
  })
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
    selectedNode.value = store.nodeById?.get(v)?.node
  }
}

function onHashChange(): void {
  const hash = window.location.hash
  if (!hash || hash === "#") {
    setActiveTab("plan")
    return
  }

  // Regex to match tab and optional node selection
  // Format: #tab/node/id
  const reg = /^#([a-zA-Z]*)(?:\/node\/([0-9]*))*/
  const matches = reg.exec(hash)
  if (matches) {
    const tab = matches[1] || "plan"
    setActiveTab(tab)

    const nodeIdStr = matches[2]
    if (tab === "plan" && nodeIdStr) {
      const nodeId = parseInt(nodeIdStr, 10)
      if (!isNaN(nodeId) && nodeId !== selectedNodeId.value) {
        // Delayed to make sure the tab has changed before recentering
        setTimeout(() => {
          selectNode(nodeId, true)
        }, 1)
      }
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

const setActiveTab = (tab: string) => {
  activeTab.value = tab
}

const switchTab = (tab: string) => {
  setActiveTab(tab)
  const currentHash = window.location.hash
  const targetHash =
    tab === "plan" && selectedNodeId.value
      ? `#plan/node/${selectedNodeId.value}`
      : `#${tab}`
  if (currentHash !== targetHash) {
    window.location.hash = targetHash
  }
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
    const rootSizes = tree.value
      .descendants()
      .map((item: FlexHierarchyPointNode<Node>) => item.data.size)
    // Avoid spread operator for large arrays
    rootSizes.forEach((size) => data.push(size))

    ctes.value.forEach((tree) => {
      const cteSizes = tree
        .descendants()
        .map((item: FlexHierarchyPointNode<Node>) => item.data.size)
      cteSizes.forEach((size) => data.push(size))
    })
    return JSON.stringify(data)
  },
  () => {
    doLayout()
    if (shouldAutoFit.value) {
      fitToScreen()
      shouldAutoFit.value = false
    }
  },
)

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
  if (node[NodeProp.SEARCH_STRING]) {
    return node[NodeProp.SEARCH_STRING].includes(term)
  }

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

const isShared = ref(false)
const isSharing = ref(false)
async function sharePlan() {
  if (isSharing.value) return
  isSharing.value = true
  const plan: [string, string, string, string] = [
    store.plan?.name || "Shared Plan",
    props.planSource,
    props.planQuery,
    new Date().toISOString(),
  ]
  try {
    const url = await compressPlanToUrl(plan)
    const success = await copyToClipboard(url)
    if (success) {
      isShared.value = true
      setTimeout(() => (isShared.value = false), 2000)
    }
  } finally {
    isSharing.value = false
  }
}

const isExporting = ref(false)
function exportPng() {
  if (!rootEl.value) return
  isExporting.value = true
  // Hide some elements before capture if needed
  htmlToImage
    .toPng(rootEl.value, {
      backgroundColor: "#f8f9fa",
      filter: (node) => {
        // Exclude the toolbar itself if we want a clean capture
        return !(node instanceof HTMLElement && node.id === "header-tools")
      },
    })
    .then((dataUrl) => {
      const link = document.createElement("a")
      link.download = `mysql-plan-${new Date().getTime()}.png`
      link.href = dataUrl
      link.click()
    })
    .catch((error) => {
      console.error("Oops, something went wrong!", error)
    })
    .finally(() => {
      isExporting.value = false
    })
}
</script>

<template>
  <div
    v-if="store.parsing"
    class="flex-grow-1 d-flex justify-content-center align-items-center"
  >
    <div class="text-center">
      <div class="spinner-border text-primary mb-3" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <h5 class="text-secondary">Parsing Execution Plan...</h5>
    </div>
  </div>
  <div
    v-else-if="!store.plan"
    class="flex-grow-1 d-flex justify-content-center"
  >
    <div class="card align-self-center border-danger w-50 shadow-sm">
      <div class="card-body">
        <h5 class="card-title text-danger">Couldn't parse plan</h5>
        <h6 class="card-subtitle mb-2 text-body-secondary">
          An error occurred while parsing the plan source.
        </h6>
        <div
          class="overflow-hidden d-flex w-100 h-100 position-relative mb-3 border rounded"
        >
          <div class="overflow-auto flex-grow-1 bg-light">
            <pre
              class="small p-2 mb-0"
              style="max-height: 200px"
            ><code v-html="planSource"></code></pre>
          </div>
          <Copy :content="planSource" />
        </div>
        <p class="card-text text-body-dark">
          {{ store.error || "The plan you submitted couldn't be correctly interpreted. This might be due to an unsupported MySQL version or a specific configuration." }}
        </p>
        <div class="d-flex align-items-center border-top pt-3">
          <span class="text-secondary small">
            <LogoImage />
            MysqlPlanVisualizer <i>version {{ version }}</i>
          </span>
          <a
            href="https://github.com/ahmmedsamier/MySql-Plan-Visualizer/issues/new?template=parsing_error.md&labels=parsing&title=Failed+to+parse+plan"
            target="_blank"
            class="btn btn-sm btn-outline-primary ms-auto"
            >Report Issue on GitHub</a
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
    <Teleport to="#header-tabs" :disabled="!headerTabsSelector">
      <ul
        class="nav nav-tabs mysql-tabs flex-nowrap border-0"
        :class="{ 'p-2 bg-dark': !headerTabsSelector }"
      >
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'plan' }"
            href="#plan"
            @click.prevent="switchTab('plan')"
            >Plan</a
          >
        </li>
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'grid' }"
            href="#grid"
            @click.prevent="switchTab('grid')"
            >Grid</a
          >
        </li>
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'diagram' }"
            href="#diagram"
            @click.prevent="switchTab('diagram')"
            >Diagram</a
          >
        </li>
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'raw' }"
            href="#raw"
            @click.prevent="switchTab('raw')"
            >Raw</a
          >
        </li>
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'query' }"
            href="#query"
            @click.prevent="switchTab('query')"
            >Query</a
          >
        </li>
        <li class="nav-item p-1">
          <a
            class="nav-link px-2 py-0"
            :class="{ active: activeTab === 'stats' }"
            href="#stats"
            @click.prevent="switchTab('stats')"
            >Stats</a
          >
        </li>
      </ul>
    </Teleport>
    <Teleport to="#header-tools" :disabled="!headerToolsSelector">
      <div
        class="d-flex align-items-center me-2 gap-2"
        :class="{ 'p-2': !headerToolsSelector }"
      >
        <button
          class="btn btn-sm"
          :class="isShared ? 'btn-success' : 'btn-outline-primary'"
          @click="sharePlan"
          title="Copy permalink to clipboard"
          style="white-space: nowrap"
          :disabled="isSharing"
        >
          <FontAwesomeIcon
            :icon="isShared ? faCheck : (isSharing ? faSpinner : faShareAlt)"
            class="me-1"
            :spin="isSharing"
          />
          {{ isShared ? "Copied!" : (isSharing ? "Sharing..." : "Share") }}
        </button>
        <button
          class="btn btn-sm btn-outline-primary"
          @click="exportPng"
          :disabled="isExporting"
          title="Export as PNG"
          style="white-space: nowrap"
        >
          <FontAwesomeIcon
            :icon="faFileImage"
            class="me-1"
            :spin="isExporting"
          />
          {{ isExporting ? "Exporting..." : "Export PNG" }}
        </button>
      </div>
    </Teleport>
    <PlanStats />
    <div class="tab-content flex-grow-1 d-flex overflow-hidden">
      <div
        class="tab-pane flex-grow-1 overflow-hidden"
        :class="{ 'show active d-flex': activeTab === 'plan' }"
      >
        <!-- Plan tab -->
        <div class="d-flex flex-column flex-grow-1 overflow-hidden">
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
                        v-for="(link, index) in rootLinks"
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
                        v-for="(item, index) in rootDescendants"
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
                      <g v-for="cteGraph in cteGraphs" :key="cteGraph.key">
                        <rect
                          :x="cteGraph.extent[0] - padding / 4"
                          :y="cteGraph.extent[2] - padding / 2"
                          :width="
                            cteGraph.extent[1] -
                            cteGraph.extent[0] +
                            padding / 2
                          "
                          :height="cteGraph.extent[3] - cteGraph.extent[2]"
                          stroke="#cfcfcf"
                          stroke-width="2"
                          fill="#cfcfcf"
                          fill-opacity="10%"
                          rx="5"
                          ry="5"
                        ></rect>
                        <AnimatedEdge
                          v-for="(link, index) in cteGraph.links"
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
                          v-for="(item, index) in cteGraph.descendants"
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
          <Grid class="flex-grow-1 overflow-auto plan-grid" />
        </div>
      </div>
      <div
        class="tab-pane flex-grow-1 overflow-hidden position-relative"
        :class="{ 'show active': activeTab === 'diagram' }"
        v-if="activeTab === 'diagram'"
      >
        <div class="overflow-hidden d-flex w-100 h-100 flex-column">
          <Diagram class="flex-grow-1 overflow-auto plan-diagram" />
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
