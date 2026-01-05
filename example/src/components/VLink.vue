<script lang="ts" setup>
import { inject, type Ref } from "vue"

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
</script>

<template>
  <a v-bind:href="to" v-on:click="go">
    <slot></slot>
  </a>
</template>
