import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type Framework =
  | 'next-app'
  | 'next-pages'
  | 'vite-react'
  | 'cra'
  | 'remix'
  | 'astro'
  | 'unknown';

export interface FrameworkDetection {
  framework: Framework;
  layoutPath?: string;     // absolute path to the layout/root file
  alreadyInstalled?: boolean;
}

function readPackageJson(cwd: string): Record<string, unknown> | null {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

function findFirstExisting(paths: string[]): string | undefined {
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

/**
 * Search for a layout.tsx/jsx inside app/ or src/app/, up to 2 levels deep.
 * Handles patterns like [locale]/layout.tsx, (group)/layout.tsx.
 * Returns the one that contains <html> + <body> (the root layout).
 */
function findNestedAppLayout(cwd: string): string | undefined {
  const appDirs = [resolve(cwd, 'src/app'), resolve(cwd, 'app')];
  for (const appDir of appDirs) {
    if (!existsSync(appDir)) continue;
    const found = walkForRootLayout(appDir, 2);
    if (found) return found;
  }
  return undefined;
}

function walkForRootLayout(dir: string, maxDepth: number): string | undefined {
  if (maxDepth < 0) return undefined;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return undefined;
  }

  // Check current directory for layout files
  for (const name of ['layout.tsx', 'layout.jsx']) {
    const full = join(dir, name);
    if (existsSync(full)) {
      try {
        const content = readFileSync(full, 'utf-8');
        // Root layout has both <html> and <body>
        if (content.includes('<html') && content.includes('<body')) {
          return full;
        }
      } catch { /* skip */ }
    }
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const full = join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        const result = walkForRootLayout(full, maxDepth - 1);
        if (result) return result;
      }
    } catch { /* skip */ }
  }
  return undefined;
}

/**
 * Trace Vite's entry point to find the actual root component.
 * Reads main.tsx/jsx → finds createRoot().render(<App />) → resolves App import → returns App file path.
 * This avoids injecting into the wrong component in projects with non-standard structures.
 */
function findViteRootComponent(cwd: string): string | undefined {
  const mainPath = findFirstExisting([
    resolve(cwd, 'src/main.tsx'),
    resolve(cwd, 'src/main.jsx'),
    resolve(cwd, 'src/index.tsx'),
    resolve(cwd, 'src/index.jsx'),
  ]);
  if (!mainPath) return undefined;

  let content: string;
  try {
    content = readFileSync(mainPath, 'utf-8');
  } catch {
    return undefined;
  }

  // Match the root component in createRoot().render(<ComponentName ... />)
  // or ReactDOM.render(<ComponentName ... />, ...)
  const renderMatch = content.match(/\.render\(\s*(?:<React\.StrictMode>\s*)?<(\w+)/);
  if (!renderMatch) return undefined;

  const componentName = renderMatch[1];
  // "StrictMode" is a wrapper, not the root — look deeper
  if (componentName === 'StrictMode') {
    const innerMatch = content.match(/<StrictMode>\s*<(\w+)/);
    if (!innerMatch) return undefined;
    return resolveImportPath(content, innerMatch[1], mainPath);
  }

  return resolveImportPath(content, componentName, mainPath);
}

/**
 * Given a component name and the file that imports it, resolve the import to an absolute path.
 */
function resolveImportPath(fileContent: string, componentName: string, fromFile: string): string | undefined {
  const dir = fromFile.replace(/\/[^/]+$/, '');
  // Match: import ComponentName from './path' or import { ComponentName } from './path'
  const importPattern = new RegExp(
    `import\\s+(?:\\{[^}]*\\b${componentName}\\b[^}]*\\}|${componentName})\\s+from\\s+['"]([^'"]+)['"]`
  );
  const match = fileContent.match(importPattern);
  if (!match) return undefined;

  const importPath = match[1];
  // Resolve relative import to absolute path, trying common extensions
  if (importPath.startsWith('.')) {
    const base = resolve(dir, importPath);
    return findFirstExisting([
      base + '.tsx',
      base + '.jsx',
      base + '.ts',
      base + '.js',
      base, // already has extension
    ]);
  }
  return undefined;
}

function hasIlseImport(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.includes('ilse-design/react') || content.includes('<Ilse');
  } catch {
    return false;
  }
}

export function detectFramework(cwd: string = process.cwd()): FrameworkDetection {
  const pkg = readPackageJson(cwd);
  const deps = {
    ...(pkg?.dependencies as Record<string, string> ?? {}),
    ...(pkg?.devDependencies as Record<string, string> ?? {}),
  };

  // Next.js
  if (deps.next) {
    // App Router — try root, then nested (i18n patterns like [locale]/layout.tsx)
    const appLayout = findFirstExisting([
      resolve(cwd, 'src/app/layout.tsx'),
      resolve(cwd, 'src/app/layout.jsx'),
      resolve(cwd, 'app/layout.tsx'),
      resolve(cwd, 'app/layout.jsx'),
    ]) ?? findNestedAppLayout(cwd);
    if (appLayout) {
      return {
        framework: 'next-app',
        layoutPath: appLayout,
        alreadyInstalled: hasIlseImport(appLayout),
      };
    }
    // Pages Router
    const pagesApp = findFirstExisting([
      resolve(cwd, 'src/pages/_app.tsx'),
      resolve(cwd, 'src/pages/_app.jsx'),
      resolve(cwd, 'pages/_app.tsx'),
      resolve(cwd, 'pages/_app.jsx'),
    ]);
    if (pagesApp) {
      return {
        framework: 'next-pages',
        layoutPath: pagesApp,
        alreadyInstalled: hasIlseImport(pagesApp),
      };
    }
    return { framework: 'next-app' };
  }

  // Remix
  if (deps['@remix-run/react'] || deps['@remix-run/node']) {
    const rootPath = findFirstExisting([
      resolve(cwd, 'app/root.tsx'),
      resolve(cwd, 'app/root.jsx'),
    ]);
    if (rootPath) {
      return { framework: 'remix', layoutPath: rootPath, alreadyInstalled: hasIlseImport(rootPath) };
    }
    return { framework: 'remix' };
  }

  // Astro
  if (deps.astro) {
    return { framework: 'astro' };
  }

  // Vite + React
  if (deps.vite && (deps.react || deps['@vitejs/plugin-react'])) {
    // Strategy: find the root component by tracing main.tsx/jsx → createRoot → <App />
    const rootComponent = findViteRootComponent(cwd);
    if (rootComponent) {
      return { framework: 'vite-react', layoutPath: rootComponent, alreadyInstalled: hasIlseImport(rootComponent) };
    }
    // Fallback: try App.tsx/jsx directly
    const appPath = findFirstExisting([
      resolve(cwd, 'src/App.tsx'),
      resolve(cwd, 'src/App.jsx'),
    ]);
    if (appPath) {
      return { framework: 'vite-react', layoutPath: appPath, alreadyInstalled: hasIlseImport(appPath) };
    }
    return { framework: 'vite-react' };
  }

  // Create React App
  if (deps['react-scripts']) {
    const appPath = findFirstExisting([
      resolve(cwd, 'src/App.tsx'),
      resolve(cwd, 'src/App.jsx'),
    ]);
    if (appPath) {
      return { framework: 'cra', layoutPath: appPath, alreadyInstalled: hasIlseImport(appPath) };
    }
    return { framework: 'cra' };
  }

  return { framework: 'unknown' };
}
