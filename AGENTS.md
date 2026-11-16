# Repository Guidelines

## Project Structure & Module Organization

This React 19, TypeScript, and Vite application converts Excel pixel-array specifications into layout previews and Cadence SKILL scripts.

- `src/components/`: parameter forms, CAD preview, Excel controls, and code viewers.
- `src/parsers/` and `src/exporters/`: workbook import and export.
- `src/math/`: grid classification and orientation geometry.
- `src/generators/skill/`: SKILL assembly, mosaic placement, and centering.
- `src/generators/templates/`: standalone Python generator templates.
- `src/config/defaults.ts` and `src/types.ts`: presets and shared data contracts.
- Tests sit beside source as `*.test.ts` or `*.test.tsx`. Static assets live in `public/` and `src/assets/`; builds go to ignored `dist/`.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from the lockfile.
- `npm run dev`: start Vite on port 3000, listening on all interfaces.
- `npm run lint`: run TypeScript checks with `tsc --noEmit`.
- `npm test`: run all Vitest tests once.
- `npx vitest run src/orientation.test.ts`: run focused geometry regressions.
- `npm run build`: create the production bundle.
- `npm run preview`: serve the production build locally.

## Coding Style & Naming Conventions

Use two-space indentation in TypeScript/TSX and four spaces in Python templates. Follow surrounding quote style; no dedicated formatter or ESLint configuration is present. Use PascalCase for React components and camelCase for functions and local variables. Preserve existing snake_case layout fields such as `x_pitch` and `cell_map`. Keep geometry and generation logic outside UI components.

## Testing Guidelines

Tests use Vitest with jsdom and React Testing Library. Python template validation also requires `python3`. No numeric coverage threshold is configured. Add regression tests for changed behavior, especially mixed orientations, unequal pitches, asymmetric padding, centering, and Excel round trips. Keep browser SKILL and corrected Python exports consistent. Preserve the intentionally buggy legacy template. Geometry execution tests use an in-memory SKILL harness. To include full Excel/Python parity tests, install pandas and openpyxl in a Python environment and run `PIXEL_TEST_PYTHON=/path/to/python npm test`. Run type checks, tests, and the build before submitting; distinguish generated-code validation from native Virtuoso execution.

## Commit & Pull Request Guidelines

History generally uses imperative subjects such as “Fix incorrect target layer boundary calculation”; no enforced prefix convention is evident. Use specific subjects describing the resulting behavior. PRs should explain the problem, changes, validation, and limitations; link relevant issues and include screenshots for visible UI changes.

## Configuration & Security

Keep credentials out of source and generated assets. Use `.env.example` for placeholders. Cloudflare asset configuration lives in `wrangler.jsonc`; review deployment changes separately from local builds.
