import { describe, it, expect } from 'vitest';
import { extractAngular } from '../../src/extractors/angular';

const FILE = '/project/src/app/home.component.html';
const REL = 'src/app/home.component.html';

describe('extractAngular', () => {
  it('should extract Chinese text from interpolation expressions', () => {
    // Angular treats {{你好}} as a BoundText node whose Interpolation value
    // has source="{{你好}}". The visitor extracts each Chinese character.
    const source = '<div>{{你好}}</div>';
    const entries = extractAngular(FILE, REL, source);

    expect(entries.length).toBeGreaterThanOrEqual(1);
    const allText = entries.map((e) => e.text).join('');
    expect(allText).toContain('你');
    expect(allText).toContain('好');
    expect(entries[0].framework).toBe('angular');
  });

  it('should extract Chinese text from text nodes', () => {
    const source = '<div>欢迎使用</div>';
    const entries = extractAngular(FILE, REL, source);

    expect(entries.length).toBe(1);
    expect(entries[0].text).toBe('欢迎使用');
    expect(entries[0].callSiteType).toBe('angular-html');
    expect(entries[0].framework).toBe('angular');
  });

  it('should extract Chinese text from static attributes', () => {
    // Static HTML attributes (TextAttribute) are stored in the element's
    // `attributes` array, which the visitor traverses. The valueSpan covers
    // just the attribute value without quotes, so isString is false.
    const source = '<div title="标题"></div>';
    const entries = extractAngular(FILE, REL, source);

    expect(entries.length).toBeGreaterThanOrEqual(1);
    const titleEntry = entries.find((e) => e.text === '标题');
    expect(titleEntry).toBeDefined();
    expect(titleEntry!.framework).toBe('angular');
    expect(titleEntry!.callSiteType).toBe('angular-html');
  });

  it('should skip expressions using the translate pipe', () => {
    // {{ 'key' | translate }} — the expression source contains no Chinese
    // characters, so the visitor should not produce any entries.
    const source = `{{ 'key' | translate }}`;
    const entries = extractAngular(FILE, REL, source);

    expect(entries.length).toBe(0);
  });
});
