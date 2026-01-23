<script lang="ts" setup>
import { computed, inject, useTemplateRef, ref, onMounted, watch } from "vue"
import { type Ref } from "vue"

import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import { directive as vTippy } from "vue-tippy"
import { useDropZone } from "@vueuse/core"

import { time_ago } from "../utils"
import type { Plan, Sample } from "../types"
import VersionCheck from "../components/VersionCheck.vue"
import {
  faEdit,
  faTrash,
  faDownload,
  faUpload,
  faRocket,
  faMagic,
  faHistory,
  faCheckSquare,
  faTimes,
  faColumns,
  faClock,
} from "@fortawesome/free-solid-svg-icons"
import samples from "../samples.ts"

import idb from "../idb"

const setPlanData = inject("setPlanData") as (
  name: string,
  plan: string,
  query: string,
  id?: number | string,
) => void
const currentPath = inject("currentPath") as Ref<string>

const planInput = ref<string>("")
const queryInput = ref<string>("")
const planName = ref<string>("")

type SavedPlan = Plan & { id?: number }

const savedPlans = ref<SavedPlan[]>([])
const recentPlans = ref<SavedPlan[]>([])
const activeHistoryTab = ref<"saved" | "recent">("saved")

const pageSize = 11
const maxVisiblePages = 5
const currentPage = ref<number>(1)

const currentList = computed(() => {
  return activeHistoryTab.value === "saved"
    ? savedPlans.value
    : recentPlans.value
})

const totalPages = computed(() => {
  return Math.ceil(currentList.value.length / pageSize)
})
const hovered = ref<number | null>(null)
const selectionMode = ref(false)
const selection = ref<SavedPlan[]>([])

const paginatedPlans = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return currentList.value.slice(start, end)
})

const visiblePages = computed(() => {
  const total = totalPages.value
  const half = Math.floor(maxVisiblePages / 2)
  let start = currentPage.value - half
  let end = currentPage.value + half

  if (start < 1) {
    start = 1
    end = Math.min(maxVisiblePages, total)
  }
  if (end > total) {
    end = total
    start = Math.max(1, total - maxVisiblePages + 1)
  }

  const pages = []
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const planDropZoneRef = useTemplateRef("planDropZoneRef")
const { isOverDropZone: isOverPlanDropZone } = useDropZone(
  planDropZoneRef,
  (files) => onDrop(files, planInput),
)
const queryDropZoneRef = useTemplateRef("queryDropZoneRef")
const { isOverDropZone: isOverQueryDropZone } = useDropZone(
  queryDropZoneRef,
  (files) => onDrop(files, queryInput),
)

const savedPlansDropZoneRef = useTemplateRef("savedPlansDropZoneRef")
const { isOverDropZone: isOverSavedPlansDropZone } = useDropZone(
  savedPlansDropZoneRef,
  {
    onDrop: (files) => {
      if (files) onImport(files)
    },
    dataTypes: ["json"],
    multiple: false,
  },
)

async function submitPlan() {
  const newPlan: Plan = ["", "", "", ""]
  newPlan[0] =
    planName.value ||
    "New Plan - " +
      new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
      })
  newPlan[1] = planInput.value
  newPlan[2] = queryInput.value
  newPlan[3] = new Date().toISOString()
  
  await idb.saveRecentPlan(newPlan)
  const id = await savePlanData(newPlan)

  setPlanData(newPlan[0], newPlan[1], newPlan[2], id)
}

async function savePlanData(sample: Plan) {
  return await idb.savePlan(sample)
}

