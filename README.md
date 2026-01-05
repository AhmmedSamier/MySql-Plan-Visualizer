MySql-Plan-Visualizer: A VueJS component to show a graphical vizualization of a MySQL execution plan.

[**Live Demo**](https://ahmmedsamier.github.io/MySql-Plan-Visualizer/)

![PEV2 screenshot](pev2_screenshot.png)

# Usage

To use the explain vizualizer you can choose one of the following options:

## All-in-one local (no installation, no network)

PEV2 can be run locally without any external internet resource.

Simply download the built artifact from releases, open it in your favorite internet browser.

## Integrated in a web application

### Without building tools

```html
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="https://unpkg.com/pev2/dist/pev2.umd.js"></script>
<link
  href="https://unpkg.com/bootstrap@5/dist/css/bootstrap.min.css"
  rel="stylesheet"
/>
<link rel="stylesheet" href="https://unpkg.com/pev2/dist/pev2.css" />

<div id="app" class="d-flex flex-column vh-100">
  <pev2 :plan-source="plan" plan-query="" />
</div>

<script>
  const { createApp } = Vue

  const plan = `
    -> Filter: (t1.c1 < 10)  (cost=0.75 rows=1) (actual time=0.046..0.052 rows=3 loops=1)
        -> Table scan on t1  (cost=0.75 rows=5) (actual time=0.042..0.048 rows=5 loops=1)
  `;

  const app = createApp({
    data() {
      return {
        plan: plan,
      }
    },
  })
  app.component("pev2", pev2.Plan)
  app.mount("#app")
</script>
```

### With build tools

PEV2 can be integrated as a component in a web application.

Install it:

```
npm install pev2
```

Declare the `PEV2` component and use it:

```javascript
import { Plan } from "pev2"
import "pev2/dist/pev2.css"

export default {
  name: "PEV2 example",
  components: {
    pev2: Plan,
  },
  data() {
    return {
      plan: plan,
      query: query,
    }
  },
}
```

Then add the `PEV2` component to your template:

```html
<div id="app">
  <pev2 :plan-source="plan" :plan-query="query"></pev2>
</div>
```

`PEV2` requires `Bootstrap (CSS)` to work so don't forget to
add the following in you header (or load them with your favorite bundler).

```html
<link
  href="https://unpkg.com/bootstrap@5/dist/css/bootstrap.min.css"
  rel="stylesheet"
/>
```

# Disclaimer

This project is a MySQL adaptation of the PEV2 project.
