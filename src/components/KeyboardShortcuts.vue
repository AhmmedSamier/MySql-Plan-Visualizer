<script lang="ts" setup>
import { ref } from "vue"
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import { faKeyboard } from "@fortawesome/free-solid-svg-icons"

const showModal = ref(false)

defineExpose({
  show: () => {
    showModal.value = true
  },
  hide: () => {
    showModal.value = false
  },
})

const shortcuts = [
  { keys: ["Ctrl", "F"], description: "Open search" },
  { keys: ["+"], description: "Zoom in" },
  { keys: ["-"], description: "Zoom out" },
  { keys: ["0"], description: "Fit to screen" },
  { keys: ["Esc"], description: "Close search / Deselect node" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
  { keys: ["E"], description: "Expand all nodes" },
  { keys: ["C"], description: "Collapse all nodes" },
]

const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
</script>

<template>
  <div
    v-if="showModal"
    class="modal fade show d-block"
    tabindex="-1"
    @click.self="showModal = false"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <FontAwesomeIcon :icon="faKeyboard" class="me-2" />
            Keyboard Shortcuts
          </h5>
          <button
            type="button"
            class="btn-close"
            @click="showModal = false"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <table class="table table-sm">
            <tbody>
              <tr v-for="(shortcut, index) in shortcuts" :key="index">
                <td class="text-end" style="width: 40%">
                  <kbd v-for="(key, i) in shortcut.keys" :key="i" class="me-1">
                    {{
                      key === "Ctrl" && isMac
                        ? "⌘"
                        : key === "Ctrl"
                          ? "Ctrl"
                          : key
                    }}
                  </kbd>
                </td>
                <td>{{ shortcut.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="showModal = false"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="showModal" class="modal-backdrop fade show"></div>
</template>

<style scoped>
kbd {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 0.875rem;
  font-family: monospace;
}
</style>
