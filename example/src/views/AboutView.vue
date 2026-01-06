<script lang="ts" setup>
import MainLayout from "../layouts/MainLayout.vue"
</script>

<template>
  <MainLayout>
    <div class="container">
      <h2>Usage tips</h2>
      <p>
        To get the most out of it, we recommend generating a query plan using
        <code>EXPLAIN FORMAT=JSON</code> or <code>EXPLAIN FORMAT=TREE</code>.
      </p>
      <p>
        MySql-Plan-Visualizer can also parse text output from `EXPLAIN ANALYZE` (Tree format).
      </p>

      <h2>Help improve MySql-Plan-Visualizer</h2>
      <p>You can help us.</p>

      <p>
        Report issues or contribute to the code on
        <a href="https://github.com/ahmmedsamier/MySql-Plan-Visualizer">Github</a>.
      </p>
    </div>
  </MainLayout>
</template>
