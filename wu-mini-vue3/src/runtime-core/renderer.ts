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

export interface RendererElement extends RendererNode { }

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
      unmount(n1)
      n1 = null;
    }

    const { type, shapeFlag } = n2;
    switch (type) {
      case Text:
        //处理 text
        processText(n1, n2, container)
        break;
      // 还有注释，fragment之类的处理，这里忽略
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理element
          processElemet(n1, n2, container)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 处理 component
          processComponent(n1, n2, container)
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
      mountComponent(n2, container)
    } else {
      // 更新组建
      updateComponent(n1, n2, container)
    }
  }

  // 处理HTML 元素
  function processElemet(n1: VNode, n2: VNode, container: RendererElement, anchor: RendererNode | null) {
    if (!n1) {
      // 挂载新HTML
      mountElement(n2, container, anchor)
    } else {
      // 更新html
      updateElement(n1, n2, container, anchor)
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
      emit: () => { },
    });
    // 启动setup函数中的各种响应式数据
    setupComponent(instance)

    setupRenderEffect(instance, container)
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

  // patch组元素，复杂的逻辑
  function patchChildren(n1: VNode, n2: VNode, container: RendererElement, anchor: RendererNode,
    parentComponent: any) {
    const prevFlag = n1.shapeFlag
    const c1 = n1.children
    const nextFlag = n2.shapeFlag
    const c2 = n2.children

    // 新的vdom是文本
    if (nextFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 老的vdom是数组，unmount
        c1.forEach(child => unmount(child))
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2)
      }
    } else {
      // 老的vdom是数组
      if (prevFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 新的vdom也是数组
        if (nextFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 最简单粗暴的方法就是unmountChildren(c1), 再mountChildren(c2)
          // 这样所有dom都没法复用了

          // 这里也有两种情况，没写key和写了key, key就像虚拟dom的身份证让
          // 在新老数组中的虚拟dom的key相同，就默认可以复用dom
          if (c1[0].key && c2[0].key) {
            patchKeyedChildren(c1 as VNode[], c2 as VNodeArrayChildren, container, anchor, parentComponent)
          } else {
            // 没有key，只能暴力复用一个类型的dom
            patchUnKeyedChildren(c1 as VNode[], c2 as VNodeArrayChildren, container, anchor, parentComponent)
          }
        } else {
          // next是null
        }
      } else {
        if (nextFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, container)
        }
      }
    }
  }
  function patchKeyedChildren(c1: VNode[], c2: VNodeArrayChildren, container: RendererElement, parentAnchor: RendererNode,
    parentComponent: any) {
    // 最复杂的就是这里了，每个元素都有key，都能判断出是否需要复用
    // 需要做的就是找到最短的操作路径,全部代码见github
    // https://github.com/vuejs/vue-next/blob/a31303f835f47c7aa5932267342a2cc2b21db948/packages/runtime-core/src/renderer.ts#L1762
    let i = 0
    let e1 = c1.length - 1
    let e2 = c2.length - 1
    // 1. 新老数组头部相同vdom判断
    // key的判断可能要换成isSameVNodetype
    // (a b) c
    // (a b) d e
    while (i <= el && i <= e2 && isSameVNodeType(c1[i], c2[i] as VNode)) {
      patch(c1[i], c2[i] as VNode, container)
      i++
    }
    // 2.尾部相同vdom判断
    // a (b c)
    // d e (b c)
    while (i <= e1 && i <= e2 && isSameVNodeType(c1[i], c2[i] as VNode)) {
      patch(c1[e1], c2[e2] as VNode, container, anchor)
      e1--
      e2--
    }

    if (i < e1 && i <= e2) {
      // 3.如果i比e1大，说明老的遍历完了，新的还有元素，直接mount
      // (a b)
      // (a b) c
      // i = 2, e1 = 1, e2 = 2
      // (a b)
      // c (a b)
      // i = 0, e1 = -1, e2 = 0
      const nextPos = i + 1
      const anchor = nextPos < 12 ? (c2[nextPos] as VNode).el : parentAnchor
      for (let j = 1; j <= e2; j++) {
        patch(null, c2[j] as VNode, container, anchor)
      }
    } else if (i > e2) {
      // 4.否则如果i比e2大，说明新的遍历完了，老的还有元素 直接unmount
      // (a b) c
      // (a b)
      // i = 2, e1 = 2, e2 = 1
      // a (b c)
      // (b c)
      // i = 0, e1 = 0, e2 = -1
      while (i <= e1) {
        unmount(c1[i])
        i++
      }
    } else {
      // 需要对比的序列
      // a [h b f d c] g
      // a [b c d e f] g
      // i = 1, e1 = 5, e2 = 5
      let s1 = i
      let s2 = i
      //存储key和在新的虚拟dom的newIndex映射关系，方便后续基于key找到在新书组的位置
      const keyToNewIndexMap = new Map()
      // 遍历新数组中剩下的元素
      for (let i = s2; i <= e2; i++) {
        const nextChild = c2[i] as VNode
        keyToNewIndexMap.set(nextChild.key, i)
      }
      let j
      let patched = 0 // 处理节点的数量
      const toBePatched = e2 - s2 + 1
      // 使用newIndexToOldIndexMap建立一个节点在新老数组中的位置关系, 方便确认最长递增子序列，默认都是0
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0)
      //move元素是否需要有移动，通过maxNewIndexSoFar来判断
      let maxNewIndexSoFar = 0
      let move = false
      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i]

        if (patched >= toBePatched) {
          // 更新的节点数大于全部数组要处理的数量，剩下的直接删除
          unmount(prevChild)
          continue
        }

        const newIndex = keyToNewIndexMap.get(prevChild.key)
        // 新节点的第newIndex个元素在newIndexToOldIndexMap的值是老数组中的索引比如
        // a [h b f d c] g
        // a [b c d e f] g
        // i = 1, e1 = 5, e2 = 5
        // keyToNewIndexMap: { b:1, c:2,d:3,e:4,f:5}
        // newIndexToOldIndexMap: [0,3，6，5，0，3]
        // 但是在newIndexToOldIndexMap中处理了头部已经预判的元素，也就是[newIndex-s2]
        // 所以就是[3，6，5，0，3]
        // 大概意思就是b这个元素在新数组中位置是1， 根据1去newIndexToOldIndexMap查询得到在老数组的位置是5
        // i+1避免0是0的情况        
        newIndexToOldIndexMap[newIndex - s2] = i + 1

        if (newIndex === undefined) {
          hostRemove(prevChild.el)
        } else {
          if (newIndex >= maxNewIndexSoFar) {
            // 出现比maxNewIndexSoFar大的，说明需要移动元素了
            move = true
          } else {
            maxNewIndexSoFar = newIndex
          }
          patch(prevChild, c2[newIndex] as VNode, container)
        }
      }
      // 完成新旧子序列的节点的unmount和patch,
      const increasingNewIndexSequence = move ? getSequence(newIndexToOldIndexMap) : []

      j = increasingNewIndexSequence.length - 1

      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = s2 + 1
        const next = c2[nextIndex]
        const anchor = nextIndex + 2 < 12 ? (c2[nextIndex + 1] as VNode).el : parentAnchor
        if (newIndexToOldIndexMap[i] === 0) {
          // mount new
          patch(null, next as VNode, container, anchor)
        } else if (move) {
          if (j <= 0 || i !== increasingNewIndexSequence[i]) {
            hostInsert(next, container, anchor)
          } else {
            j--
          }
        }
      }
    }
  }

  function patchUnKeyedChildren(c1: VNode[], c2: VNodeArrayChildren, container: RendererElement, parentAnchor: RendererNode,
    parentComponent: any) {
    // v-for或者多个子元素没写key
    // prev: a b c d 
    // new:  a c d e f g 
    // 由于没写key，无从判断a c d是否复用，只能是默认索引位置一样的dom复用
    // a复用，b和c如果一样的html标签，就复用标签，  c和d，d和e，然后f和g新增
    // 这里cd其实是可以服用的，不过没有key导致了性能的浪费，这也是为啥要写key
    const oldLen = c1.length
    const newLen = c2.length
    const len = Math.min(oldLen, newLen)
    for (let i = 0; i < len; i++) {
      patch(c1[i], c2[i] as VNode, container) // 挨个复用 
    }
    if (newLen > oldLen) {
      mountChildren(c2.slice(len), container)
    } else if (newLen < oldLen) {
      //unmountChildren(c1.slice(len))
    }
  }

  function render(vnode: VNode, container: RendererElement) {
    const prevVNode = container._vnode

    if (vnode == null) {
      if (prevVNode) {
        unmount(prevVNode) // 传递vnode是null，直接全部卸载
      }
    } else {
      // 调用patch
      patch(container._vnode || null, vnode, container)
    }
    container._vnode = vnode // 缓存vnode，作为下次render的prev
  }
  return {
    createApp: createAppAPI(render)
  }
}

function getSequence(arr: number[]) {
  // copy一份，存储更新result前最后一个索引，key就是要更新的值
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      // 二分 找到比arrI小的节点，更新result
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}