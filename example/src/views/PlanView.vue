<script lang="ts" setup>
import { inject } from "vue"
import Plan from "@/components/Plan.vue"
import type { ActivePlan } from "../types"

const planData = inject<ActivePlan>("planData")
</script>

<template>
  <Plan
    v-if="planData && planData[0]"
    :plan-source="planData[0]"
    :plan-query="planData[1]"
  />
</template>