onMounted(() => {
  const textAreas = document.getElementsByTagName("textarea")
  Array.prototype.forEach.call(textAreas, (elem: HTMLInputElement) => {
    elem.placeholder = elem.placeholder.replace(/\\n/g, "\n")
  })
  const noHashURL = window.location.href.replace(/#.*$/, "")
  window.history.replaceState("", document.title, noHashURL)
  loadPlans()
})

async function loadPlans() {
  const plans = await idb.getPlans()
  savedPlans.value = plans
    .slice()
    .sort((a, b) => new Date(a[3]).getTime() - new Date(b[3]).getTime())
    .reverse()

  const recents = await idb.getRecentPlans()
  recentPlans.value = recents
}

function loadPlan(plan?: Plan | Sample) {
  if (!plan) {
    return
  }

  planName.value = plan[0]
  planInput.value = plan[1]
  queryInput.value = plan[2]
}

function openOrSelectPlan(plan: Plan) {
  if (!selectionMode.value) {
    openPlan(plan)
  } else {
    togglePlanSelection(plan)
  }
}

function openPlan(plan: Plan & { id?: number }) {
  let id: number | string | undefined = plan.id
  if (id && activeHistoryTab.value === "recent") {
    id = `r${id}`
  }
  setPlanData(plan[0], plan[1], plan[2], id)
}

function isSelected(id: string) {
  return selection.value.some((p) => p[3] === id)
}

function togglePlanSelection(plan: Plan) {
  const index = selection.value.findIndex((p) => p[3] === plan[3])
  if (index === -1) {
    selection.value.push(plan)
  } else {
    selection.value.splice(index, 1)
  }
}

function editPlan(plan: Plan) {
  loadPlan(plan)
}

function plansFromSelection() {
  return selection.value.length > 0 ? selection.value : currentList.value
}

function deletePlans() {
  if (confirm("Are you sure you want to delete plans?")) {
    const plans = plansFromSelection()
    plans.forEach(async (plan) => {
      if (activeHistoryTab.value === "recent") {
        await idb.deleteRecentPlan(plan)
      } else {
        await idb.deletePlan(plan)
      }
    })
    loadPlans()
    selectionMode.value = false
    addMessage(`Deleted ${plans.length} plans`)
  }
  // reset page
  currentPage.value = 1
}

async function deletePlan(plan: Plan) {
  if (activeHistoryTab.value === "recent") {
    await idb.deleteRecentPlan(plan)
  } else {
    await idb.deletePlan(plan)
  }
  loadPlans()
}

async function clearAllPlans() {
  if (activeHistoryTab.value === "recent") {
    if (confirm("Are you sure you want to delete ALL recent plans?")) {
      await idb.clearRecentPlans()
      loadPlans()
      currentPage.value = 1
      addMessage("All recent plans cleared")
    }
  } else {
    if (
      confirm(
        "Are you sure you want to delete ALL saved plans? This cannot be undone.",
      )
    ) {
      await idb.clearPlans()
      loadPlans()
      currentPage.value = 1
      addMessage("All plans cleared")
    }
  }
}

function compareSelectedPlans() {
  if (selection.value.length !== 2) return
  const prefix = activeHistoryTab.value === "recent" ? "r" : "s"
  const id1 = selection.value[0].id
  const id2 = selection.value[1].id
  currentPath.value = `/compare/${prefix}${id1}/${prefix}${id2}`
}

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

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}
function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}
function goToPage(page: number) {
  currentPage.value = page
}

watch(
  () => selectionMode.value,
  () => {
    selection.value = []
  },
)

const fileInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  fileInput.value?.click()
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  onImport(Array.from(input.files))
}

function onImport(files: File[]) {
  const file = files[0]
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const plans = JSON.parse(reader.result as string)
      const counts = await idb.importPlans(plans)
      let message = `Imported ${counts[0]} plans`
      if (counts[1]) {
        message += ` <i>(${counts[1]} duplicates found)</i>`
      }
      addMessage(message)
      loadPlans()
    } catch (error: unknown) {
      console.error("Invalid file format", error)
      alert("Invalid file format")
    }
  }
  reader.readAsText(file)
}

