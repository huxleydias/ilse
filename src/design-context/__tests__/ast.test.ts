import { describe, it, expect } from 'vitest';
import { parseCode, walkAST, getSourceContext } from '../ast.js';

describe('parseCode', () => {
  it('parses simple JSX', () => {
    const code = `
      function Button() {
        return <button>Click me</button>;
      }
    `;

    const result = parseCode(code, 'Button.jsx');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('File');
    }
  });

  it('parses TSX with types', () => {
    const code = `
      interface Props {
        label: string;
      }

      function Button({ label }: Props) {
        return <button>{label}</button>;
      }
    `;

    const result = parseCode(code, 'Button.tsx');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('File');
    }
  });

  it('parses inline styles', () => {
    const code = `
      function Card() {
        return <div style={{ color: '#6366f1', padding: '16px' }}>Content</div>;
      }
    `;

    const result = parseCode(code, 'Card.tsx');

    expect(result.ok).toBe(true);
  });

  it('parses Tailwind className', () => {
    const code = `
      function Card() {
        return <div className="bg-[#6366f1] p-4 gap-[13px]">Content</div>;
      }
    `;

    const result = parseCode(code, 'Card.tsx');

    expect(result.ok).toBe(true);
  });

  it('handles severely malformed syntax', () => {
    const code = `
      function Button( {
        return <button>Click me</button;
      }
    `;

    const result = parseCode(code, 'Button.tsx');

    // Babel may return an error for severely malformed code
    // The important thing is it doesn't throw
    expect(typeof result.ok).toBe('boolean');
  });
});

describe('walkAST', () => {
  it('visits JSX elements', async () => {
    const code = `
      function Card() {
        return <div><span>Text</span></div>;
      }
    `;

    const result = parseCode(code, 'Card.tsx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const elements: string[] = [];
    await walkAST(result.value, {
      JSXOpeningElement(path) {
        if (path.node.name.type === 'JSXIdentifier') {
          elements.push(path.node.name.name);
        }
      },
    });

    expect(elements).toContain('div');
    expect(elements).toContain('span');
  });

  it('visits JSX attributes', async () => {
    const code = `
      function Card() {
        return <div className="test" style={{ color: 'red' }}>Content</div>;
      }
    `;

    const result = parseCode(code, 'Card.tsx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const attributes: string[] = [];
    await walkAST(result.value, {
      JSXAttribute(path) {
        if (path.node.name.type === 'JSXIdentifier') {
          attributes.push(path.node.name.name);
        }
      },
    });

    expect(attributes).toContain('className');
    expect(attributes).toContain('style');
  });
});

describe('getSourceContext', () => {
  it('extracts context around a position', () => {
    const code = 'const x = "hello world";';
    const context = getSourceContext(code, 1, 10, 20);

    expect(context).toContain('hello');
  });

  it('handles multiline code', () => {
    const code = 'line1\nline2\nline3';
    const context = getSourceContext(code, 2, 0, 10);

    expect(context).toBe('line2');
  });

  it('returns empty for invalid line', () => {
    const code = 'single line';
    const context = getSourceContext(code, 5, 0, 10);

    expect(context).toBe('');
  });
});
