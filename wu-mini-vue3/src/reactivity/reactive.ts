import { mutableHandlers, shallowReactiveHandlers } from "./baseHandlers";
import { isObject } from "../shared";

export const enum ReactiveFlags {
  IS_REACTIVE = "__v_isReactive",
  RAW = "__v_raw",
}

export interface Target {
  [ReactiveFlags.IS_REACTIVE]?: boolean;
  [ReactiveFlags.RAW]?: any;
}

export const reactiveMap = new WeakMap<Target, any>();
export const shallowReactiveMap = new WeakMap<Target, any>();

export function reactive(target: object) {
  return createReactiveObject(target, reactiveMap, mutableHandlers);
}

export function shallowReactive(target: object) {
  return createReactiveObject(
    target,
    shallowReactiveMap,
    shallowReactiveHandlers
  );
}

export function isReactive(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE]);
}

function createReactiveObject(
  target: Target,
  proxyMap: WeakMap<Target, any>,
  baseHandlers: ProxyHandler<any>
) {
  if (!isObject(target)) {
    console.warn(`reactive  ${target} 必须是一个对象`);
    return target;
  }

  // 通过proxy创建代理，不同的map存储不同类型的reactive依赖关系
  // 针对普通的对象和es6的map set等数据结构，需要使用不同的handlers

  // 缓存找到了，直接返回
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  // 执行代理
  const proxy = new Proxy(target, baseHandlers);

  // 存个缓存
  proxyMap.set(target, proxy);
  return proxy;
}

export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value as object) : value;
