#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to find and replace
const replacements = [
  {
    pattern: /console\.log\(/g,
    replace: 'log.debug(',
    import: "import { log } from '@/lib/logger';"
  },
  {
    pattern: /console\.error\(/g,
    replace: 'log.error(',
    import: "import { log } from '@/lib/logger';"
  },
  {
    pattern: /console\.warn\(/g,
    replace: 'log.warn(',
    import: "import { log } from '@/lib/logger';"
  },
  {
    pattern: /console\.info\(/g,
    replace: 'log.info(',
    import: "import { log } from '@/lib/logger';"
  }
];

// Directories to process
const directories = [
  'app/**/*.{ts,tsx}',
  'components/**/*.{ts,tsx}',
  'lib/**/*.{ts,tsx}',
];

// Files to exclude
const excludePatterns = [
  '**/node_modules/**',
  '**/logger.ts',
  '**/error-boundary.tsx',
  '**/async-handler.ts',
  '**/*.test.*',
  '**/*.spec.*',
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let needsImport = false;

  // Check if file already has logger import
  const hasLoggerImport = content.includes("from '@/lib/logger'") || 
                          content.includes('from "@/lib/logger"');

  // Apply replacements
  replacements.forEach(({ pattern, replace }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replace);
      modified = true;
      needsImport = true;
    }
  });

  // Add import if needed
  if (modified && needsImport && !hasLoggerImport) {
    // Find the last import statement
    const importMatch = content.match(/^import.*from.*;?\s*$/gm);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      content = content.slice(0, lastImportIndex + lastImport.length) + 
                "\nimport { log } from '@/lib/logger';" +
                content.slice(lastImportIndex + lastImport.length);
    } else {
      // No imports found, add at the beginning
      content = "import { log } from '@/lib/logger';\n\n" + content;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
    return true;
  }
  
  return false;
}

async function main() {
  console.log('🔍 Searching for console.* statements to replace...\n');
  
  let totalFiles = 0;
  let updatedFiles = 0;

  for (const pattern of directories) {
    const files = glob.sync(pattern, {
      ignore: excludePatterns,
      absolute: false,
    });

    for (const file of files) {
      totalFiles++;
      if (processFile(file)) {
        updatedFiles++;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files updated: ${updatedFiles}`);
  console.log(`\n✨ Console log replacement complete!`);
}

// Check if glob is installed
try {
  require.resolve('glob');
  main().catch(console.error);
} catch (e) {
  console.log('Installing required dependency...');
  const { execSync } = require('child_process');
  execSync('npm install --no-save glob', { stdio: 'inherit' });
  main().catch(console.error);
}