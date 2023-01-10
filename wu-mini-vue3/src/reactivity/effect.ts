let activeEffect: any = null;
const targetMap = new WeakMap();

export type EffectScheduler = (...args: any[]) => any;

export interface ReactiveEffectOptions {
  lazy?: boolean;
  scheduler?: EffectScheduler;
}

export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions) {
  // effect 嵌套，通过队列管理
  const effectfn = () => {
    try {
      activeEffect = effectfn;
      // fn执行的时候，内部读取响应式数据的时候，就能在get配置里读取到 activeEffect
      return fn();
    } finally {
      activeEffect = null;
    }
  };
  if (!options || !options.lazy) {
    // 如果没有lazy 直接执行
    effectfn();
  }
  effectfn.scheduler = options ? options.scheduler : null; // 调度时机 watchEffect 会用到
  return effectfn;
}

export function track(target: object, type: string, key: unknown) {
  // 1.先基于 target 找到对应的dep
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    deps = new Set();
  }
  if (!deps.has(activeEffect) && activeEffect) {
    deps.add(activeEffect);
  }
  depsMap.set(key, deps);
}

export function trigger(target: object, type: string, key: unknown) {
  // 从targetMap 中找到触发的函数，执行他
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const deps = depsMap.get(key);
  if (!deps) {
    return;
  }
  deps.forEach((effectFn: any) => {
    if (effectFn.scheduler) {
      effectFn.scheduler();
    } else {
      effectFn();
    }
  });
}