async function exportPlans(plans?: Plan[]) {
  if (!plans) {
    plans = plansFromSelection()
  }
  const blob = new Blob([JSON.stringify(plans, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "plans.json"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  addMessage(`Exported ${plans.length} plans`)
}

interface Message {
  id: number
  text: string
}

const messages = ref<Message[]>([])

function addMessage(text: string) {
  const id = Date.now() + Math.random()

  messages.value.push({ id, text })
  setTimeout(() => {
    messages.value = messages.value.filter((m) => m.id !== id)
  }, 3000)
}
</script>

<template>
  <div class="mysql-home-page">
    <div class="container py-4">
      <div class="row justify-content-center">
        <div class="col-lg-10">
          <!-- Hero Section -->
          <div class="text-center mb-5">
            <!-- Dolphin Emoji centered -->
            <div class="hero-icon mb-3">🐬</div>
            <h1 class="display-4 fw-bold mb-3 text-gradient">
              MySQL Plan Visualizer
            </h1>
            <p class="lead text-secondary mx-auto" style="max-width: 600px">
              Transform your nested MySQL execution plans into intuitive,
              beautiful, and actionable visualizations. Fix slow queries faster.
            </p>
          </div>
        </div>
      </div>

      <div class="container mt-4">
        <VersionCheck />
        <div class="alert alert-info mysql-info-alert">
          <i class="fas fa-info-circle me-2"></i>
          This is a serverless application - your plans never leave your
          browser.
          <a
            href="https://github.com/ahmmedsamier/MySql-Plan-Visualizer"
            class="alert-link"
            >Learn more</a
          >
        </div>

        <!-- Input Form -->
        <div class="mysql-tip-card mb-3">
          <i class="fas fa-lightbulb text-warning me-2"></i>
          <span class="text-secondary">
            For best results, use
            <code class="mysql-code">EXPLAIN FORMAT=TREE</code> or
            <code class="mysql-code">EXPLAIN FORMAT=JSON</code>
          </span>
        </div>

        <form v-on:submit.prevent="submitPlan" class="mysql-input-form">
          <div class="card mysql-input-card mb-3">
            <div class="card-header d-flex align-items-center">
              <span class="fw-bold">
                <i class="fas fa-code me-2"></i>Execution Plan
              </span>
              <div class="dropdown ms-auto">
                <button
                  class="btn btn-outline-light dropdown-toggle btn-sm"
                  type="button"
                  id="dropdownMenuButton"
                  data-bs-toggle="dropdown"
                  aria-haspopup="true"
                  aria-expanded="false"
                >
                  <i class="fas fa-file-code me-1"></i>Sample Plans
                </button>
                <div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
                  <a
                    v-for="(sample, index) in samples"
                    :key="index"
                    class="dropdown-item"
                    v-on:click.prevent="loadPlan(sample)"
                    href=""
                  >
                    {{ sample[0] }}
                  </a>
                </div>
              </div>
            </div>
            <div class="card-body">
              <textarea
                ref="planDropZoneRef"
                :class="[
                  'form-control',
                  isOverPlanDropZone ? 'dropzone-over' : '',
                ]"
                id="planInput"
                rows="6"
                v-model="planInput"
                placeholder="Paste your MySQL execution plan here (TREE or JSON format)&#10;Or drop a file..."
              >
              </textarea>
              <small class="text-muted">
                <i class="fas fa-info-circle me-1"></i>
                Supports TREE format, JSON format, or traditional EXPLAIN output
              </small>
            </div>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-md-8">
              <div class="card mysql-input-card h-100">
                <div class="card-header">
                  <i class="fas fa-terminal me-2"></i>SQL Query
                  <span class="badge bg-secondary ms-2">Optional</span>
                </div>
                <div class="card-body">
                  <textarea
                    ref="queryDropZoneRef"
                    :class="[
                      'form-control',
                      isOverQueryDropZone ? 'dropzone-over' : '',
                    ]"
                    id="queryInput"
                    rows="4"
                    v-model="queryInput"
                    placeholder="Paste your SQL query here (optional)&#10;Or drop a file..."
                  >
                  </textarea>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card mysql-input-card h-100">
                <div class="card-header">
                  <i class="fas fa-tag me-2"></i>Plan Name
                  <span class="badge bg-secondary ms-2">Optional</span>
                </div>
                <div class="card-body">
                  <input
                    type="text"
                    class="form-control"
                    id="planName"
                    v-model="planName"
                    placeholder="Name for this plan"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Big Prominent Submit Button -->
          <div class="text-center mt-4">
            <button
              type="submit"
              class="btn btn-lg mysql-submit-btn-premium px-5 py-3"
            >
              <FontAwesomeIcon :icon="faRocket" class="me-2" />
              <span>Visualize Plan</span>
              <FontAwesomeIcon :icon="faMagic" class="ms-2 opacity-75" />
            </button>
          </div>
        </form>

        <!-- Saved Plans History Section -->
        <div class="card mysql-history-card mt-5 mb-5">
          <div class="card-header d-flex align-items-center p-0">
            <button
              class="btn btn-link text-decoration-none rounded-0 py-3 px-4 fw-bold"
              :class="
                activeHistoryTab === 'saved'
                  ? 'active-tab text-white'
                  : 'text-white-50'
              "
              @click="activeHistoryTab = 'saved'"
            >
              <FontAwesomeIcon :icon="faHistory" class="me-2" />Saved Plans
              <span class="badge bg-light text-dark ms-2">{{
                savedPlans.length
              }}</span>
            </button>
            <button
              class="btn btn-link text-decoration-none rounded-0 py-3 px-4 fw-bold"
              :class="
                activeHistoryTab === 'recent'
                  ? 'active-tab text-white'
                  : 'text-white-50'
              "
              @click="activeHistoryTab = 'recent'"
            >
              <FontAwesomeIcon :icon="faClock" class="me-2" />Recent
              <span class="badge bg-light text-dark ms-2">{{
                recentPlans.length
              }}</span>
            </button>
            <div class="ms-auto d-flex gap-2 me-3">
              <button
                v-if="currentList.length > 0"
                class="btn btn-sm btn-outline-light"
                @click="selectionMode = !selectionMode"
              >
                <FontAwesomeIcon
                  :icon="selectionMode ? faTimes : faCheckSquare"
                  class="me-1"
                />
                {{ selectionMode ? "Cancel" : "Select" }}
              </button>
              <button
                v-if="selectionMode && selection.length > 0"
                class="btn btn-sm btn-outline-light"
                @click="deletePlans()"
              >
                <FontAwesomeIcon :icon="faTrash" class="me-1" />Delete
              </button>
              <button
                v-if="selectionMode && selection.length === 2"
                class="btn btn-sm btn-outline-light"
                @click="compareSelectedPlans()"
              >
                <FontAwesomeIcon :icon="faColumns" class="me-1" />Compare
              </button>
              <button
                v-if="selectionMode && selection.length > 0"
                class="btn btn-sm btn-outline-light"
                @click="exportPlans()"
              >
                <FontAwesomeIcon :icon="faDownload" class="me-1" />Export
              </button>
              <button
                v-if="!selectionMode && currentList.length > 0"
                class="btn btn-sm btn-outline-light"
                @click="exportPlans(currentList)"
              >
                <FontAwesomeIcon :icon="faDownload" class="me-1" />Export All
              </button>
              <button
                class="btn btn-sm btn-outline-light"
                @click="currentPath = '/compare-quick'"
              >
                <FontAwesomeIcon :icon="faColumns" class="me-1" />Quick Compare
              </button>
              <button
                class="btn btn-sm btn-outline-light"
                @click="triggerImport"
              >
                <FontAwesomeIcon :icon="faUpload" class="me-1" />Import
              </button>
              <button
                v-if="currentList.length > 0 && !selectionMode"
                class="btn btn-sm btn-outline-light"
                @click="clearAllPlans"
              >
                <FontAwesomeIcon :icon="faTrash" class="me-1" />Clear All
              </button>
            </div>
          </div>
          <div class="card-body">
            <div
              class="position-relative"
              ref="savedPlansDropZoneRef"
              :class="{ 'dropzone-over': isOverSavedPlansDropZone }"
            >
              <input
                type="file"
                ref="fileInput"
                @change="handleImportFile"
                accept="application/json"
                style="display: none"
              />

              <div>
                <div
                  class="alert alert-success py-1"
                  v-for="message in messages"
                  :key="message.id"
                >
                  <span v-html="message.text"></span>
                </div>
              </div>

              <div class="list-group" v-cloak>
                <a
                  class="list-group-item list-group-item-action px-2 py-1 flex-column"
                  :class="{ active: isSelected(plan[3]) }"
                  v-for="(plan, index) in paginatedPlans"
                  :key="plan[3]"
                  href="#"
                  @click.prevent="openOrSelectPlan(plan)"
                  @mouseenter="hovered = index"
                  @mouseleave="hovered = null"
                >
                  <div class="d-flex w-100 align-items-center">
                    <input
                      class="form-check-input me-3"
                      type="checkbox"
                      v-if="selectionMode"
                      :checked="isSelected(plan[3])"
                      @click.stop="togglePlanSelection(plan)"
                    />
                    <div>
                      <p class="mb-0">
                        {{ plan[0] }}
                      </p>
                      <small
                        :class="{
                          'text-secondary': !isSelected(plan[3]),
                        }"
                      >
                        created
                        <span :title="plan[3]?.toString()">
                          {{ time_ago(plan[3]) }}
                        </span>
                      </small>
                    </div>
                    <div
                      class="end-0 text-nowrap position-absolute z-1 p-2"
                      v-if="hovered === index && !selectionMode"
                    >
                      <button
                        class="btn btn-sm btn-outline-secondary py-0 me-1"
                        v-tippy="'Export plan'"
                        v-on:click.stop="exportPlans([plan])"
                      >
                        <FontAwesomeIcon :icon="faUpload"></FontAwesomeIcon>
                      </button>
                      <button
                        class="btn btn-sm btn-outline-secondary py-0 me-1"
                        v-tippy="'Delete plan'"
                        v-on:click.stop="deletePlan(plan)"
                      >
                        <FontAwesomeIcon :icon="faTrash"></FontAwesomeIcon>
                      </button>
                      <button
                        class="btn btn-sm btn-outline-secondary py-0"
                        v-tippy="'Edit plan details'"
                        v-on:click.stop="editPlan(plan)"
                      >
                        <FontAwesomeIcon :icon="faEdit"></FontAwesomeIcon>
                      </button>
                    </div>
                  </div>
                </a>
                <div
                  v-if="currentList.length === 0"
                  class="text-center text-muted py-5"
                >
                  <FontAwesomeIcon
                    :icon="faDownload"
                    class="mb-2"
                    size="2x"
                  ></FontAwesomeIcon>
                  <br />
                  <span v-if="activeHistoryTab === 'saved'"
                    >Drop your JSON file here</span
                  >
                  <span v-else>No recent plans found</span>
                </div>
                <nav class="mt-3">
                  <ul
                    class="pagination pagination-sm justify-content-center mb-0"
                  >
                    <li
                      class="page-item"
                      :class="{ disabled: currentPage === 1 }"
                    >
                      <a
                        class="page-link"
                        href="#"
                        @click="prevPage"
                        aria-label="Previous"
                      >
                        <span aria-hidden="true">&laquo;</span>
                        <span class="sr-only">Previous</span>
                      </a>
                    </li>
                    <li
                      class="page-item"
                      v-if="visiblePages[0] > 1"
                      @click="goToPage(1)"
                    >
                      <a class="page-link" href="#">1</a>
                    </li>
                    <li class="page-item" v-if="visiblePages[0] > 2">
                      <a class="page-link"> … </a>
                    </li>
                    <li
                      class="page-item"
                      v-for="page in visiblePages"
                      :key="page"
                      @click="goToPage(page)"
                      :class="{ active: page === currentPage }"
                    >
                      <a class="page-link" href="#">{{ page }}</a>
                    </li>
                    <li
                      class="page-item"
                      v-if="
                        visiblePages[visiblePages.length - 1] < totalPages - 1
                      "
                    >
                      <a class="page-link"> … </a>
                    </li>
                    <li
                      class="page-item"
                      v-if="visiblePages[visiblePages.length - 1] < totalPages"
                      @click="goToPage(totalPages)"
                    >
                      <a class="page-link" href="#">{{ totalPages }}</a>
                    </li>
                    <li
                      class="page-item"
                      :class="{ disabled: currentPage === totalPages }"
                    >
                      <a
                        class="page-link"
                        href="#"
                        @click="nextPage"
                        aria-labal="Next"
                      >
                        <span aria-hidden="true">&raquo;</span>
                        <span class="sr-only">Next</span>
                      </a>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.active-tab {
  background-color: rgba(255, 255, 255, 0.2) !important;
  color: white !important;
  border-bottom: 2px solid white !important;
}

