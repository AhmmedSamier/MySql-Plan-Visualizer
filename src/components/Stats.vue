<script lang="ts" setup>
import _ from "lodash"
import { computed, inject } from "vue"
import type { Node, StatsTableItemType } from "@/interfaces"
import { NodeProp, SortDirection } from "@/enums"
import SortedTable from "@/components/SortedTable.vue"
import SortLink from "@/components/SortLink.vue"
import StatsTableItem from "@/components/StatsTableItem.vue"
import { StoreKey } from "@/symbols"
import type { Store } from "@/store"

const store = inject(StoreKey) as Store

const executionTime = computed(
  () =>
    store.stats.executionTime ||
    (store.plan?.content.Plan?.[NodeProp.ACTUAL_TOTAL_TIME] as number),
)

const nodes = computed(() => {
  const allNodes: Node[] = []
  if (store.nodeById) {
    for (const flattenedNode of store.nodeById.values()) {
      allNodes.push(flattenedNode.node)
    }
  }
  return allNodes
})

const stats = computed(() => {
  const tables: Record<string, { nodes: Node[]; time: number }> = {}
  const functions: Record<string, { nodes: Node[]; time: number }> = {}
  const nodeTypes: Record<string, { nodes: Node[]; time: number }> = {}
  const indexes: Record<string, { nodes: Node[]; time: number }> = {}

  for (const node of nodes.value) {
    const duration = (node[NodeProp.EXCLUSIVE_DURATION] as number) || 0

    const tableName = node[NodeProp.RELATION_NAME] as string
    if (tableName) {
      if (!tables[tableName]) tables[tableName] = { nodes: [], time: 0 }
      tables[tableName].nodes.push(node)
      tables[tableName].time += duration
    }

    const functionName = node[NodeProp.FUNCTION_NAME] as string
    if (functionName) {
      if (!functions[functionName])
        functions[functionName] = { nodes: [], time: 0 }
      functions[functionName].nodes.push(node)
      functions[functionName].time += duration
    }

    const nodeType = node[NodeProp.NODE_TYPE] as string
    if (nodeType) {
      if (!nodeTypes[nodeType]) nodeTypes[nodeType] = { nodes: [], time: 0 }
      nodeTypes[nodeType].nodes.push(node)
      nodeTypes[nodeType].time += duration
    }

    const indexName = node[NodeProp.INDEX_NAME] as string
    if (indexName) {
      if (!indexes[indexName]) indexes[indexName] = { nodes: [], time: 0 }
      indexes[indexName].nodes.push(node)
      indexes[indexName].time += duration
    }
  }

  const formatValues = (group: Record<string, { nodes: Node[]; time: number }>) => {
    const values: StatsTableItemType[] = []
    for (const name in group) {
      const { nodes, time } = group[name]
      values.push({
        name,
        count: nodes.length,
        time,
        timePercent: time / executionTime.value,
        nodes,
      })
    }
    return values
  }

  return {
    perTable: formatValues(tables),
    perFunction: formatValues(functions),
    perNodeType: formatValues(nodeTypes),
    perIndex: formatValues(indexes),
  }
})
</script>

<template>
  <div class="small stats container-fluid mt-2">
    <div class="row row-cols-1 row-cols-lg-2 row-cols-xxl-3 g-4">
      <div class="col">
        <div class="card">
          <div class="card-body">
            <SortedTable
              class="table table-sm mb-0"
              :values="stats.perTable"
              sort="time"
              :dir="SortDirection.desc"
            >
              <thead class="table-secondary">
                <tr>
                  <th scope="col">
                    <SortLink name="name">Table</SortLink>
                  </th>
                  <th scope="col" class="text-end">
                    <SortLink name="count">Count</SortLink>
                  </th>
                  <th scope="col" colspan="2" class="text-end">
                    <SortLink name="time">Time</SortLink>
                  </th>
                </tr>
              </thead>
              <template v-slot:body="sort">
                <template v-for="value in sort.values" :key="value">
                  <StatsTableItem
                    :value="value as StatsTableItemType"
                    :executionTime="executionTime"
                  ></StatsTableItem>
                </template>
              </template>
              <tbody v-if="!stats.perTable.length">
                <tr>
                  <td colspan="3" class="text-center fst-italic">
                    No tables used
                  </td>
                </tr>
              </tbody>
            </SortedTable>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-body">
            <SortedTable
              class="table table-sm mb-0"
              :values="stats.perFunction"
              sort="time"
              :dir="SortDirection.desc"
            >
              <thead class="table-secondary">
                <tr>
                  <th scope="col">
                    <SortLink name="name">Function</SortLink>
                  </th>
                  <th scope="col" class="text-end">
                    <SortLink name="count">Count</SortLink>
                  </th>
                  <th scope="col" colspan="2" class="text-end">
                    <SortLink name="time">Time</SortLink>
                  </th>
                </tr>
              </thead>
              <template v-slot:body="sort">
                <template v-for="value in sort.values" :key="value">
                  <StatsTableItem
                    :value="value as StatsTableItemType"
                    :executionTime="executionTime"
                  ></StatsTableItem>
                </template>
              </template>
              <tbody v-if="!stats.perFunction.length">
                <tr>
                  <td colspan="3" class="text-center fst-italic">
                    No function used
                  </td>
                </tr>
              </tbody>
            </SortedTable>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-body">
            <SortedTable
              class="table table-sm mb-0"
              :values="stats.perNodeType"
              sort="time"
              :dir="SortDirection.desc"
            >
              <thead class="table-secondary">
                <tr>
                  <th scope="col">
                    <SortLink name="name">Node Type</SortLink>
                  </th>
                  <th scope="col" class="text-end">
                    <SortLink name="count">Count</SortLink>
                  </th>
                  <th scope="col" colspan="2" class="text-end">
                    <SortLink name="time">Time</SortLink>
                  </th>
                </tr>
              </thead>
              <template v-slot:body="sort">
                <template v-for="value in sort.values" :key="value">
                  <StatsTableItem
                    :value="value as StatsTableItemType"
                    :executionTime="executionTime"
                  ></StatsTableItem>
                </template>
              </template>
            </SortedTable>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-body">
            <SortedTable
              class="table table-sm mb-0"
              :values="stats.perIndex"
              sort="time"
              :dir="SortDirection.desc"
            >
              <thead class="table-secondary">
                <tr>
                  <th scope="col">
                    <SortLink name="name">Index</SortLink>
                  </th>
                  <th scope="col" class="text-end">
                    <SortLink name="count">Count</SortLink>
                  </th>
                  <th scope="col" colspan="2" class="text-end">
                    <SortLink name="time">Time</SortLink>
                  </th>
                </tr>
              </thead>
              <template v-slot:body="sort">
                <template v-for="value in sort.values" :key="value">
                  <StatsTableItem
                    :value="value as StatsTableItemType"
                    :executionTime="executionTime"
                  ></StatsTableItem>
                </template>
              </template>
              <tbody v-if="!stats.perIndex.length">
                <tr>
                  <td colspan="3" class="text-center fst-italic">
                    No index used
                  </td>
                </tr>
              </tbody>
            </SortedTable>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
