<script lang="ts" setup>
import { HelpService } from "@/services/help-service"
import { duration } from "@/filters"
import { directive as vTippy } from "vue-tippy"
import { store } from "@/store"

import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"

const helpService = new HelpService()
const getHelpMessage = helpService.getHelpMessage

const planningTimeClass = (percent: number) => {
  let c = NaN
  if (percent > 90) {
    c = 4
  } else if (percent > 40) {
    c = 3
  } else if (percent > 10) {
    c = 2
  }
  if (c) {
    return "c-" + c
  }
  return false
}

</script>

<template>
  <Teleport to="#header-stats">
    <div
      class="plan-stats d-flex align-items-center"
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
      <div class="d-inline-block border-start border-white-25 px-2 text-nowrap">
        Planning:
        <template v-if="!store.stats.planningTime">
          <span class="text-white-50">
            N/A
            <FontAwesomeIcon
              :icon="faInfoCircle"
              class="cursor-help"
              v-tippy="getHelpMessage('missing planning time')"
            ></FontAwesomeIcon>
          </span>
        </template>
        <template v-else>
          <span class="stat-value text-white">
            <span
              :class="
                'mb-0 p-0 px-1 alert ' +
                planningTimeClass(
                  (store.stats.planningTime /
                    (store.stats.executionTime as number)) *
                    100,
                )
              "
              v-html="duration(store.stats.planningTime)"
            ></span>
          </span>
        </template>
      </div>
    </div>
  </Teleport>
</template>
