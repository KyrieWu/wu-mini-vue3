import { track, trigger } from "./effect";
import { toReactive } from "./reactive";
import { isObject } from "../shared";

declare const RefSymbol: unique symbol;

export interface Ref<T = any> {
  value: T;
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  [RefSymbol]: true;
}

export function ref(val: unknown) {
  if (isRef(val)) {
    return val;
  }
  return new RefImpl(val);
}

export function isRef(val: any): val is Ref {
  return !!(val && val.__isRef);
}

class RefImpl<T> {
  private _val: T;
  public readonly __isRef = true;
  constructor(val: T) {
    this._val = isObject(val) ? toReactive(val) : val;
  }
  get value() {
    track(this, "get", "value");
    return this._val;
  }
  set value(val) {
    if (val != this._val) {
      this._val = isObject(val) ? toReactive(val) : val;
      trigger(this, "set", "value");
    }
  }
}
