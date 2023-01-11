import { track, trigger, effect } from "./effect";

export type ComputedGetter<T> = (...args: any[]) => T;
export type ComputedSetter<T> = (v: T) => void;

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>;
  set: ComputedSetter<T>;
}

export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  let getter, setter;
  if (typeof getterOrOptions === "function") {
    getter = getterOrOptions;
    setter = () => {
      console.warn("计算属性不能修改");
    };
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  return new ComputedRefImpl(getter, setter);
}

class ComputedRefImpl<T> {
  private _val: any;
  public _dirty = true;
  public readonly effect;
  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>
  ) {
    this._setter = _setter;
    this._val = undefined;
    this.effect = effect(getter, {
      lazy: true,
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true;
          trigger(this, "set", "value");
        }
      },
    });
  }
  get value() {
    track(this, "get", "value");
    if (this._dirty) {
      this._dirty = false;
      this._val = this.effect();
    }
    return this._val;
  }
  set value(val) {
    this._setter(val);
  }
}