.dropzone-over {
  box-shadow: 0 0 5px rgba(81, 203, 238, 1);
  background-color: rgba(81, 203, 238, 0.05);

  > * {
    opacity: 50%;
  }
}

.mysql-home-page {
  background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
  min-height: 100vh;
}

.hero-icon {
  font-size: 4rem;
  display: inline-block;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 5px 15px rgba(0, 117, 143, 0.3));
}

.text-gradient {
  background: linear-gradient(135deg, #00758f 0%, #00a4db 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

.mysql-info-alert {
  border-left: 4px solid #00758f;
  background-color: #e7f5f8;
  border-color: #00a4db;
}

.mysql-tip-card {
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border-left: 3px solid #e48e00;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.mysql-code {
  background: linear-gradient(135deg, #00758f 0%, #00a4db 100%);
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.mysql-input-form {
  .mysql-input-card {
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s ease;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .card-header {
      background: linear-gradient(135deg, #00758f 0%, #00a4db 100%);
      color: white;
      font-weight: 600;
      border: none;
      padding: 0.75rem 1rem;
    }

    .card-body {
      padding: 1rem;
    }

    textarea,
    input {
      border: 1px solid #dee2e6;
      border-radius: 6px;
      transition: all 0.2s ease;

      &:focus {
        border-color: #00a4db;
        box-shadow: 0 0 0 0.2rem rgba(0, 164, 219, 0.25);
      }
    }
  }

  .mysql-submit-btn-premium {
    background: linear-gradient(135deg, #00758f 0%, #00a4db 100%);
    border: none;
    color: white;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    font-size: 1.1rem;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 117, 143, 0.3);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    position: relative;
    overflow: hidden;

    &:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 8px 25px rgba(0, 117, 143, 0.5);
      background: linear-gradient(135deg, #008caf 0%, #00b4f1 100%);
    }

    &:active {
      transform: translateY(-1px) scale(0.98);
    }

    &::after {
      content: "";
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: rgba(255, 255, 255, 0.1);
      transform: rotate(45deg);
      transition: all 0.5s ease;
      opacity: 0;
    }

    &:hover::after {
      left: 100%;
      opacity: 1;
    }
  }
}

.mysql-history-card {
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;

  .card-header {
    background: linear-gradient(135deg, #e48e00 0%, #f29111 100%);
    color: white;
    font-weight: 600;
    border: none;
    padding: 0.75rem 1rem;
  }
}

// Dark Mode Support
[data-theme="dark"] {
  .mysql-home-page {
    background: linear-gradient(180deg, #0b0e14 0%, #151921 100%);
    color: #e1e1e1;
  }

  .mysql-tip-card {
    background: #1a1f29;
    border-left-color: #f29111;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

    .text-secondary {
      color: #b0b0b0 !important;
    }
  }

  .mysql-input-card,
  .mysql-history-card {
    background-color: #1a1f29;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);

    .card-body {
      background-color: #1a1f29;
    }

    textarea,
    input {
      background-color: #0b0e14;
      border-color: #2d333b;
      color: #e1e1e1;

      &:focus {
        border-color: #00a4db;
        background-color: #0b0e14;
      }

      &::placeholder {
        color: #57606a;
      }
    }
  }

  .text-secondary {
    color: #909090 !important;
  }

  .text-muted {
    color: #606060 !important;
  }

  .alert-info.mysql-info-alert {
    background-color: rgba(0, 117, 143, 0.1);
    border-color: #00758f;
    color: #00a4db;

    .alert-link {
      color: #00a4db;
      text-decoration: underline;
    }
  }

  .list-group-item {
    background-color: #1a1f21;
    border-color: #2d333b;
    color: #e1e1e1;

    &.active {
      background-color: #0d1117;
      border-color: #00a4db;
    }

    &:hover:not(.active) {
      background-color: #21262d;
      color: white;
    }

    .text-muted {
      color: #8b949e !important;
    }
  }

  .pagination {
    .page-link {
      background-color: #161b22;
      border-color: #30363d;
      color: #58a6ff;

      &:hover {
        background-color: #21262d;
      }
    }

    .page-item.active .page-link {
      background-color: #1f6feb;
      border-color: #388bfd;
    }

    .page-item.disabled .page-link {
      background-color: #0d1117;
      border-color: #30363d;
      color: #484f58;
    }
  }

  .alert-success {
    background-color: rgba(63, 185, 80, 0.1);
    border-color: #238636;
    color: #3fb950;
  }
}
</style>
