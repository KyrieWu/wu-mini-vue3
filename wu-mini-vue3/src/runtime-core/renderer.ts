import { createAppAPI } from "./apiCreateApp";
import { setCurrentInstance, Data } from "./component";
import { queueJob } from "./scheduler";
import { isSameVNodeType, VNode, VNodeArrayChildren } from "./vnode";
import { effect } from "../reactivity";
import { ShapeFlags } from "../shared";
import { compile } from "vue";

export interface RendererNode {
  [key: string]: any;
}

type PatchFn = (
  n1: VNode | null, // null means this is a mount
  n2: VNode,
  container: RendererElement,
  anchor?: RendererNode | null,
  parentComponent?: null,
  parentSuspense?: null,
  isSVG?: boolean,
  slotScopeIds?: string[] | null,
  optimized?: boolean
) => void;

export interface RendererElement extends RendererNode {}

export function createRender(options: any) {
  // 通过 options 得到操作 DOM 的API
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId,
  } = options;

  // 核心调度逻辑
  // n1和n2是新老虚拟dom元素
  const patch: PatchFn = (n1, n2, container) => {
    if (n1 == n2) {
      return;
    }
    if (n1 && !isSameVNodeType(n1, n2)) {
      // n1 和 n2 类型不同，直接销毁 n1 挂载 n2
      n1 = null;
    }

    const { type, shapeFlag } = n2;
    switch (type) {
      case Text:
        //处理 text
        break;
      // 还有注释，fragment之类的处理，这里忽略
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理element
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 处理 component
        }
    }
  };

  // 处理组件
  function processComponent(
    n1: VNode | null,
    n2: VNode,
    container: RendererElement
  ) {
    if (!n1) {
      // 挂载新组建
    } else {
      // 更新组建
    }
  }

  // 处理HTML 元素
  function processElemet(n1: VNode, n2: VNode, anchor: RendererNode | null) {
    if (!n1) {
      // 挂载新HTML
    } else {
      // 更新html
    }
  }

  // 处理文本元素
  function processText(n1: VNode, n2: VNode, container: RendererElement) {
    if (n1 === null) {
      n2.el = hostCreateText(n2.children);
      hostInsert(n2.el, container);
    } else {
      if (n1.children !== n2.children) {
        n2.el = n1.el;
        // 文本不同，更新文本
        hostSetText(n2.el, n2.children);
      }
    }
  }

  function shouldComponentUpdate(prevVnode: VNode, nextVnode: VNode) {
    const prev = prevVnode.props;
    const next = nextVnode.props;
    if (prev === next) {
      return false;
    }
    return true;
  }

  // 更新组件
  function updateComponent(n1: VNode, n2: VNode, container: RendererElement) {
    const instance = (n2.component = n1.component)!;
    if (shouldComponentUpdate(n1, n2)) {
      // 需要更新
      instance.next = n2;
      // setupRenderEffect里面注册的update方法
      // next里面调用patch
      instance.update(); // 注册的更新函数
    } else {
      // 不需要更新，简单覆盖一下属性
      n2.component = n1.component;
      instance.vnode = n2;
    }
  }

  // 更新HTML元素
  function updateElement(n1: VNode, n2: VNode, container: RendererElement) {
    const oldProps = n1?.props || {};
    const newProps = n2.props || {};

    const el = (n2.el = n1.el!);
    // 根据patchProps 判读  class style 等属性
    //patchProps(el);

    // 对比children
  }

  function patchProps(el: RendererElement, oldProps: Data, newProps: Data) {
    // 遍历 newProps 覆盖 old props
    for (const key in newProps) {
      const prev = oldProps[key];
      const next = newProps[key];
      if (prev !== next) {
        hostPatchProp(el, key, prev, next);
      }
    }

    // 遍历 oldProps 如果 new props 中没有就删除
    for (const key in oldProps) {
      const prev = oldProps[key];
      if (!(key in newProps)) {
        hostPatchProp(el, key, prev, null);
      }
    }
  }

  // 挂载组件
  function mountComponent(vnode: VNode, container: RendererElement) {
    // 创建组件实例，其实就是一个对象，包含组件的各种属性
    const instance = (vnode.component = {
      vnode,
      type: vnode.type,
      props: vnode.props,
      setupState: {}, //响应式状态
      slots: {},
      ctx: {},
      emit: () => {},
    });
    // 启动setup函数中的各种响应式数据
  }

  function setupComponent(instance: any) {
    const { props, children } = instance.vnode;
    // 其实还需要处理slot，根据flags 这里忽略一下下@todo
    // initSlots(instance, children)
    // 只考虑了composition语法的setup函数
    const component = instance.type;
    // script setup写的函数都在setup内部
    const { setup } = component;
    // 设置正在处理的componeng实例
    setCurrentInstance(instance);
    // 不用script setup，setup中的参数就是来源这里
    // export default {
    //   setup(props,{attr,slots,emit})
    // }
    // 所以setup函数内部就可以通过getCurrrntInstance获取当前组件的实例

    const setupContext = {
      attrs: instance.attrs,
      slots: instance.slots,
      emit: instance.emit, //@todo 还没实现emit
    };
    const setupResult = setup ? setup(instance.props, setupContext) : null;
    setCurrentInstance(null);
    instance.ctx = {
      ...instance.props,
      ...instance.setupState,
    };
    // setup函数返回的数据，需要传递给template使用
    // 如果返回的是函数，就是render函数处理，不需要template了
    if (typeof setupResult === "function") {
      instance.render = setupResult;
    } else {
      instance.setupState = setupResult;
    }
    // 如果没有render并且又template，需要把template处理成render函数
    // render函数的目的就是返回虚拟dom，compiler就是compiler模块需要实现的
    if (!component.render && component.template) {
      let { template } = component;
      if (template[0] === "#") {
        const el = document.querySelector(template);
        template = el ? el.innerHtml : "";
      }
      //component.render = new Function("ctx", compile(template));
    }
  }

  // 设置 setup 函数
  function setupRenderEffect(instance: any, container: RendererElement) {
    const { vnode } = instance;
    const { type: Component } = vnode;

    instance.update = effect(componentEffect, {
      scheduler: () => {
        queueJob(instance.update);
      },
    });

    function componentEffect() {
      // 加载
      if (instance.isMounted) {
        const { vnode, next } = instance;
        if (next) {
          next.el = vnode.el;
          //更新组建的props和slots 等
          instance.props = next.props;
          instance.slots = next.slots;
        }
        const nextTree = (instance.subTree = instance.render(instance.ctx));
        patch(instance.subTree, nextTree, container);
      } else {
        // 还没挂载
        const subTree = (instance.subTree = Component.render(instance.ctx));
        patch(null, subTree, container);
        instance.isMounted = true;
      }
    }
  }

  // 挂载HTML元素
  function mountElement(
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null
  ) {
    const { shapeFlag, props, children, type } = vnode;
    let el = (vnode.el = hostCreateElement(type));
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 子元素是children
      hostCreateText(vnode.el, children);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 是一个数组，比如多个div元素
      mountChildren(vnode.children, el);
    }
    // 新增 props
    if (props) {
      for (const key in props) {
        const nextVal = props[key];
        hostPatchProp(el, key, null, nextVal);
      }
    }
    hostInsert(vnode.el, container, anchor);
  }

  // 挂载children
  function mountChildren(
    children: VNodeArrayChildren,
    container: RendererElement
  ) {
    // 子元素啥类型都有可能 挨个patch
    children.forEach((child) => {
      patch(null, child, container);
    });
  }

  // 卸载/删除vnode
  function unmount(vnode: VNode) {
    const { shapeFlag, el } = vnode;
    if (shapeFlag & ShapeFlags.COMPONENT) {
      unmountComponent(vnode);
    } else {
      // 调用runtime-dom的删除子元素方法 卸载
      hostRemove(el);
    }
  }
  function unmountComponent(vnode: VNode) {
    unmount(vnode.component.subTree);
  }
}
