import { describe, it, expect } from 'vitest';
import { extractVue } from '../../src/extractors/vue';

const FILE = '/project/src/components/Home.vue';
const REL = 'src/components/Home.vue';

describe('extractVue', () => {
  it('should extract Chinese text from pure template', () => {
    const source = '<template><div>你好世界</div></template>';
    const entries = extractVue(FILE, REL, source);

    expect(entries.length).toBe(1);
    expect(entries[0].text).toBe('你好世界');
    expect(entries[0].callSiteType).toBe('vue-template');
    expect(entries[0].framework).toBe('vue');
    expect(entries[0].isString).toBe(false);
  });

  it('should extract string literals in <script setup>', () => {
    const source = `<template><div></div></template>
<script setup>
const msg = ref('欢迎')
</script>`;
    const entries = extractVue(FILE, REL, source);

    const msgEntry = entries.find((e) => e.text === '欢迎');
    expect(msgEntry).toBeDefined();
    expect(msgEntry!.callSiteType).toBe('string');
    expect(msgEntry!.framework).toBe('vue');
    expect(msgEntry!.isString).toBe(true);
  });

  it('should extract both template text and script strings in mixed SFC', () => {
    const source = `<template>
  <div>你好世界</div>
</template>
<script setup>
const label = '确定'
</script>`;
    const entries = extractVue(FILE, REL, source);

    const templateEntry = entries.find((e) => e.callSiteType === 'vue-template');
    const scriptEntry = entries.find((e) => e.callSiteType === 'string');

    expect(templateEntry).toBeDefined();
    expect(templateEntry!.text).toBe('你好世界');

    expect(scriptEntry).toBeDefined();
    expect(scriptEntry!.text).toBe('确定');
  });

  it('should skip import paths containing Chinese', () => {
    const source = `<template></template>
<script setup>
import x from '你好'
</script>`;
    const entries = extractVue(FILE, REL, source);

    const importEntry = entries.find((e) => e.text === '你好');
    expect(importEntry).toBeUndefined();
  });

  it('should skip existing $t() calls in template', () => {
    const source = '<template><div>{{ $t(\'key\') }}</div></template>';
    const entries = extractVue(FILE, REL, source);

    // $t('key') is interpolation / call expression — should not be extracted as Chinese text
    expect(entries.length).toBe(0);
  });

  it('should extract Chinese text with HTML entities in template', () => {
    const source = '<template><div>你&nbsp;好</div></template>';
    const entries = extractVue(FILE, REL, source);

    expect(entries.length).toBe(1);
    // The Vue template parser decodes &nbsp; into the actual character
    expect(entries[0].text).toMatch(/你/);
    expect(entries[0].text).toMatch(/好/);
    expect(entries[0].callSiteType).toBe('vue-template');
    expect(entries[0].framework).toBe('vue');
  });
});
