<script lang="ts" setup>
import { inject } from "vue"
import Plan from "@/components/Plan.vue"
import { Splitpanes, Pane } from "splitpanes"
import "splitpanes/dist/splitpanes.css"
import type { Plan as PlanType } from "../types"

const compareData = inject<{ plan1: PlanType | null; plan2: PlanType | null }>("compareData")
</script>

<template>
    <div class="compare-view-container d-flex flex-column flex-grow-1 overflow-hidden">
        <div v-if="compareData?.plan1 && compareData?.plan2" class="flex-grow-1 overflow-hidden">
            <splitpanes class="default-theme">
                <pane min-size="20">
                    <div class="d-flex flex-column h-100 border-end">
                        <div
                            class="compare-header p-2 bg-secondary text-white small d-flex justify-content-between align-items-center">
                            <span><strong>Plan A:</strong> {{ compareData.plan1[0] }}</span>
                        </div>
                        <Plan :plan-source="compareData.plan1[1]" :plan-query="compareData.plan1[2]" />
                    </div>
                </pane>
                <pane min-size="20">
                    <div class="d-flex flex-column h-100">
                        <div
                            class="compare-header p-2 bg-secondary text-white small d-flex justify-content-between align-items-center">
                            <span><strong>Plan B:</strong> {{ compareData.plan2[0] }}</span>
                        </div>
                        <Plan :plan-source="compareData.plan2[1]" :plan-query="compareData.plan2[2]" />
                    </div>
                </pane>
            </splitpanes>
        </div>
        <div v-else class="p-5 text-center">
            <h3>Loading comparison...</h3>
            <p class="text-muted">If this takes too long, try selecting the plans again from the Home view.</p>
            <a href="/" class="btn btn-primary mt-3">Back to Home</a>
        </div>
    </div>
</template>

<style scoped>
.compare-view-container {
    height: 100%;
}

.compare-header {
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

:deep(.plan-container) {
    height: calc(100% - 37px) !important;
}
</style>
