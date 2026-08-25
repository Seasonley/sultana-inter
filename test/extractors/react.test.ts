import { describe, it, expect } from 'vitest';
import { extractReact } from '../../src/extractors/react';

const FILE = '/project/src/App.tsx';
const REL = 'src/App.tsx';

describe('extractReact', () => {
  it('should extract Chinese text from JSX text nodes', () => {
    const source = 'const App = () => <div>你好世界</div>;';
    const entries = extractReact(FILE, REL, source);

    expect(entries.length).toBe(1);
    expect(entries[0].text).toBe('你好世界');
    expect(entries[0].callSiteType).toBe('jsx-text');
    expect(entries[0].framework).toBe('react');
  });

  it('should extract Chinese string literals', () => {
    const source = 'const msg = "欢迎使用";';
    const entries = extractReact(FILE, REL, source);

    expect(entries.length).toBe(1);
    expect(entries[0].text).toBe('欢迎使用');
    expect(entries[0].callSiteType).toBe('string');
    expect(entries[0].framework).toBe('react');
    expect(entries[0].isString).toBe(true);
  });

  it('should extract Chinese text from JSX attribute values', () => {
    // The extractor visits both JsxAttribute and its StringLiteral child,
    // so the same text produces two entries: one jsx-attr and one string.
    const source = 'const App = () => <Comp title="标题"/>;';
    const entries = extractReact(FILE, REL, source);

    expect(entries.length).toBeGreaterThanOrEqual(1);
    const jsxAttrEntry = entries.find((e) => e.callSiteType === 'jsx-attr');
    expect(jsxAttrEntry).toBeDefined();
    expect(jsxAttrEntry!.text).toBe('标题');
    expect(jsxAttrEntry!.framework).toBe('react');
    expect(jsxAttrEntry!.isString).toBe(true);
  });

  it('should extract template literals with variables', () => {
    const source = 'const msg = `你好${name}`;';
    const entries = extractReact(FILE, REL, source);

    expect(entries.length).toBe(1);
    expect(entries[0].text).toBe('你好${name}');
    expect(entries[0].callSiteType).toBe('string');
    expect(entries[0].framework).toBe('react');
    expect(entries[0].vars).toBeDefined();
    expect(entries[0].vars!.length).toBe(1);
    expect(entries[0].vars![0].name).toBe('val1');
    expect(entries[0].vars![0].expr).toBe('name');
  });

  it('should skip import paths containing Chinese', () => {
    const source = "import x from '你好';";
    const entries = extractReact(FILE, REL, source);

    const importEntry = entries.find((e) => e.text === '你好');
    expect(importEntry).toBeUndefined();
  });

  it('should skip existing t() calls', () => {
    const source = 'const App = () => <div>{t("key")}</div>;';
    const entries = extractReact(FILE, REL, source);

    const keyEntry = entries.find((e) => e.text === 'key');
    expect(keyEntry).toBeUndefined();
  });
});
