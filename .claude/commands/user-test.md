---
description: Comprehensive Users Guide audit — update docs, verify every feature against codebase, generate health report
allowed-tools: Read, Write, Edit, Bash(npm:*, git:*), Grep, Glob, Task
argument-hint: [--skip-update | --chapter N]
---

# Entomate — User Test: Comprehensive Guide Audit

Run a full audit of the Users Guide against the live codebase. This command verifies that every documented feature exists, identifies areas of concern, and generates a comprehensive report.

## Phase 1 — Update Users Guide

First, bring the documentation up to date by running the `/users-guide` update workflow:

1. Run `git log --oneline -30` to find recent changes
2. Read the last-updated timestamp from `docs/USER_GUIDE.md`
3. Compare changed files against the manual's Table of Contents
4. For any new or modified features:
   - Read the component files to understand user-facing behavior
   - Check `frontend/src/` for navigation and routing changes
   - Update `docs/USER_GUIDE.md` with plain-language instructions
5. Update the manual's timestamp

If `$ARGUMENTS` contains `--skip-update`, skip this phase entirely.

## Phase 2 — Build Verification

Run the production build to confirm the app compiles:

```
cd frontend && npm run build
```

Record:
- **Status**: PASS or FAIL
- **Errors**: Any TypeScript or bundler errors (with file paths)
- **Warnings**: Any warnings that could affect functionality

## Phase 3 — Section-by-Section Codebase Verification

For each chapter in `docs/USER_GUIDE.md`, verify the documented features exist in the codebase.

If `$ARGUMENTS` contains `--chapter N`, only verify that specific chapter.

### Verification Checklist Per Chapter

For each section, check:
1. **Route**: Does the route exist in the router? (search for the path in route definitions)
2. **Component**: Does the rendered component exist and export properly?
3. **API Endpoint**: Does the backend route exist for this feature?
4. **Sub-features**: Do documented capabilities have corresponding components/code?

### How to Verify

For each chapter:
1. Read the relevant section of `docs/USER_GUIDE.md`
2. Use `Grep` to search for route definitions or component files
3. Use `Glob` to find component files
4. Read the component to confirm documented features exist in the code
5. Record result as: CONFIRMED, PARTIAL (some features missing), or MISSING

## Phase 4 — Areas of Concern Analysis

After verifying all sections, compile a categorized list of concerns:

### Categories
- **CRITICAL** — Documented feature has no code, or code is broken
- **WARNING** — Feature partially implemented, or documentation is stale/inaccurate
- **INFO** — Minor discrepancy, cosmetic issue, or opportunity for improvement

### What to Check
1. **Documented but Missing**: Features described in the manual with no matching code
2. **Undocumented Features**: Routes or components that exist in code but aren't in the manual
3. **Stale Documentation**: Manual descriptions that don't match current UI
4. **Build Issues**: Any warnings or errors from Phase 2

## Phase 5 — Generate Comprehensive Report

Create a report at `docs/USER_TEST_REPORT_<YYYY-MM-DD>.md` with this structure:

```markdown
# Entomate — User Test Report
**Date**: YYYY-MM-DD
**Build Status**: PASS/FAIL

## Executive Summary
[2-3 sentence overall health assessment]
[Overall score: X chapters fully verified]

## Build Verification
- Status: PASS/FAIL
- Errors: [list or "None"]
- Warnings: [list or "None"]

## Chapter Verification Results

| Ch | Title | Route | Component | API | Sub-features | Status |
|----|-------|-------|-----------|-----|--------------|--------|
| 1  | ...   | ✅/❌  | ✅/❌     | ✅/❌| ✅/⚠️/❌    | CONFIRMED/PARTIAL/MISSING |

## Areas of Concern

### Critical
[numbered list with file paths and descriptions]

### Warning
[numbered list with file paths and descriptions]

### Info
[numbered list with file paths and descriptions]

## Recommendations
[prioritized action items]
```

## Summary

This command produces:
1. Updated user documentation
2. Build health confirmation
3. A comprehensive verification report with actionable findings

The report serves as both a quality gate and a roadmap for documentation improvements.
