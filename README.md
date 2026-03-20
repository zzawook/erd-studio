# erdraw

Interactive ER Diagram tool for CS4221 at NUS. Supports Chen and Crow's Foot notation with seamless switching, drag-and-drop editing, candidate/partial keys, weak entities, identifying relationships, aggregation, and DDL export to PostgreSQL/MySQL. Built with React, TypeScript, and React Flow.

## Features

- **Multiple notation styles** with seamless switching — build your diagram once and toggle between notations instantly (e.g. Chen, Crow's Foot). The underlying model is notation-agnostic and extensible to additional styles
- **Candidate key support** — multiple candidate keys per entity, set primary via radio button
- **Partial key support** — branches off the identifying relationship participation line (per CS4221 convention)
- **Weak entities** with identifying relationships and double-bordered rendering
- **Aggregation** — wraps a relationship in a box so it can participate in other relationships
- **DDL export** to PostgreSQL and MySQL with dialect-specific type mappings
- **Drag-and-drop** entities, relationships, and attributes with real-time position updates
- **Resizable panels** for sidebar and properties panel

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React + TypeScript |
| Build | Vite |
| Canvas | React Flow (`@xyflow/react` v12) |
| State | Zustand |
| Styling | Tailwind CSS v4 |
| Testing | Vitest + React Testing Library |

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Project Structure

```
src/
├── ir/              # Intermediate Representation (types + Zustand store)
├── renderer/
│   ├── chen/        # Chen notation renderer + custom nodes/edges
│   ├── crowsfoot/   # Crow's Foot notation renderer + custom nodes/edges
│   └── shared/      # Shared components (NodeHandles)
├── exporter/        # DDL exporters (PostgreSQL, MySQL)
├── components/      # UI components (Canvas, Sidebar, Toolbar, PropertiesPanel)
└── utils/           # Utilities (ID generation, validation, cardinality helpers)
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) — free for noncommercial use.
