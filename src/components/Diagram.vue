<script lang="ts" setup>
import _ from "lodash"
import { inject, onBeforeMount, provide, reactive, ref, watch } from "vue"
import { NodeProp, Metric } from "../enums"
import { scrollChildIntoParentView } from "@/services/help-service"
import type { Node } from "@/interfaces"
import { HighlightedNodeIdKey, SelectNodeKey } from "@/symbols"
import DiagramRow from "@/components/DiagramRow.vue"
import LevelDivider from "@/components/LevelDivider.vue"
import { StoreKey } from "@/symbols"
import type { Store } from "@/store"

const store = inject(StoreKey) as Store
const container = ref(null) // The container element

const selectNode = inject(SelectNodeKey)
if (!selectNode) {
  throw new Error(`Could not resolve ${SelectNodeKey.description}`)
}
const highlightedNodeId = inject(HighlightedNodeIdKey)

const viewOptions = reactive({
  metric: Metric.time,
})

onBeforeMount((): void => {
  const savedOptions = localStorage.getItem("diagramViewOptions")
  if (savedOptions) {
    _.assignIn(viewOptions, JSON.parse(savedOptions))
  }
})

watch(viewOptions, onViewOptionsChanged)

function onViewOptionsChanged() {
  localStorage.setItem("diagramViewOptions", JSON.stringify(viewOptions))
}

function isCTE(node: Node): boolean {
  return _.startsWith(node[NodeProp.SUBPLAN_NAME], "CTE")
}

function scrollTo(el: Element) {
  if (!container.value) {
    return
  }
  scrollChildIntoParentView(container.value, el, false)
}

provide("scrollTo", scrollTo)
</script>

<template>
  <div class="diagram">
    <div class="flex-shrink-0">
      <div class="text-center my-1">
        <div class="btn-group btn-group-xs">
          <button
            class="btn btn-outline-secondary"
            :class="{ active: viewOptions.metric === Metric.time }"
            v-on:click="viewOptions.metric = Metric.time"
          >
            time
          </button>
          <button
            class="btn btn-outline-secondary"
            :class="{ active: viewOptions.metric === Metric.rows }"
            v-on:click="viewOptions.metric = Metric.rows"
          >
            rows
          </button>
          <button
            class="btn btn-outline-secondary"
            :class="{ active: viewOptions.metric === Metric.estimate_factor }"
            v-on:click="viewOptions.metric = Metric.estimate_factor"
          >
            estimation
          </button>
          <button
            class="btn btn-outline-secondary"
            :class="{ active: viewOptions.metric === Metric.cost }"
            v-on:click="viewOptions.metric = Metric.cost"
          >
            cost
          </button>
        </div>
      </div>
    </div>
    <div class="overflow-auto flex-grow-1" ref="container">
      <table class="m-1" :class="{ highlight: !!highlightedNodeId }">
        <tbody v-for="(flat, index) in store.flat" :key="index">
          <tr v-if="index === 0 && store.flat.length > 1">
            <th colspan="3" class="subplan">Main Query Plan</th>
          </tr>
          <template v-for="row in flat" :key="row">
            <tr v-if="row.node[NodeProp.SUBPLAN_NAME]">
              <td></td>
              <td
                class="subplan"
                :class="{ 'fw-bold': isCTE(row.node) }"
                :colspan="isCTE(row.node) ? 3 : 2"
              >
                <LevelDivider :row="row" dense></LevelDivider>
                <a
                  class="fst-italic text-reset"
                  href=""
                  @click.prevent="selectNode(row.node.nodeId, true)"
                >
                  {{ row.node[NodeProp.SUBPLAN_NAME] }}
                </a>
              </td>
            </tr>
            <DiagramRow :row="row" :viewOptions="viewOptions"></DiagramRow>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Ensure wrapper looks and behaves like a button for layout consistency */
.btn-group > .btn-tooltip-wrapper {
  &:not(:last-child) {
    margin-right: -1px;
  }

  & > .btn {
    border-radius: 0;
  }

  &:first-child > .btn {
    border-top-left-radius: 0.375rem;
    border-bottom-left-radius: 0.375rem;
  }
  &:last-child > .btn {
    border-top-right-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
  }
}
</style>
