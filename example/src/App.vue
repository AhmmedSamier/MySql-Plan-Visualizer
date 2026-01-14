<script lang="ts" setup>
import {
  ref,
  computed,
  provide,
  reactive,
  type Component,
  onMounted,
  watch,
  onBeforeUnmount,
} from "vue"
import AboutView from "./views/AboutView.vue"
import HomeView from "./views/HomeView.vue"
import PlanView from "./views/PlanView.vue"
import CompareView from "./views/CompareView.vue"
import type { ActivePlan, Plan } from "./types"
import idb from "./idb"
import { decompressPlanFromUrl } from "./utils"

import MainLayout from "./layouts/MainLayout.vue"

const routes: Record<string, Component> = {
  "/": HomeView,
  "/about": AboutView,
}

const base = import.meta.env.BASE_URL || "/"

function getNormalizedPath(pathname: string): string {
  if (pathname.startsWith(base)) {
    return pathname.slice(base.length - 1) || "/"
  }
  const baseNoTrailing = base.endsWith("/") ? base.slice(0, -1) : base
  if (pathname.startsWith(baseNoTrailing)) {
    return pathname.slice(baseNoTrailing.length) || "/"
  }
  return pathname
}

const currentPath = ref(getNormalizedPath(window.location.pathname))
provide("currentPath", currentPath)

const currentView = computed(() => {
  if (currentPath.value.startsWith("/plan")) {
    return PlanView
  }
  if (currentPath.value.startsWith("/compare")) {
    return CompareView
  }
  const path = currentPath.value.startsWith("/")
    ? currentPath.value
    : "/" + currentPath.value
  return routes[path] || HomeView
})

// Use reactive so that changes are reflected
const planData = reactive<ActivePlan>(["", "", "", undefined])
provide("planData", planData)

const compareData = reactive<{ plan1: Plan | null; plan2: Plan | null }>({
  plan1: null,
  plan2: null,
})
provide("compareData", compareData)

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
    currentPath.value = getNormalizedPath(window.location.pathname)
  }
  window.addEventListener("popstate", handlePopState)

  const path = getNormalizedPath(window.location.pathname)
  const matches = path.match(/^\/plan\/(\d+)/)
  if (matches) {
    const planId = parseInt(matches[1], 10)
    const plan = await idb.getPlan(planId)
    if (plan) {
      setPlanData(plan[0], plan[1], plan[2], planId)
    }
  } else if (window.location.hash.startsWith("#plan=")) {
    // Handle Permalink
    const plan = decompressPlanFromUrl(window.location.hash)
    if (plan) {
      setPlanData(plan[0], plan[1], plan[2])
    }
  }

  const compareMatches = path.match(/^\/compare\/(\d+)\/(\d+)/)
  if (compareMatches) {
    const id1 = parseInt(compareMatches[1], 10)
    const id2 = parseInt(compareMatches[2], 10)
    const [p1, p2] = await Promise.all([idb.getPlan(id1), idb.getPlan(id2)])
    compareData.plan1 = p1 || null
    compareData.plan2 = p2 || null
    currentPath.value = `/compare/${id1}/${id2}`
  }
})

watch(
  () => currentPath.value,
  (newPath) => {
    const base = import.meta.env.BASE_URL || "/"
    const baseNoTrailing = base.endsWith("/") ? base.slice(0, -1) : base
    const normalizedPath = newPath.startsWith("/") ? newPath : "/" + newPath

    // Construct target path, ensuring no trailing slash for the base if the path is just "/"
    let targetPath = baseNoTrailing + normalizedPath
    if (newPath === "/" && baseNoTrailing) {
      targetPath = baseNoTrailing
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, "", targetPath)
    }
  },
)

watch(
  () => planData[3],
  (newId) => {
    if (newId) {
      currentPath.value = `/plan/${newId}`
    }
  },
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
