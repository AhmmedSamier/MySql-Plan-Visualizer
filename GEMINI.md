# MySQL Plan Visualizer

## Project Overview

This project is a Vue.js 3 component and library designed to visualize MySQL execution plans. It supports multiple formats including `TREE`, `JSON`, and the traditional tabular format. It helps developers and DBAs analyze query performance through interactive diagrams and insights.

**Key Features:**

- Visualizes `EXPLAIN` output.
- Supports `FORMAT=TREE` (recommended), `FORMAT=JSON`, and standard tabular output.
- Provides performance stats and cost estimation.
- Can be used as a standalone web app or an embedded library.

## Tech Stack

- **Framework:** Vue.js 3
- **Build Tool:** Vite
- **Language:** TypeScript
- **Visualization:** D3.js (via `d3` and `d3-flextree`)
- **Styling:** SCSS, Bootstrap 5
- **Testing:** Vitest

## Getting Started

### Installation

```bash
bun install
```

### Development

Start the development server:

```bash
bun run dev
```

### Building

The project supports two build modes:

1.  **Library Build** (for publishing to npm/unpkg):

    ```bash
    bun run build:lib
    ```

    Outputs to `dist/`.

2.  **Application Build** (standalone visualizer):
    ```bash
    bun run build:app
    ```
    Outputs to `dist-app/`.

### Testing

Run unit tests with Vitest:

```bash
bun run test
```

### Code Quality

- **Lint:** `bun run lint`
- **Format:** `bun run format`
- **Type Check:** `bun run typecheck`

## Project Structure

- `src/` - Main source code.
  - `components/` - Vue components.
    - `Plan.vue` - Main entry component.
    - `Diagram.vue` - The D3 visualization logic.
  - `services/` - Core logic for parsing plans (`mysql-plan-service.ts`, `plan-service.ts`).
  - `assets/` - Styles (SCSS) and images.
- `example/` - Example usage of the library.
- `vite.config.ts` - Vite configuration handling both library and app builds.
- `vitest.config.ts` - Test configuration.

## Key Configuration

- **Vite:** configured in `vite.config.ts`. It uses the `LIB` environment variable to switch between building the library (UMD/ESM) and the standalone single-file app.
- **TypeScript:** `tsconfig.json` and `tsconfig.vite-config.json`.
