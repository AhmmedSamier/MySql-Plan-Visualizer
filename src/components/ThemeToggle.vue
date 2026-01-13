<script lang="ts" setup>
import { ref, onMounted } from "vue"
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons"

const isDark = ref(false)

onMounted(() => {
  // Check localStorage for saved preference
  const savedTheme = localStorage.getItem("theme")
  if (savedTheme) {
    isDark.value = savedTheme === "dark"
  } else {
    // Check system preference
    isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches
  }
  applyTheme()

  // Listen for system theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        isDark.value = e.matches
        applyTheme()
      }
    })
})

function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem("theme", isDark.value ? "dark" : "light")
  applyTheme()
}

function applyTheme() {
  if (isDark.value) {
    document.documentElement.setAttribute("data-theme", "dark")
  } else {
    document.documentElement.removeAttribute("data-theme")
  }
}
</script>

<template>
  <button
    class="btn btn-sm btn-outline-secondary"
    @click="toggleTheme"
    :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
  >
    <FontAwesomeIcon :icon="isDark ? faSun : faMoon" />
  </button>
</template>
