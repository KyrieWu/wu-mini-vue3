export type Data = Record<string, unknown>;

export const enum LifecycleHooks {
  BEFORE_CREATE = "bc",
  CREATED = "c",
  BEFORE_MOUNT = "bm",
  MOUNTED = "m",
  BEFORE_UPDATE = "bu",
  UPDATED = "u",
  BEFORE_UNMOUNT = "bum",
  UNMOUNTED = "um",
  DEACTIVATED = "da",
  ACTIVATED = "a",
  RENDER_TRIGGERED = "rtg",
  RENDER_TRACKED = "rtc",
  ERROR_CAPTURED = "ec",
  SERVER_PREFETCH = "sp",
}

let currentInstance: any = null;

export function getCurrentInstance() {
  return currentInstance;
}
export function setCurrentInstance(instance: any) {
  currentInstance = instance;
}

let compile;
export function registerRuntimeCompiler(_compile: any) {
  compile = _compile;
}
