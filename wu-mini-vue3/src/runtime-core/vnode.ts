import { ShapeFlags } from "../shared";
import { Data } from "./component";
import { RendererNode } from "./renderer";

export type VNodeProps = {
  key?: string | number | symbol;
};

type VNodeChildAtom =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | void;

export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>;

export interface VNode<HostNode = RendererNode> {
  type: any;
  key: string | number | symbol | null;
  props: VNodeProps | null;
  shapeFlag: number;
  component: any;
  el: HostNode | null;
  children: null;
}

export function createVNode(
  type: any,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null
) {
  // teleport ，fragment 都先忽略
  // 一个虚拟 dom 主要的三个类型，element。text和component
  let shapeFlag =
    typeof type == "string"
      ? ShapeFlags.ELEMENT
      : type == Text
      ? ShapeFlags.TEXT
      : typeof type == "function" || typeof type.render == "function"
      ? ShapeFlags.COMPONENT
      : 0;

  if (typeof children === "string") {
    shapeFlag != ShapeFlags.TEXT_CHILDREN;
  } else if (Array.isArray(children)) {
    shapeFlag != ShapeFlags.ARRAY_CHILDREN;
  }

  const vnode = {
    type,
    shapeFlag,
    props: props || {},
    children,
    key: props?.key,
    el: null,
    component: null, // 组件的实例
    appContext: null,
  };
  return vnode;
}

export const h = (
  type: any,
  props: (Data & VNodeProps) | null = null,
  children = null
) => {
  // 实际的 h 会对 createVNode 做对象、数组的情况的支持，支持等多类型的参数
  // mini 的就直接调用了
  return createVNode(type, props, children);
};
export const Text = Symbol("VueText");

export function createTextVNode(text: string = "", flag: number = 0) {
  return createVNode(Text, null, text);
}

export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key;
}
