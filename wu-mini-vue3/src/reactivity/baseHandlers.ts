import { track, trigger } from "./effect";
import {
  reactive,
  ReactiveFlags,
  reactiveMap,
  shallowReactiveMap,
  Target,
} from "./reactive";
import { isObject, hasOwn } from "../shared/index";

const get = createGetter();
const set = createSetter();
const shallowReactiveGet = createGetter(true);

function createGetter(shallow = true) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    //是不是已经存在两个map中，实际还会更多 还有readonly啥乱遭的
    const isExitMap = () =>
      key === ReactiveFlags.RAW &&
      (receiver === reactiveMap.get(target) ||
        receiver === shallowReactiveMap.get(target));

    if (key === ReactiveFlags.IS_REACTIVE) {
      return true;
    } else if (isExitMap()) {
      return target;
    }

    const res = Reflect.get(target, key, receiver);
    track(target, "get", key);

    if (isObject(res)) {
      // 值也是对象的话，需要嵌套调用reactive
      // res就是target[key]
      // 浅层代理，不需要嵌套
      return shallow ? res : reactive(res);
    }
    return res;
  };
}

function createSetter() {
  return function set(
    target: Target,
    key: string | symbol,
    value: unknown,
    receiver: object
  ) {
    const result = Reflect.set(target, key, value, receiver);
    // 再触发 set 的时候进行触发依赖
    trigger(target, "set", key);
    return result;
  };
}

function has(target: Target, key: string | symbol) {
  const res = Reflect.has(target, key);
  track(target, "has", key);
  return res;
}

function deleteProperty(target: Target, key: string | symbol) {
  const hadKey = hasOwn(target, key);
  const result = Reflect.deleteProperty(target, key);
  if (result && hadKey) {
    trigger(target, "delete", key);
  }
  return result;
}

export const mutableHandlers = {
  get,
  set,
  has,
  deleteProperty,
};
export const shallowReactiveHandlers = {
  get: shallowReactiveGet,
  set,
  has,
  deleteProperty,
};
