<script lang="ts" setup>
import { inject, type Ref, computed } from "vue"
import VLink from "../components/VLink.vue"
import ThemeToggle from "@/components/ThemeToggle.vue"

interface Props {
  title?: string
}

const props = defineProps<Props>()
const currentPath = inject<Ref<string>>("currentPath")
const resetPlan = inject<() => void>("resetPlan")
const isPlanView = computed(() => currentPath?.value?.startsWith("/plan"))
</script>

<template>
  <div class="d-flex flex-column vh-100">
    <nav class="navbar mysql-navbar sticky-top">
      <div :class="[isPlanView ? 'container-fluid' : 'container']">
        <VLink to="/" class="navbar-brand mysql-brand-text d-flex align-items-center">
          <span class="me-2" style="font-size: 1.5rem">🐬</span>
          <span class="d-none d-sm-inline">MySQL <span class="d-none d-lg-inline">Plan Visualizer</span></span>
        </VLink>
        <div id="header-tabs" class="d-flex align-items-center mx-3 flex-grow-1 overflow-auto" style="scrollbar-width: none;"></div>
        <div id="header-stats" class="d-none d-xl-flex align-items-center text-white-50 px-2 ms-auto" style="font-size: 0.8rem; border-left: 1px solid rgba(255,255,255,0.2);"></div>
        <div v-if="props?.title" class="text-center text-white fw-medium text-truncate px-3 d-none d-xxl-block" style="max-width: 400px; position: absolute; left: 50%; transform: translateX(-50%);">
          {{ props?.title }}
        </div>
        <div class="d-flex gap-2 align-items-center ms-auto">
          <div class="d-flex align-items-center me-2">
            <ThemeToggle />
            <div id="header-tools" class="ms-2"></div>
          </div>
          <button class="btn btn-sm mysql-nav-btn" @click="resetPlan">
            <i class="fas fa-plus-circle me-1"></i>New Plan
          </button>
          <VLink class="btn btn-sm mysql-nav-btn-link" to="/about">About</VLink>
        </div>
      </div>
    </nav>
    <slot></slot>
  </div>
</template>

<style scoped lang="scss">
.mysql-navbar {
  background: linear-gradient(135deg, #00758f 0%, #005a6f 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0.75rem 0;

  .container {
    display: flex;
    align-items: center;
  }

  .mysql-brand-text {
    color: white;
    font-weight: 600;
    font-size: 1.1rem;
    margin: 0;
    text-decoration: none;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 0.9;
      color: white;
    }
  }

  .mysql-nav-btn {
    background-color: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      background-color: rgba(255, 255, 255, 0.3);
      color: white;
      border-color: rgba(255, 255, 255, 0.5);
      transform: translateY(-1px);
      text-decoration: none;
    }
  }

  .mysql-nav-btn-link {
    background-color: transparent;
    color: rgba(255, 255, 255, 0.9);
    border: none;
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
      text-decoration: none;
    }
  }
}
</style>
