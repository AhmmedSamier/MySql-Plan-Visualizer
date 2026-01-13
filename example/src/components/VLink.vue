<script lang="ts" setup>
import { inject, type Ref, computed } from "vue"

const props = defineProps({
  to: {
    type: String,
    required: true,
  },
})

const currentPath = inject<Ref<string>>("currentPath")

const go = (event: Event) => {
  event.preventDefault()
  if (currentPath) {
    currentPath.value = props.to
  }
}

const href = computed(() => {
  const base = import.meta.env.BASE_URL || '/'
  const path = props.to.startsWith('/') ? props.to.slice(1) : props.to
  return base + path
})
</script>

<template>
  <a v-bind:href="href" v-on:click="go">
    <slot></slot>
  </a>
</template>
