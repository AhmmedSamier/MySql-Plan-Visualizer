# Agent Instructions for mysql-plan-visualizer

This document contains instructions for AI agents operating in this codebase.

## 1. Build, Lint, and Test

- **Runtime:** Node.js (npm) or Bun. `package.json` scripts use standard npm format.
- **Install Dependencies:** `npm install`
- **Run Dev Server:** `npm run dev` (Vite)
- **Build:**
  - App: `npm run build:app` (Outputs to `dist-app/`)
  - Lib: `npm run build:lib` (Outputs to `dist/`)
  - Typecheck: `npm run typecheck` (`vue-tsc`)
- **Linting & Formatting:**
  - Lint: `npm run lint` (ESLint)
  - Format: `npm run format` (Prettier)
  - **Important:** Run `npm run lint` and `npm run typecheck` after changes.
- **Testing (Vitest):**
  - Run all tests: `npm test`
  - Run single test file: `npx vitest run <path/to/test>` (e.g., `npx vitest run src/services/__tests__/plan-parser.spec.ts`)
  - Run with coverage: `npx vitest run --coverage`

## 2. Code Style & Guidelines

### Technology Stack

- **Framework:** Vue 3 (Composition API, `<script setup lang="ts">`)
- **Language:** TypeScript (Strict mode)
- **Build Tool:** Vite
- **Styling:** SCSS, Bootstrap 5 (utility classes favored in templates)
- **Visualization:** D3.js
- **State Management:** Reactive objects, `provide`/`inject` pattern (e.g., `StoreKey`).

### Naming Conventions

- **Files:**
  - Vue Components: PascalCase (e.g., `PlanNode.vue`, `Diagram.vue`)
  - TypeScript Files: kebab-case (e.g., `plan-service.ts`, `mysql-plan-service.ts`)
  - Unit Tests: `*.spec.ts` inside `__tests__` directories.
- **Code:**
  - Classes/Interfaces: PascalCase (e.g., `PlanService`, `IPlan`).
  - Variables/Functions: camelCase (e.g., `calculateActuals`, `selectedNodeId`).
  - Constants/Enums: PascalCase or UPPER_CASE for keys (e.g., `NodeProp.ACTUAL_ROWS`).

### Coding Standards

- **Imports:**
  - Use `@/` alias for `src/` (e.g., `import type { Node } from "@/interfaces"`).
  - Group imports: External libraries (Vue, Lodash, D3) first, then local components/services.
- **Formatting:**
  - **No Semicolons** at the end of statements.
  - Double quotes for strings (Prettier default).
  - Trailing commas where applicable.
- **TypeScript:**
  - Strict typing. Avoid `any`.
  - Use `interface` for object shapes.
  - Prefer `const` over `let`.
- **Vue Components:**
  - Use `<script setup lang="ts">`.
  - Use `defineProps<Props>()` for typed props.
  - Use `ref` and `computed` for reactivity.
  - Avoid Options API unless maintaining legacy code.

### Architecture & Patterns

- **Services:** Logic often resides in `src/services/`. `PlanService` handles parsing and node processing.
- **Enums:** Centralized in `@/enums` (e.g., `NodeProp` for accessing node properties safely).
- **Lodash:** Heavily used for data manipulation (`_`).
- **D3:** Used for diagramming logic (`src/composables/usePlanLayout.ts` and `Diagram.vue`).

### Error Handling

- Use `try...catch` for async operations (e.g., Web Workers).
- Fail gracefully in UI if parsing fails (see `Plan.vue` error state).
