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
import QuickCompareView from "./views/QuickCompareView.vue"
import type { ActivePlan, Plan } from "./types"
import idb from "./idb"
import { decompressPlanFromUrl } from "./utils"

import MainLayout from "./layouts/MainLayout.vue"

const routes: Record<string, Component> = {
  "/": HomeView,
  "/about": AboutView,
  "/compare-quick": QuickCompareView,
}

const base = import.meta.env.BASE_URL || "/"

function getNormalizedPath(pathname: string): string {
  const base = import.meta.env.BASE_URL || "/"
  const baseNoTrailing = base.replace(/\/$/, "")

  if (pathname.startsWith(baseNoTrailing)) {
    const pathAfterBase = pathname.slice(baseNoTrailing.length)
    return pathAfterBase.startsWith("/") ? pathAfterBase : "/" + pathAfterBase
  }
  return pathname || "/"
}

const currentPath = ref(getNormalizedPath(window.location.pathname))
provide("currentPath", currentPath)

const currentView = computed(() => {
  const path = currentPath.value.startsWith("/")
    ? currentPath.value
    : "/" + currentPath.value

  if (path.startsWith("/plan")) {
    return PlanView
  }
  if (path.startsWith("/compare") && !path.startsWith("/compare-quick")) {
    return CompareView
  }
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

// Flag to prevent recursive path updates
let isInternalPathUpdate = false

function setPlanData(
  name: string,
  plan: string,
  query: string,
  id?: number | string,
) {
  planData[0] = plan
  planData[1] = query
  planData[2] = name
  planData[3] = id

  const targetPath = id ? `/plan/${id}` : "/plan"
  if (currentPath.value !== targetPath) {
    isInternalPathUpdate = true
    currentPath.value = targetPath
    setTimeout(() => (isInternalPathUpdate = false), 0)
  }
}
provide("setPlanData", setPlanData)
window.setPlanData = setPlanData

function resetPlan() {
  planData[0] = ""
  planData[1] = ""
  planData[2] = ""
  planData[3] = undefined
  if (currentPath.value !== "/") {
    isInternalPathUpdate = true
    currentPath.value = "/"
    setTimeout(() => (isInternalPathUpdate = false), 0)
  }
}
provide("resetPlan", resetPlan)

async function fetchPlanByIdStr(idStr: string) {
  if (idStr.startsWith("r")) {
    const id = parseInt(idStr.substring(1), 10)
    return await idb.getRecentPlan(id)
  }
  const id = idStr.startsWith("s")
    ? parseInt(idStr.substring(1), 10)
    : parseInt(idStr, 10)
  return await idb.getPlan(id)
}

async function loadFromPath(path: string) {
  const matches = path.match(/^\/plan\/([rs]?\d+)/)
  if (matches) {
    const idStr = matches[1]
    // Only fetch if data is not already there or mismatched
    if (planData[3]?.toString() !== idStr) {
      const plan = await fetchPlanByIdStr(idStr)
      if (plan) {
        planData[0] = plan[1]
        planData[1] = plan[2]
        planData[2] = plan[0]
        planData[3] = idStr
      }
    }
  } else if (window.location.hash.startsWith("#plan=")) {
    const plan = decompressPlanFromUrl(window.location.hash)
    if (plan) {
      planData[0] = plan[1]
      planData[1] = plan[2]
      planData[2] = plan[0]
      planData[3] = undefined
    }
  }

  const compareMatches = path.match(/^\/compare\/([rs]?\d+)\/([rs]?\d+)/)
  if (compareMatches) {
    const id1Str = compareMatches[1]
    const id2Str = compareMatches[2]
    const [p1, p2] = await Promise.all([
      fetchPlanByIdStr(id1Str),
      fetchPlanByIdStr(id2Str),
    ])
    compareData.plan1 = p1 || null
    compareData.plan2 = p2 || null
  }
}

let handlePopState: () => void

onMounted(async () => {
  handlePopState = () => {
    currentPath.value = getNormalizedPath(window.location.pathname)
  }
  window.addEventListener("popstate", handlePopState)

  await loadFromPath(currentPath.value)
})

watch(
  () => currentPath.value,
  async (newPath) => {
    const base = import.meta.env.BASE_URL || "/"
    const baseNoTrailing = base.replace(/\/$/, "")
    const normalizedIdPath = newPath.startsWith("/") ? newPath : "/" + newPath

    let targetPath = ""
    if (normalizedIdPath === "/") {
      targetPath = base
    } else {
      targetPath = baseNoTrailing + normalizedIdPath
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, "", targetPath)
    }

    // If path changed externally (e.g. popstate), load the data
    if (!isInternalPathUpdate) {
      await loadFromPath(newPath)
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