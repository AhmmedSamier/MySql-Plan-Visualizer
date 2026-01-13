MySql-Plan-Visualizer: A VueJS component to show a graphical visualization of a MySQL execution plan.

[![npm version](https://badge.fury.io/js/mysql-plan-visualizer.svg)](https://badge.fury.io/js/mysql-plan-visualizer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[**Live Demo**](https://ahmmedsamier.github.io/MySql-Plan-Visualizer/)

# Features

- **Interactive Visualization**: Visualize MySQL EXPLAIN plans as dynamic, interactive trees.
- **Support for Multiple Formats**:
  - `FORMAT=TREE` (Recommended)
  - `FORMAT=JSON`
  - Traditional Tabular Format
- **Advanced Navigation**:
  - Zoom and Pan
  - Fit to Screen
  - Collapsible/Expandable nodes
  - Layout Orientation Switching (Top-to-Bottom / Left-to-Right)
- **Detailed Insights**:
  - Node statistics (cost, rows, loops)
  - Highlighting of expensive nodes
  - Search functionality to find specific nodes
  - CTE (Common Table Expression) support
- **Keyboard Shortcuts**: enhance productivity with varied shortcuts for navigation and view control.

# Installation

You can install the package via npm:

```bash
npm install mysql-plan-visualizer
# or
yarn add mysql-plan-visualizer
# or
bun add mysql-plan-visualizer
```

# Usage

## Integrated in a Vue Application

MySql-Plan-Visualizer can be integrated as a component in a web application.

1. **Import the component and styles**:

```javascript
import { Plan } from "mysql-plan-visualizer"
import "mysql-plan-visualizer/dist/mysql-plan-visualizer.css"
// Ensure Bootstrap CSS is available if not already in your project
import "bootstrap/dist/css/bootstrap.min.css"

export default {
  components: {
    MysqlPlanVisualizer: Plan,
  },
  data() {
    return {
      plan: `... your plan string ...`,
      query: `SELECT * FROM ...`,
    }
  },
}
```

2. **Use the component**:

```html
<mysql-plan-visualizer :plan-source="plan" :plan-query="query" />
```

## All-in-one (via CDN)

You can use it directly in the browser without a build step:

```html
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="https://unpkg.com/mysql-plan-visualizer/dist/mysql-plan-visualizer.umd.js"></script>
<link
  href="https://unpkg.com/bootstrap@5/dist/css/bootstrap.min.css"
  rel="stylesheet"
/>
<link
  rel="stylesheet"
  href="https://unpkg.com/mysql-plan-visualizer/dist/mysql-plan-visualizer.css"
/>

<div id="app" class="d-flex flex-column vh-100">
  <mysql-plan-visualizer :plan-source="plan" plan-query="" />
</div>

<script>
  const { createApp } = Vue

  const app = createApp({
    data() {
      return {
        plan: `... your plan string ...`,
      }
    },
  })

  app.component("mysql-plan-visualizer", MysqlPlanVisualizer.Plan)
  app.mount("#app")
</script>
```

## Props

- `plan-source` (String, required): The raw output of the MySQL EXPLAIN command.
- `plan-query` (String, optional): The original SQL query corresponding to the plan.

# Supported Formats

## FORMAT=TREE (Recommended)

```sql
EXPLAIN FORMAT=TREE
SELECT * FROM users WHERE id = 100;
```

## FORMAT=JSON

```sql
EXPLAIN FORMAT=JSON
SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id;
```

## Traditional Format

```sql
EXPLAIN
SELECT * FROM users WHERE created_at > '2024-01-01';
```

# Development

1. **Clone the repository**:

   ```bash
   git clone https://github.com/ahmmedsamier/MySql-Plan-Visualizer.git
   cd MySql-Plan-Visualizer
   ```

2. **Install dependencies**:

   ```bash
   npm install
   # or
   bun install
   ```

3. **Run development server**:

   ```bash
   npm run dev
   # or
   bun run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

# License

[MIT](LICENSE)
