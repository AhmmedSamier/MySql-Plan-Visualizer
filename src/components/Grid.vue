<script lang="ts" setup>
import _ from "lodash"
import { computed, onMounted } from "vue"
import type { Node } from "@/interfaces"
import GridRow from "@/components/GridRow.vue"
import { NodeProp } from "../enums"
import LevelDivider from "@/components/LevelDivider.vue"
import { store } from "@/store"
import type { FlattenedPlanNode } from "@/store"

onMounted((): void => {
  localStorage.setItem("gridIsNotNew", "true")
})

function isCTE(node: Node): boolean {
  return _.startsWith(node[NodeProp.SUBPLAN_NAME], "CTE")
}

const hasTime = computed((): boolean => {
  return _.some(store.flat, (plan: FlattenedPlanNode[]) => {
    return _.some(plan, (row: FlattenedPlanNode) => {
      return row.node[NodeProp.EXCLUSIVE_DURATION] || 0 > 1
    })
  })
})

const hasRows = computed((): boolean => {
  return _.some(store.flat, (plan: FlattenedPlanNode[]) => {
    return _.some(plan, (row: FlattenedPlanNode) => {
      return row.node[NodeProp.ACTUAL_ROWS_REVISED] || 0 > 1
    })
  })
})

const hasEstimation = computed((): boolean => {
  return _.some(store.flat, (plan: FlattenedPlanNode[]) => {
    return _.some(plan, (row: FlattenedPlanNode) => {
      return row.node[NodeProp.PLANNER_ESTIMATE_FACTOR] || 0 > 1
    })
  })
})

const hasLoops = computed((): boolean => {
  return _.some(store.flat, (plan: FlattenedPlanNode[]) => {
    return _.some(plan, (row: FlattenedPlanNode) => {
      return row.node[NodeProp.ACTUAL_LOOPS] > 1
    })
  })
})

const hasCost = computed((): boolean => {
  return _.some(store.flat, (plan: FlattenedPlanNode[]) => {
    return _.some(plan, (row: FlattenedPlanNode) => {
      return row.node[NodeProp.EXCLUSIVE_COST] > 1
    })
  })
})

const hasFilter = computed((): boolean => {
  return _.some(store.flat, (plan: FlattenedPlanNode[]) => {
    return _.some(plan, (row: FlattenedPlanNode) => {
      return (
        row.node[NodeProp.ROWS_REMOVED_BY_FILTER] ||
        row.node[NodeProp.ROWS_REMOVED_BY_JOIN_FILTER] ||
        row.node[NodeProp.ROWS_REMOVED_BY_INDEX_RECHECK]
      )
    })
  })
})

const hasHeapFetches = computed((): boolean => {
  return _.some(store.flat, (plan: FlattenedPlanNode[]) => {
    return _.some(plan, (row: FlattenedPlanNode) => {
      return row.node[NodeProp.HEAP_FETCHES]
    })
  })
})

const columnsLeft = computed<string[]>(() => {
  const cols = []
  if (hasTime.value) {
    cols.push("time")
  }
  if (hasRows.value) {
    cols.push("rows")
  }
  if (hasEstimation.value) {
    cols.push("estimation")
  }
  if (hasCost.value) {
    cols.push("cost")
  }
  if (hasLoops.value) {
    cols.push("loops")
  }
  if (hasFilter.value) {
    cols.push("filter")
  }
  if (hasHeapFetches.value) {
    cols.push("heapfetches")
  }
  return cols
})

const columns = computed(() => {
  return ([] as string[]).concat(columnsLeft.value)
})
</script>

<template>
  <div>
    <table class="table table-sm table-hover">
      <thead class="table-secondary sticky-top" style="z-index: 2">
        <tr>
          <th class="text-center"></th>
          <th class="text-center" v-if="hasTime">time</th>
          <th class="text-center" v-if="hasRows">rows</th>
          <th class="text-center" v-if="hasEstimation">estim</th>
          <th class="text-center" v-if="hasCost">cost</th>
          <th class="text-center" v-if="hasLoops">loops</th>
          <th class="text-center" v-if="hasFilter">filter</th>
          <th class="text-center" v-if="hasHeapFetches">heap</th>
          <th style="width: 100%"></th>
        </tr>
      </thead>
      <tbody v-for="(flat, index) in store.flat" :key="index">
        <template v-for="row in flat" :key="row">
          <tr v-if="row.node[NodeProp.SUBPLAN_NAME]">
            <td class="bg-light" :colspan="1 + columnsLeft.length"></td>
            <td
              class="plan pr-2 bg-light"
              :class="{ 'font-weight-bold': isCTE(row.node) }"
              :colspan="columns.length"
            >
              <LevelDivider :row="row"></LevelDivider>
              <b class="fst-italic text-reset">
                {{ row.node[NodeProp.SUBPLAN_NAME] }}
              </b>
            </td>
          </tr>
          <GridRow :row="row" :columns="columns"></GridRow>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
table {
  thead tr.table-group {
    th {
      border-left: 1px solid #b5b6b7;
      border-bottom: 0;
    }
    /*
     * This targets the second empty cell in a pair
     * and avoids border between 2 empty cells
     */
    th:empty + th:empty {
      border-left: 0;
    }
  }
}
</style>
