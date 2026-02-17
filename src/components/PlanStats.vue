<script lang="ts" setup>
import { HelpService } from "@/services/help-service"
import { duration } from "@/filters"
import { directive as vTippy } from "vue-tippy"
import { StoreKey } from "@/symbols"
import type { Store } from "@/store"
import { inject, onMounted, ref } from "vue"

import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"

const store = inject(StoreKey) as Store
const helpService = new HelpService()
const getHelpMessage = helpService.getHelpMessage

const headerStatsSelector = ref<string | null>(null)
onMounted(() => {
  if (document.getElementById("header-stats")) {
    headerStatsSelector.value = "#header-stats"
  }
})

</script>

<template>
  <Teleport to="#header-stats" :disabled="!headerStatsSelector">
    <div
      class="plan-stats d-flex align-items-center"
      :class="{
        'p-2 bg-dark text-white border rounded m-2': !headerStatsSelector,
      }"
      v-if="store.stats"
    >
      <div class="d-inline-block px-2 text-nowrap">
        Execution:
        <template v-if="!store.stats.executionTime">
          <span class="text-white-50">
            N/A
            <FontAwesomeIcon
              :icon="faInfoCircle"
              class="cursor-help"
              v-tippy="getHelpMessage('missing execution time')"
            ></FontAwesomeIcon>
          </span>
        </template>
        <template v-else>
          <span
            class="stat-value text-white"
            v-html="duration(store.stats.executionTime)"
          ></span>
        </template>
      </div>
    </div>
  </Teleport>
</template>
