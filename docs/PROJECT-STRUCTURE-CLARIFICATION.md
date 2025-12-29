# Entomate Project Structure Clarification

## The Problem

This project has evolved organically and now has **multiple overlapping codebases**:

```
F:\entomate\
├── index.tsx          # 67KB MONOLITH - OLD/DEPRECATED
├── index.html         # Used by root index.tsx
├── index.css          # Used by root index.tsx
├── src/               # TypeScript components (MIXED usage)
│   ├── components/    # Some used by index.tsx
│   ├── phase3/        # Customer health features
│   ├── agents/        # AI agents
│   └── ...
│
├── frontend/          # PROPER REACT APP - USE THIS
│   ├── src/
│   │   ├── App.jsx    # Main app with routing
│   │   ├── pages/     # Page components
│   │   ├── components/# UI components
│   │   └── services/  # API client
│   └── package.json   # Separate dependencies
│
├── backend/           # EXPRESS SERVER - USE THIS
│   ├── server.js      # Main entry
│   ├── routes/        # API routes
│   └── services/      # Business logic
│
└── package.json       # Root package (for index.tsx)
```

## What Happened

1. **Initial Build**: Started as a single-file `index.tsx` prototype (67KB)
2. **Split Attempt**: Created proper `frontend/` and `backend/` directories
3. **Confusion**: Development sometimes went to `src/` (root), sometimes to `frontend/src/`
4. **Result**: Two parallel frontend codebases, unclear which is "real"

## The Solution: Single Source of Truth

### USE THESE DIRECTORIES:

| Purpose | Directory | Entry Point |
|---------|-----------|-------------|
| **Frontend** | `F:\entomate\frontend\` | `npm run dev` (port 5173) |
| **Backend** | `F:\entomate\backend\` | `npm run dev` (port 3000) |

### IGNORE/DEPRECATE:

| File/Directory | Reason |
|----------------|--------|
| `F:\entomate\index.tsx` | Monolithic prototype, not maintainable |
| `F:\entomate\index.html` | Used by deprecated index.tsx |
| `F:\entomate\src/components/` | Duplicates frontend/src/components |
| `F:\entomate\package.json` | Only for deprecated root app |

## Migration Path

### Phase 1: Identify What's Used

Check if `F:\entomate\src\` components are imported in `frontend/`:

```bash
grep -r "from '../../src" frontend/
grep -r "from '\\.\\./\\.\\./src" frontend/
```

If nothing found, root `src/` can be deprecated.

### Phase 2: Consolidate

Move any unique components from `src/` to `frontend/src/`:
- `src/phase3/` -> `frontend/src/features/phase3/`
- `src/agents/` -> `frontend/src/features/agents/`
- etc.

### Phase 3: Clean Up

1. Delete or archive `index.tsx`, `index.html`, `index.css`
2. Remove root `package.json` or rename to `package.json.deprecated`
3. Update `CLAUDE.md` to only reference `frontend/` and `backend/`

## For Claude Code: Clear Instructions

**ALWAYS work in these directories:**

```
Frontend work:  F:\entomate\frontend\src\
Backend work:   F:\entomate\backend\
Docs:           F:\entomate\docs\
```

**NEVER modify:**
- `F:\entomate\index.tsx` (deprecated)
- `F:\entomate\src\` (unless migrating to frontend)

**When creating new features:**
1. Frontend components -> `frontend/src/components/`
2. Frontend pages -> `frontend/src/pages/`
3. API routes -> `backend/routes/`
4. Services -> `backend/services/`

## Verification Commands

```bash
# What's the real frontend?
ls F:/entomate/frontend/src/pages/

# What's the real backend?
ls F:/entomate/backend/routes/

# Is root src/ still used?
grep -r "entomate/src" frontend/
```

## Next Steps

1. Run the verification commands above
2. Document which `src/` components are actually used
3. Migrate or deprecate unused code
4. Update all documentation to reflect single entry points
        