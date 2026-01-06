MySql-Plan-Visualizer: A VueJS component to show a graphical vizualization of a MySQL execution plan.

[**Live Demo**](https://ahmmedsamier.github.io/MySql-Plan-Visualizer/)

![Screenshot](screenshot.png)

# Usage

To use the explain vizualizer you can choose one of the following options:

## All-in-one local (no installation, no network)

MySql-Plan-Visualizer can be run locally without any external internet resource.

Simply download the built artifact from releases, open it in your favorite internet browser.

## Integrated in a web application

### Without building tools

```html
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="https://unpkg.com/mysql-plan-visualizer/dist/mysql-plan-visualizer.umd.js"></script>
<link
  href="https://unpkg.com/bootstrap@5/dist/css/bootstrap.min.css"
  rel="stylesheet"
/>
<link rel="stylesheet" href="https://unpkg.com/mysql-plan-visualizer/dist/mysql-plan-visualizer.css" />

<div id="app" class="d-flex flex-column vh-100">
  <mysql-plan-visualizer :plan-source="plan" plan-query="" />
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
  app.component("mysql-plan-visualizer", MysqlPlanVisualizer.Plan)
  app.mount("#app")
</script>
```

### With build tools

MySql-Plan-Visualizer can be integrated as a component in a web application.

Install it:

```
npm install mysql-plan-visualizer
```

Declare the `Plan` component and use it:

```javascript
import { Plan } from "mysql-plan-visualizer"
import "mysql-plan-visualizer/dist/mysql-plan-visualizer.css"

export default {
  name: "MySql-Plan-Visualizer example",
  components: {
    MysqlPlanVisualizer: Plan,
  },
  data() {
    return {
      plan: plan,
      query: query,
    }
  },
}
```

Then add the component to your template:

```html
<div id="app">
  <mysql-plan-visualizer :plan-source="plan" :plan-query="query"></mysql-plan-visualizer>
</div>
```

`MySql-Plan-Visualizer` requires `Bootstrap (CSS)` to work so don't forget to
add the following in you header (or load them with your favorite bundler).

```html
<link
  href="https://unpkg.com/bootstrap@5/dist/css/bootstrap.min.css"
  rel="stylesheet"
/>
```
