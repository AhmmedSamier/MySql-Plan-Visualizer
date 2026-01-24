<script lang="ts" setup>
import { ref, useTemplateRef, type Ref } from "vue"
import { useDropZone } from "@vueuse/core"
import { Splitpanes, Pane } from "splitpanes"
import "splitpanes/dist/splitpanes.css"
import Plan from "@/components/Plan.vue"
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import { faRocket, faArrowLeft } from "@fortawesome/free-solid-svg-icons"
import type { Plan as PlanType } from "../types"

const showComparison = ref(false)

const planAInput = ref("")
const planBInput = ref("")

const planA = ref<PlanType | null>(null)
const planB = ref<PlanType | null>(null)

const dropZoneARef = useTemplateRef("dropZoneARef")
const { isOverDropZone: isOverDropZoneA } = useDropZone(dropZoneARef, (files) =>
  onDrop(files, planAInput),
)

const dropZoneBRef = useTemplateRef("dropZoneBRef")
const { isOverDropZone: isOverDropZoneB } = useDropZone(dropZoneBRef, (files) =>
  onDrop(files, planBInput),
)

function onDrop(files: File[] | null, input: Ref<string>) {
  if (files) {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        return
      }
      input.value = reader.result || ""
    }
    reader.readAsText(files[0])
  }
}

function compare() {
  if (!planAInput.value || !planBInput.value) return

  // Create temporary plan objects
  const now = new Date().toISOString()
  planA.value = ["Plan A", planAInput.value, "", now]
  planB.value = ["Plan B", planBInput.value, "", now]
  showComparison.value = true
}

function reset() {
  showComparison.value = false
  planA.value = null
  planB.value = null
}
</script>

<template>
  <div class="h-100 d-flex flex-column bg-light">
    <!-- Input Mode -->
    <div v-if="!showComparison" class="container py-4">
      <div class="row justify-content-center mb-4">
        <div class="col-lg-8 text-center">
          <h2 class="fw-bold mb-3 text-gradient">Quick Compare</h2>
          <p class="text-secondary">
            Paste two execution plans below to compare them side-by-side without
            saving.
          </p>
        </div>
      </div>

      <div class="row g-4">
        <div class="col-md-6">
          <div class="card h-100 shadow-sm border-0">
            <div
              class="card-header bg-white fw-bold py-3 border-bottom-0 d-flex align-items-center"
            >
              <span class="badge bg-primary me-2 rounded-circle p-2">A</span>
              Plan A
            </div>
            <div class="card-body p-0">
              <textarea
                ref="dropZoneARef"
                :class="[
                  'form-control border-0 h-100 p-3',
                  isOverDropZoneA ? 'bg-light-primary' : '',
                ]"
                style="resize: none; min-height: 400px; box-shadow: none"
                v-model="planAInput"
                placeholder="Paste Plan A (JSON/TREE)..."
              ></textarea>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card h-100 shadow-sm border-0">
            <div
              class="card-header bg-white fw-bold py-3 border-bottom-0 d-flex align-items-center"
            >
              <span class="badge bg-info me-2 rounded-circle p-2">B</span>
              Plan B
            </div>
            <div class="card-body p-0">
              <textarea
                ref="dropZoneBRef"
                :class="[
                  'form-control border-0 h-100 p-3',
                  isOverDropZoneB ? 'bg-light-primary' : '',
                ]"
                style="resize: none; min-height: 400px; box-shadow: none"
                v-model="planBInput"
                placeholder="Paste Plan B (JSON/TREE)..."
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="text-center mt-4">
        <button
          @click="compare"
          class="btn btn-lg btn-primary px-5 py-3 rounded-pill shadow-lg"
          :disabled="!planAInput || !planBInput"
        >
          <FontAwesomeIcon :icon="faRocket" class="me-2" />
          Compare Plans
        </button>
      </div>
    </div>

    <!-- Comparison Mode -->
    <div v-else class="flex-grow-1 d-flex flex-column overflow-hidden">
      <div class="bg-white border-bottom p-2 d-flex align-items-center">
        <button @click="reset" class="btn btn-sm btn-outline-secondary me-3">
          <FontAwesomeIcon :icon="faArrowLeft" class="me-1" /> Back
        </button>
        <span class="fw-bold">Comparison Result</span>
      </div>
      <div class="flex-grow-1 overflow-hidden position-relative">
        <Splitpanes class="default-theme">
          <Pane min-size="20">
            <div class="d-flex flex-column h-100 border-end">
              <div
                class="p-2 bg-light text-secondary small fw-bold border-bottom"
              >
                Plan A
              </div>
              <Plan
                v-if="planA"
                :plan-source="planA[1]"
                :plan-query="planA[2]"
              />
            </div>
          </Pane>
          <Pane min-size="20">
            <div class="d-flex flex-column h-100">
              <div
                class="p-2 bg-light text-secondary small fw-bold border-bottom"
              >
                Plan B
              </div>
              <Plan
                v-if="planB"
                :plan-source="planB[1]"
                :plan-query="planB[2]"
              />
            </div>
          </Pane>
        </Splitpanes>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.text-gradient {
  background: linear-gradient(135deg, #00758f 0%, #00a4db 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.bg-light-primary {
  background-color: rgba(0, 117, 143, 0.05) !important;
}

// Dark Mode
[data-theme="dark"] {
  .bg-light {
    background-color: #0d1117 !important;
  }
  .card {
    background-color: #161b22;
    .card-header {
      background-color: #161b22 !important;
      color: #e1e1e1;
    }
  }
  textarea {
    background-color: #0b0e14 !important;
    color: #e1e1e1 !important;
    &::placeholder {
      color: #6e7681;
    }
  }
}
</style>
