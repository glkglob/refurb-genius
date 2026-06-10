/**
 * Architectural Invariant: No Direct Legacy Imports
 * 
 * Enforces that code outside approved boundaries (features/, platform/, core/)
 * cannot directly import from legacy modules (@/core, @/lib, @/services, @/integrations).
 * 
 * This prevents architectural drift and ensures proper layering:
 * - Routes should import from @/features/* or @/platform/*
 * - Components should import from @/features/* or @/platform/*
 * - Server functions should import from @/features/* or @/platform/*
 * 
 * Allowed directories:
 * - src/features/* - Can import from legacy (transitional)
 * - src/platform/* - Can import from legacy (transitional)
 * - src/core/* - Internal legacy module (can import from other core/lib)
 * 
 * See: docs/architecture/audit-2026-06-10.md for current violations
 */

import { describe, it, expect } from 'vitest';
import { glob } from 'glob';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Patterns that indicate legacy imports
 */
const FORBIDDEN_PATTERNS = [
  /from\s+["']@\/(lib|services|core|integrations)\//,
  /from\s+["']@\/(lib|services|core|integrations)["']/,
];

/**
 * Directories that are allowed to import from legacy modules
 */
const ALLOWED_DIRS = [
  'src/features/',
  'src/platform/',
  'src/core/',        // Core can import from other core/lib
  'src/lib/',         // Lib can import from other lib
  'src/integrations/', // Integrations can import from lib
  'src/services/',    // Services are transitional (will be migrated to features)
  'src/types/',       // Type re-exports are acceptable temporarily
];

/**
 * Files to exclude from the check
 */
const EXCLUDED_PATTERNS = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/node_modules/**',
  '**/.windsurf/**',
  '**/dist/**',
  '**/build/**',
];

describe('Architectural Invariant: No Direct Legacy Imports', () => {
  it('prevents legacy imports outside approved boundaries', async () => {
    // Find all TypeScript files in src/
    const files = await glob('src/**/*.{ts,tsx}', {
      ignore: EXCLUDED_PATTERNS,
      absolute: true,
      cwd: resolve(process.cwd()),
    });

    const violations: Array<{ file: string; line: number; match: string }> = [];

    for (const file of files) {
      // Skip files in allowed directories
      const relativePath = file.replace(process.cwd() + '/', '');
      if (ALLOWED_DIRS.some(dir => relativePath.includes(dir))) {
        continue;
      }

      // Read file content
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      // Check each line for forbidden patterns
      lines.forEach((line, index) => {
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: relativePath,
              line: index + 1,
              match: line.trim(),
            });
          }
        }
      });
    }

    // Format violations for readable error message
    if (violations.length > 0) {
      const violationsByFile = violations.reduce((acc, v) => {
        if (!acc[v.file]) acc[v.file] = [];
        acc[v.file].push(`  Line ${v.line}: ${v.match}`);
        return acc;
      }, {} as Record<string, string[]>);

      const errorMessage = [
        '\n❌ Legacy imports detected outside approved boundaries!\n',
        'Files outside src/features/ and src/platform/ should not import from:',
        '  - @/core/*',
        '  - @/lib/*',
        '  - @/services/*',
        '  - @/integrations/*\n',
        'Violations found:\n',
        ...Object.entries(violationsByFile).map(([file, lines]) => 
          `${file}:\n${lines.join('\n')}`
        ),
        '\nRemediation:',
        '  1. Move the imported module to @/features/* or @/platform/*',
        '  2. Create a facade/adapter in the appropriate feature',
        '  3. Update imports to use the new location\n',
        'See: docs/architecture/audit-2026-06-10.md for current violations and migration plan',
      ].join('\n');

      expect(violations, errorMessage).toEqual([]);
    }

    // Test passes if no violations
    expect(violations).toEqual([]);
  });

  it('documents the architectural boundary rules', () => {
    // This test serves as documentation
    const rules = {
      forbiddenImports: ['@/core/*', '@/lib/*', '@/services/*', '@/integrations/*'],
      allowedDirectories: ALLOWED_DIRS,
      reasoning: [
        'Routes should import from features/platform for better modularity',
        'Components should be decoupled from legacy infrastructure',
        'Server functions should use feature boundaries',
        'This enables incremental migration to clean architecture',
      ],
    };

    expect(rules.forbiddenImports).toHaveLength(4);
    expect(rules.allowedDirectories).toContain('src/features/');
    expect(rules.allowedDirectories).toContain('src/platform/');
  });
});
