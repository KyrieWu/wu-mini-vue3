import { createAppAPI } from "./apiCreateApp";
import { setCurrentInstance } from "./component";
import { queueJob } from "./scheduler";
import { isSameVNodeType, VNode } from "./vnode";
import { effect } from "../reactivity";
import { ShapeFlags } from "../shared";

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
}
