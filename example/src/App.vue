<script lang="ts" setup>
import { ref, computed, provide, reactive, type Component, onMounted, watch } from "vue"
import AboutView from "./views/AboutView.vue"
import HomeView from "./views/HomeView.vue"
import NotFoundView from "./views/NotFoundView.vue"
import PlanView from "./views/PlanView.vue"
import type { ActivePlan } from "./types"
import idb from "./idb"

const routes: Record<string, Component> = {
  "/": HomeView,
  "/about": AboutView,
  "/plan": PlanView,
}

const currentPath = ref("/")
provide("currentPath", currentPath)

const currentView = computed(() => {
  return routes[currentPath.value] || NotFoundView
})

// Use reactive so that changes are reflected
const planData = reactive<ActivePlan>(["", "", "", undefined])
provide("planData", planData)

function setPlanData(name: string, plan: string, query: string, id?: number) {
  planData[0] = plan
  planData[1] = query
  planData[2] = name
  planData[3] = id
  currentPath.value = "/plan"
}
provide("setPlanData", setPlanData)
window.setPlanData = setPlanData

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const id = urlParams.get("id")
  if (id) {
    const planId = parseInt(id, 10)
    const plan = await idb.getPlan(planId)
    if (plan) {
      setPlanData(plan[0], plan[1], plan[2], planId)
    }
  }
})

watch(
  () => planData[3],
  (newId) => {
    const url = new URL(window.location.href)
    if (newId) {
      url.searchParams.set("id", newId.toString())
    } else {
      url.searchParams.delete("id")
    }
    window.history.replaceState({}, "", url.toString())
  }
)
</script>

<template>
  <component :is="currentView" />
</template>

<style>
[v-cloak] {
  display: none;
}
</style>
