// 插槽转发行为测试（SFC + happy-dom）
// 运行：pnpm run test（在 module-guides/vue-slot-forwarding 目录下）
import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import Leaf from './Leaf.vue';
import Middle from './Middle.vue';
import NoForwardMiddle from './NoForwardMiddle.vue';
import Page from './Page.vue';

describe('插槽转发', () => {
  it('页面传入的内容穿透中间层，到达叶子组件的插槽出口', () => {
    const wrapper = mount(Page);
    // 两段页面内容都渲染出来了
    expect(wrapper.find('.user-content').exists()).toBe(true);
    expect(wrapper.find('.footer-content').exists()).toBe(true);
    // 并且渲染在 Leaf 内部（说明穿透了 Middle）
    expect(wrapper.find('.leaf .user-content').exists()).toBe(true);
  });

  it('插槽参数沿途合并：叶子产的 + 中间层注入的，页面都能拿到', () => {
    const wrapper = mount(Page);
    const text = wrapper.find('.user-content').text();
    // 来自 Leaf 的 slotProps
    expect(text).toContain('user=jalon');
    expect(text).toContain('source=leaf');
    // 来自 Middle 桥接时注入的参数
    expect(text).toContain('injected=M');
    // footer 的参数来自 Leaf
    expect(wrapper.find('.footer-content').text()).toContain(
      'from=leaf-footer',
    );
  });

  it('对照组：中间层不转发，插槽内容到不了叶子（插槽不会自动穿透）', () => {
    const wrapper = mount(NoForwardMiddle, {
      slots: {
        user: '<p class="user-content">页面内容</p>',
      },
    });
    // Leaf 渲染了，但它的 slot 出口是空的
    expect(wrapper.find('.leaf').exists()).toBe(true);
    expect(wrapper.find('.leaf .user-content').exists()).toBe(false);
    // 内容卡在了 Middle 自己的 $slots 里，没有出口消费它
    expect(wrapper.find('.no-forward > .user-content').exists()).toBe(false);
  });

  it('基线：Leaf 单独使用时，没有插槽内容时出口渲染为空', () => {
    const wrapper = mount(Leaf, { props: { userName: 'x' } });
    expect(wrapper.find('.leaf').exists()).toBe(true);
    expect(wrapper.find('.user-content').exists()).toBe(false);
  });

  it('中间层的转发名单来自调用方（useSlots），多传一个名字就多一座桥', () => {
    const wrapper = mount(Middle, {
      slots: {
        user: '<p class="user-content">u</p>',
        extra: '<p class="extra-content">e</p>',
      },
    });
    // Leaf 没有 extra 出口：桥建好了，但下游没有对应的洞，内容不会被渲染
    expect(wrapper.find('.extra-content').exists()).toBe(false);
    // user 正常到达
    expect(wrapper.find('.user-content').exists()).toBe(true);
  });
});
