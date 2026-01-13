<script lang="ts" setup>
import { ref, computed, provide, reactive, type Component, onMounted, watch, onBeforeUnmount } from "vue"
import AboutView from "./views/AboutView.vue"
import HomeView from "./views/HomeView.vue"
import NotFoundView from "./views/NotFoundView.vue"
import PlanView from "./views/PlanView.vue"
import type { ActivePlan } from "./types"
import idb from "./idb"

import MainLayout from "./layouts/MainLayout.vue"

const routes: Record<string, Component> = {
  "/": HomeView,
  "/about": AboutView,
}

const currentPath = ref(window.location.pathname.replace(import.meta.env.BASE_URL || "/", "/") || "/")
provide("currentPath", currentPath)

const currentView = computed(() => {
  if (currentPath.value.startsWith("/plan")) {
    return PlanView
  }
  const path = currentPath.value.startsWith("/") ? currentPath.value : "/" + currentPath.value
  return routes[path] || HomeView
})

// Use reactive so that changes are reflected
const planData = reactive<ActivePlan>(["", "", "", undefined])
provide("planData", planData)

function setPlanData(name: string, plan: string, query: string, id?: number) {
  planData[0] = plan
  planData[1] = query
  planData[2] = name
  planData[3] = id
  currentPath.value = id ? `/plan/${id}` : "/plan"
}
provide("setPlanData", setPlanData)
window.setPlanData = setPlanData

function resetPlan() {
  planData[0] = ""
  planData[1] = ""
  planData[2] = ""
  planData[3] = undefined
  currentPath.value = "/"
}
provide("resetPlan", resetPlan)

let handlePopState: () => void

onMounted(async () => {
  handlePopState = () => {
    const base = import.meta.env.BASE_URL || "/"
    currentPath.value = window.location.pathname.replace(base, "/") || "/"
  }
  window.addEventListener("popstate", handlePopState)

  const base = import.meta.env.BASE_URL || "/"
  const path = window.location.pathname.replace(base, "/")
  const matches = path.match(/^\/plan\/(\d+)/)
  if (matches) {
    const planId = parseInt(matches[1], 10)
    const plan = await idb.getPlan(planId)
    if (plan) {
      setPlanData(plan[0], plan[1], plan[2], planId)
    }
  }
})

watch(
  () => currentPath.value,
  (newPath) => {
    const base = import.meta.env.BASE_URL || "/"
    const normalizedBase = base.endsWith("/") ? base : base + "/"
    const normalizedPath = newPath.startsWith("/") ? newPath.slice(1) : newPath
    const url = new URL(normalizedBase + normalizedPath, window.location.origin)
    if (window.location.pathname !== url.pathname) {
      window.history.pushState({}, "", url.toString())
    }
  }
)

watch(
  () => planData[3],
  (newId) => {
    if (newId) {
      currentPath.value = `/plan/${newId}`
    }
  }
)
onBeforeUnmount(() => {
  if (handlePopState) {
    window.removeEventListener("popstate", handlePopState)
  }
})
</script>

<template>
  <MainLayout :title="currentPath.startsWith('/plan') ? planData[2] : ''">
    <component :is="currentView" />
  </MainLayout>
</template>

<style>
[v-cloak] {
  display: none;
}
</style>
