<script lang="ts" setup>
import { ref, computed, provide, reactive } from "vue"
import AboutView from "./views/AboutView.vue"
import HomeView from "./views/HomeView.vue"
import NotFoundView from "./views/NotFoundView.vue"
import PlanView from "./views/PlanView.vue"
import type { ActivePlan } from "./types"

const routes: Record<string, any> = {
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
const planData = reactive<ActivePlan>(["", "", ""])
provide("planData", planData)

function setPlanData(name: string, plan: string, query: string) {
  planData[0] = plan
  planData[1] = query
  planData[2] = name
  currentPath.value = "/plan"
}
provide("setPlanData", setPlanData)
window.setPlanData = setPlanData
</script>

<template>
  <component :is="currentView" />
</template>

<style>
[v-cloak] {
  display: none;
}
</style>
