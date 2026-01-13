<script lang="ts" setup>
import { computed, inject, useTemplateRef, ref, onMounted, watch } from "vue"
import type { Ref } from "vue"

import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import { Tippy } from "vue-tippy"
import { directive as vTippy } from "vue-tippy"
import { useDropZone } from "@vueuse/core"

import { time_ago } from "../utils"
import MainLayout from "../layouts/MainLayout.vue"
import type { Plan, Sample } from "../types"
import VersionCheck from "../components/VersionCheck.vue"
import {
  faEdit,
  faInfoCircle,
  faTrash,
  faDownload,
  faUpload,
} from "@fortawesome/free-solid-svg-icons"
import samples from "../samples.ts"

import idb from "../idb"

const setPlanData = inject("setPlanData") as (
  name: string,
  plan: string,
  query: string,
  id?: number,
) => void

const planInput = ref<string>("")
const queryInput = ref<string>("")
const planName = ref<string>("")
const savedPlans = ref<Plan[]>([])
const pageSize = 11
const maxVisiblePages = 5
const currentPage = ref<number>(1)
const totalPages = computed(() => {
  return Math.ceil(savedPlans.value.length / pageSize)
})
const hovered = ref<number | null>(null)
const selectionMode = ref(false)
const selection = ref<Plan[]>([])

const paginatedPlans = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return savedPlans.value.slice(start, end)
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
  setPlanData(plan[0], plan[1], plan[2], plan.id)
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
  return selection.value.length > 0 ? selection.value : savedPlans.value
}

function deletePlans() {
  if (confirm("Are you sure you want to delete plans?")) {
    const plans = plansFromSelection()
    plans.forEach(async (plan) => {
      await idb.deletePlan(plan)
    })
    loadPlans()
    selectionMode.value = false
    addMessage(`Deleted ${plans.length} plans`)
  }
  // reset page
  currentPage.value = 1
}

async function deletePlan(plan: Plan) {
  await idb.deletePlan(plan)
  loadPlans()
}

function onDrop(files: File[] | null, input: Ref) {
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
  <MainLayout>
    <div class="mysql-home-page">
      <!-- Hero Section -->
      <div class="mysql-hero">
        <div class="container">
          <div class="hero-content text-center">
            <div class="hero-icon mb-3">🐬</div>
            <h1 class="hero-title">MySQL Plan Visualizer</h1>
            <p class="hero-subtitle">
              Analyze and optimize your MySQL query execution plans with
              interactive visualizations
            </p>
            <div class="hero-features mt-4">
              <span class="feature-badge">
                <i class="fas fa-chart-line"></i> Performance Analysis
              </span>
              <span class="feature-badge">
                <i class="fas fa-project-diagram"></i> Interactive Diagrams
              </span>
              <span class="feature-badge">
                <i class="fas fa-database"></i> MySQL Optimized
              </span>
            </div>
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
                  <div class="mt-3">
                    <button
                      type="submit"
                      class="btn btn-primary w-100 mysql-submit-btn"
                    >
                      <i class="fas fa-chart-line me-2"></i>Visualize Plan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        <!-- Saved Plans History Section -->
        <div class="card mysql-history-card mt-5 mb-5">
          <div class="card-header d-flex align-items-center">
            <h5 class="mb-0">
              <i class="fas fa-history me-2"></i>Saved Plans
              <span class="badge bg-light text-dark ms-2">{{
                savedPlans?.length
              }}</span>
            </h5>
            <div class="ms-auto d-flex gap-2">
              <button
                v-if="savedPlans.length > 0"
                class="btn btn-sm btn-outline-light"
                @click="selectionMode = !selectionMode"
              >
                <i
                  :class="
                    selectionMode ? 'fas fa-times' : 'fas fa-check-square'
                  "
                  class="me-1"
                ></i>
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
                v-if="selectionMode && selection.length > 0"
                class="btn btn-sm btn-outline-light"
                @click="exportPlans()"
              >
                <FontAwesomeIcon :icon="faDownload" class="me-1" />Export
              </button>
              <button
                v-if="!selectionMode && savedPlans.length > 0"
                class="btn btn-sm btn-outline-light"
                @click="exportPlans(savedPlans)"
              >
                <FontAwesomeIcon :icon="faDownload" class="me-1" />Export All
              </button>
              <button
                class="btn btn-sm btn-outline-light"
                @click="triggerImport"
              >
                <FontAwesomeIcon :icon="faUpload" class="me-1" />Import
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

              <nav>
                <ul class="pagination pagination-sm justify-content-end mb-2">
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
                      :value="plan"
                      v-model="selection"
                      @click.stop
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
                  v-if="savedPlans.length === 0"
                  class="text-center text-muted py-5"
                >
                  <FontAwesomeIcon
                    :icon="faDownload"
                    class="mb-2"
                    size="2x"
                  ></FontAwesomeIcon>
                  <br />
                  Drop your JSON file here
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </MainLayout>
</template>

<style scoped lang="scss">
.dropzone-over {
  box-shadow: 0 0 5px rgba(81, 203, 238, 1);
  background-color: rgba(81, 203, 238, 0.05);
  > * {
    opacity: 50%;
  }
}

// MySQL Home Page Styling
.mysql-home-page {
  background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
  min-height: 100vh;
}

.mysql-hero {
  background: linear-gradient(135deg, #00758f 0%, #005a6f 100%);
  color: white;
  padding: 3rem 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  .hero-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .hero-icon {
    font-size: 4rem;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
    animation: float 3s ease-in-out infinite;
  }

  .hero-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .hero-subtitle {
    font-size: 1.2rem;
    opacity: 0.95;
    margin-bottom: 0;
  }

  .hero-features {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .feature-badge {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.3s ease;

    i {
      margin-right: 0.5rem;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: translateY(-2px);
    }
  }
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

  .mysql-submit-btn {
    background: linear-gradient(135deg, #00758f 0%, #00a4db 100%);
    border: none;
    font-weight: 600;
    padding: 0.75rem;
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 117, 143, 0.4);
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
</style>
