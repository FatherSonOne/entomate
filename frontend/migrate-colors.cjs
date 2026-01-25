#!/usr/bin/env node

/**
 * Color Migration Script for Multi-Brand Theme System
 * Systematically replaces hard-coded Tailwind colors with CSS variable-based utilities
 */

const fs = require('fs');
const path = require('path');

// Color mapping rules (order matters - most specific first)
const COLOR_MAPPINGS = [
  // === GRAY SCALE ===
  { from: /text-gray-900\b/g, to: 'text-content-primary' },
  { from: /text-gray-800\b/g, to: 'text-content-primary' },
  { from: /text-gray-700\b/g, to: 'text-content-secondary' },
  { from: /text-gray-600\b/g, to: 'text-content-secondary' },
  { from: /text-gray-500\b/g, to: 'text-content-tertiary' },
  { from: /text-gray-400\b/g, to: 'text-content-tertiary' },
  { from: /text-gray-300\b/g, to: 'text-content-muted' },

  { from: /bg-gray-50\b/g, to: 'bg-surface-muted' },
  { from: /bg-gray-100\b/g, to: 'bg-surface-muted' },
  { from: /bg-gray-200\b/g, to: 'bg-surface-muted' },
  { from: /bg-gray-300\b/g, to: 'bg-surface-muted' },

  { from: /border-gray-100\b/g, to: 'border-line-subtle' },
  { from: /border-gray-200\b/g, to: 'border-line-default' },
  { from: /border-gray-300\b/g, to: 'border-line-strong' },

  { from: /bg-white\b/g, to: 'bg-surface' },

  // === SEMANTIC SUCCESS (GREEN) ===
  { from: /text-green-900\b/g, to: 'text-semantic-success' },
  { from: /text-green-800\b/g, to: 'text-semantic-success' },
  { from: /text-green-700\b/g, to: 'text-semantic-success' },
  { from: /text-green-600\b/g, to: 'text-semantic-success' },
  { from: /text-green-500\b/g, to: 'text-semantic-success' },

  { from: /bg-green-50\b/g, to: 'bg-semantic-success-dim' },
  { from: /bg-green-100\b/g, to: 'bg-semantic-success-dim' },
  { from: /bg-green-600\b/g, to: 'bg-semantic-success' },
  { from: /bg-green-500\b/g, to: 'bg-semantic-success' },

  { from: /border-green-200\b/g, to: 'border-semantic-success' },
  { from: /border-green-300\b/g, to: 'border-semantic-success' },

  { from: /hover:bg-green-700\b/g, to: 'hover:opacity-90' },
  { from: /hover:bg-green-50\b/g, to: 'hover:bg-semantic-success-dim' },

  // === SEMANTIC ERROR (RED) ===
  { from: /text-red-900\b/g, to: 'text-semantic-error' },
  { from: /text-red-800\b/g, to: 'text-semantic-error' },
  { from: /text-red-700\b/g, to: 'text-semantic-error' },
  { from: /text-red-600\b/g, to: 'text-semantic-error' },
  { from: /text-red-500\b/g, to: 'text-semantic-error' },

  { from: /bg-red-50\b/g, to: 'bg-semantic-error-dim' },
  { from: /bg-red-100\b/g, to: 'bg-semantic-error-dim' },
  { from: /bg-red-600\b/g, to: 'bg-semantic-error' },
  { from: /bg-red-500\b/g, to: 'bg-semantic-error' },

  { from: /border-red-200\b/g, to: 'border-semantic-error' },
  { from: /border-red-300\b/g, to: 'border-semantic-error' },

  { from: /hover:bg-red-700\b/g, to: 'hover:opacity-90' },

  // === SEMANTIC WARNING (AMBER/ORANGE) ===
  { from: /text-amber-900\b/g, to: 'text-semantic-warning' },
  { from: /text-amber-800\b/g, to: 'text-semantic-warning' },
  { from: /text-amber-700\b/g, to: 'text-semantic-warning' },
  { from: /text-amber-600\b/g, to: 'text-semantic-warning' },
  { from: /text-amber-500\b/g, to: 'text-semantic-warning' },

  { from: /text-orange-800\b/g, to: 'text-semantic-warning' },
  { from: /text-orange-600\b/g, to: 'text-semantic-warning' },

  { from: /bg-amber-50\b/g, to: 'bg-semantic-warning-dim' },
  { from: /bg-amber-100\b/g, to: 'bg-semantic-warning-dim' },
  { from: /bg-amber-300\b/g, to: 'bg-semantic-warning' },

  { from: /bg-orange-100\b/g, to: 'bg-semantic-warning-dim' },

  { from: /border-amber-200\b/g, to: 'border-semantic-warning' },
  { from: /border-amber-300\b/g, to: 'border-semantic-warning' },
  { from: /border-orange-200\b/g, to: 'border-semantic-warning' },

  // === SEMANTIC INFO (BLUE) ===
  { from: /text-blue-900\b/g, to: 'text-semantic-info' },
  { from: /text-blue-800\b/g, to: 'text-semantic-info' },
  { from: /text-blue-700\b/g, to: 'text-semantic-info' },
  { from: /text-blue-600\b/g, to: 'text-semantic-info' },

  { from: /bg-blue-50\b/g, to: 'bg-semantic-info-dim' },
  { from: /bg-blue-100\b/g, to: 'bg-semantic-info-dim' },

  { from: /border-blue-200\b/g, to: 'border-semantic-info' },

  // === ACCENT INDIGO/PURPLE ===
  { from: /text-indigo-900\b/g, to: 'text-accent-primary' },
  { from: /text-indigo-700\b/g, to: 'text-accent-primary' },
  { from: /text-indigo-600\b/g, to: 'text-accent-primary' },
  { from: /text-indigo-500\b/g, to: 'text-accent-primary' },
  { from: /text-indigo-100\b/g, to: 'text-content-tertiary' },

  { from: /bg-indigo-100\b/g, to: 'bg-accent-primary-dim' },
  { from: /bg-indigo-50\b/g, to: 'bg-accent-primary-dim' },

  { from: /text-purple-900\b/g, to: 'text-accent-tertiary' },
  { from: /text-purple-700\b/g, to: 'text-accent-tertiary' },
  { from: /text-purple-600\b/g, to: 'text-accent-tertiary' },

  { from: /bg-purple-100\b/g, to: 'bg-accent-tertiary-dim' },
  { from: /bg-purple-50\b/g, to: 'bg-accent-tertiary-dim' },
  { from: /border-purple-200\b/g, to: 'border-accent-tertiary' },

  // === PRIMARY BUTTON COLORS ===
  { from: /bg-primary-600\b/g, to: 'bg-accent-primary' },
  { from: /hover:bg-primary-700\b/g, to: 'hover:opacity-90' },
  { from: /text-primary-600\b/g, to: 'text-accent-primary' },
  { from: /hover:text-primary-700\b/g, to: 'hover:text-accent-primary' },
  { from: /hover:bg-primary-50\b/g, to: 'hover:bg-accent-primary-dim' },
  { from: /disabled:bg-gray-300\b/g, to: 'disabled:bg-surface-muted disabled:text-content-muted' },
  { from: /disabled:text-gray-400\b/g, to: 'disabled:text-content-muted' },

  // === GRADIENTS ===
  { from: /bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700/g, to: 'bg-gradient-to-r from-accent-primary via-accent-tertiary to-accent-primary' },
];

