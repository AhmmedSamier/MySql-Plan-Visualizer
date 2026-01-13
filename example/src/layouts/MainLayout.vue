<script lang="ts" setup>
import { inject } from "vue"
import VLink from "../components/VLink.vue"

interface Props {
  title?: string
}

const props = defineProps<Props>()
const currentPath = inject("currentPath")
</script>

<template>
  <div class="d-flex flex-column vh-100">
    <nav class="navbar mysql-navbar sticky-top" v-if="currentPath !== '/plan'">
      <div :class="[currentPath == '/plan' ? 'container-fluid' : 'container']">
        <div class="navbar-brand mysql-brand-text">MySQL Plan Visualizer</div>
        <div v-if="props?.title" class="text-center ms-auto">
          {{ props?.title }}
        </div>
        <div class="ms-auto d-flex gap-2">
          <VLink class="btn btn-sm mysql-nav-btn" to="/">
            <i class="fas fa-plus-circle me-1"></i>New Plan
          </VLink>
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
