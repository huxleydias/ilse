import { parseCode, walkAST } from './ast.js';
import type { Result } from '../types.js';

export interface ComponentProfile {
  file: string;
  name: string;              // "InsightsNode", "SourceNode"
  line: number;
  family: string;            // derived from path: "canvas/nodes", "canvas/panels"
  tag: string;               // root element: "div", "button"
  isInteractive: boolean;    // has onClick, onSubmit, href
  styles: {
    radius: string[];        // ["rounded-2xl"]
    padding: string[];       // ["p-3", "px-4"]
    gap: string[];
    bg: string[];
    border: string[];
    hover: string[];
  };
  a11y: {
    hasRole: boolean;
    hasAriaLabel: boolean;
    hasTabIndex: boolean;
  };
  children: string[];        // child component/element names
}

/**
 * Profile all React components in a file.
 * Extracts structural info for family comparison.
 */
export async function profileComponents(
  files: Array<{ path: string; code: string }>,
): Promise<Result<ComponentProfile[]>> {
  const profiles: ComponentProfile[] = [];

  for (const file of files) {
    const parseResult = parseCode(file.code, file.path);
    if (!parseResult.ok) continue;

    // Derive family from path: src/components/canvas/nodes/insights-node.tsx → "canvas/nodes"
    const pathParts = file.path.split('/');
    const compIdx = pathParts.indexOf('components');
    const family = compIdx >= 0
      ? pathParts.slice(compIdx + 1, -1).join('/')
      : pathParts.slice(0, -1).join('/');

    // Extract component name from filename
    const fileName = pathParts[pathParts.length - 1].replace(/\.tsx?$/, '');
    const componentName = fileName
      .split(/[-_]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');

    // Track the root JSX element of the first return statement
    let rootFound = false;

    await walkAST(parseResult.value, {
      JSXOpeningElement(path) {
        if (rootFound) return;

        // Only capture the first significant JSX element (likely the root)
        const node = path.node;
        const line = node.loc?.start.line || 0;

        // Skip if it's deep inside (not a root-level return)
        let depth = 0;
        let current = path.parentPath;
        while (current) {
          if (current.node.type === 'JSXElement') depth++;
          current = current.parentPath;
        }
        if (depth > 1) return; // Only top-level JSX

        const tag = node.name.type === 'JSXIdentifier' ? node.name.name : '';
        if (!tag) return;

        // Collect attributes
        let className = '';
        let hasOnClick = false;
        let hasRole = false;
        let hasAriaLabel = false;
        let hasTabIndex = false;

        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') continue;
          if (attr.name.name === 'onClick' || attr.name.name === 'onSubmit') hasOnClick = true;
          if (attr.name.name === 'role') hasRole = true;
          if (attr.name.name === 'aria-label') hasAriaLabel = true;
          if (attr.name.name === 'tabIndex') hasTabIndex = true;
          if (attr.name.name === 'className' || attr.name.name === 'class') {
            if (attr.value?.type === 'StringLiteral') className = attr.value.value;
          }
        }

        // Parse classes into categories
        const classes = className.split(/\s+/).filter(Boolean);
        const styles: ComponentProfile['styles'] = {
          radius: [], padding: [], gap: [], bg: [], border: [], hover: [],
        };

        for (const cls of classes) {
          const base = cls.replace(/^(?:\w+:)+/, '');
          if (/^rounded/.test(base)) styles.radius.push(base);
          if (/^(p|px|py|pt|pr|pb|pl)-/.test(base)) styles.padding.push(base);
          if (/^gap/.test(base)) styles.gap.push(base);
          if (/^bg-/.test(base)) styles.bg.push(base);
          if (/^border/.test(base)) styles.border.push(base);
          if (/^hover:/.test(cls)) styles.hover.push(cls);
        }

        // Get children names
        const parent = path.parent;
        const children: string[] = [];
        if (parent?.type === 'JSXElement' && parent.children) {
          for (const child of parent.children as any[]) {
            if (child.type === 'JSXElement') {
              const childName = child.openingElement?.name;
              if (childName?.type === 'JSXIdentifier') {
                children.push(childName.name);
              }
            }
          }
        }

        profiles.push({
          file: file.path,
          name: componentName,
          line,
          family,
          tag,
          isInteractive: hasOnClick,
          styles,
          a11y: { hasRole, hasAriaLabel, hasTabIndex },
          children,
        });

        rootFound = true;
      },
    });

    rootFound = false;
  }

  return { ok: true, value: profiles };
}