// === BRAND-SPECIFIC COLORS TO PRESERVE ===
// These should NOT be migrated as they're used for specific visual purposes
const PRESERVE_PATTERNS = [
  /text-amber-400/,  // Star ratings
  /fill-amber-400/,  // Star fill
  /text-amber-500/,  // Star highlights  /bg-red-500/,      // Progress bars (specific colors)
  /bg-amber-500/,    // Progress bars (specific colors)
  /bg-green-500/,    // Progress bars (specific colors)
];

function shouldPreserve(line) {
  return PRESERVE_PATTERNS.some(pattern => pattern.test(line));
}

function migrateFile(filePath) {
  console.log(`\nMigrating: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let changeCount = 0;

  // Apply color mappings line by line to check preservation rules
  const lines = content.split('\n');
  const migratedLines = lines.map(line => {
    if (shouldPreserve(line)) {
      return line; // Skip this line
    }

    let migratedLine = line;
    COLOR_MAPPINGS.forEach(({ from, to }) => {
      const before = migratedLine;
      migratedLine = migratedLine.replace(from, to);
      if (before !== migratedLine) changeCount++;
    });

    return migratedLine;
  });

  content = migratedLines.join('\n');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Migrated ${changeCount} color references`);
    return changeCount;
  } else {
    console.log(`✓ No changes needed`);
    return 0;
  }
}

function migrateDirectory(dirPath, pattern = /\.jsx$/i) {
  console.log(`\n=== Migrating directory: ${dirPath} ===`);

  const files = fs.readdirSync(dirPath);
  let totalChanges = 0;

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      totalChanges += migrateDirectory(filePath, pattern);
    } else if (pattern.test(file)) {
      totalChanges += migrateFile(filePath);
    }
  });

  return totalChanges;
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node migrate-colors.js <directory-or-file>');
  console.log('Example: node migrate-colors.js src/components/intelligence');
  process.exit(1);
}

const targetPath = path.resolve(args[0]);

if (!fs.existsSync(targetPath)) {
  console.error(`Error: Path does not exist: ${targetPath}`);
  process.exit(1);
}

const stat = fs.statSync(targetPath);
let totalChanges = 0;

if (stat.isDirectory()) {
  totalChanges = migrateDirectory(targetPath);
} else {
  totalChanges = migrateFile(targetPath);
}

console.log(`\n\n=== Migration Complete ===`);
console.log(`Total color references migrated: ${totalChanges}`);
