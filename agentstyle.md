## Code Style

This is a TypeScript CLI application built with Ink (React for terminals). It follows modern ESM conventions with a clean separation between core logic, CLI presentation, and provider abstraction.

**Naming**
- **camelCase** for variables, functions, and parameters: `rootAbs`, `usedGit`, `smartPickFiles`, `fmtBytes`
- **PascalCase** for types, interfaces, React components, and classes: `TreeNode`, `FlatNode`, `ClaudeProvider`, `SectionTitle`
- **UPPER_SNAKE_CASE** for constants: `DEFAULT_ALWAYS_IGNORE`, `SPINNER_FRAMES`, `SPINNER_INTERVAL_MS`, `ASCII_HEADER`
- Short, abbreviated helper names are acceptable: `fmtBytes`, `toPosix`, `plat`
- Boolean variables often use `is`/`used` prefixes: `isGit`, `usedGit`, `isLast`, `isCursor`

**Formatting & Syntax**
- Double quotes for strings consistently
- Semicolons always present
- `as const` assertions on readonly object/array constants (e.g., `colors`, `symbols`, `SPINNER_FRAMES`)
- Trailing commas in multi-line structures
- Non-null assertions (`!`) used freely on array accesses after bounds checks: `parts[i]!`, `flat[cursor]!`
- Arrow functions preferred for inline callbacks; `function` declarations for named top-level/module functions
- Template literals for string interpolation: `` `${(n / mb).toFixed(1)} MB` ``

**TypeScript**
- Strict mode enabled with `"strict": true`
- ESM with `"module": "ESNext"`, `"moduleResolution": "bundler"`, explicit `.js` extensions in imports
- Type-only imports with `import type` where applicable
- Discriminated unions for state machines: `type Screen = { id: "scan" } | { id: "select" } | ...`
- Simple type aliases for domain concepts (`type SelectedFile = FileEntry`); interfaces only for contracts (`interface Provider`)
- `err: any` in catch blocks (no custom error types); fallback pattern: `err?.message ?? String(err)`

**Project Structure**
- `src/core/` — pure logic with no UI dependencies (tree, sampling, discovery, clipboard, prompt)
- `src/cli/` — Ink/React components; `App.tsx` is the main component, small components in `components/`
- `src/providers/` — abstraction layer for external AI providers (type interface + implementation)
- `bin/` — CLI entry point with argument parsing
- `test/` — test files mirroring core module names (`tree.test.ts`, `discover.test.ts`)
- `scripts/` — build utilities (e.g., `postbuild.mjs`)

**React / Ink Patterns**
- Functional components with explicit `Props` types defined inline above each component
- Hooks: `useState`, `useEffect`, `useMemo`, `useRef`, `useInput`
- State machine driven UI — a single `screen` state determines which JSX branch renders
- Async side effects inside `useEffect` with IIFE pattern `void (async () => { ... })()` and cancellation via `cancelled` flag
- Memoization with `useMemo` for derived data (`flat`, `selectedStats`, `guides`)
- `useRef` for mutex-like busy guards (`busyRef.current`)

**Error Handling**
- Try/catch with `catch { }` (no binding) for expected failures (file reads, git commands)
- Errors surfaced to UI via `setScreen({ id: "error", message: ... })` or `setStatusLine(...)`
- Graceful fallbacks: git discovery falls back to filesystem walk; clipboard tries multiple tools sequentially
- `// eslint-disable-next-line no-console` before intentional `console.log`/`console.error` usage

**Testing**
- Node.js built-in test runner (`node:test`) with `node:assert/strict`
- Tests create real temp directories (`fs.mkdtemp`) and real git repos — integration-style, no mocking
- Descriptive test names: `"discoverFiles: git mode uses git ls-files and filters always-ignore"`
- Tests run via `node --import tsx --test`

**Async & Concurrency**
- `async/await` throughout; no raw `.then()` chains
- `execa` for subprocess calls with `stdio: "pipe"` for capture, `"inherit"` for interactive
- Concurrency-limited parallel operations: `Promise.all(Array.from({ length: concurrency }, async () => { ... }))`

**Comments**
- Minimal — only for non-obvious logic (e.g., `// jump to parent`, `// Concurrency-limited stat`)
- Section dividers with `// ── Section Name ──────` pattern in longer files
- JSDoc only where algorithm explanation is warranted (e.g., `computeTreeGuides`)
