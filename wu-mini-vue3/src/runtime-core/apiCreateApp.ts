import { createVNode } from "./vnode";

let uid = 0;
export function createAppAPI(render: any) {
  return function createApp(rootComponent: any) {
    // 上下文对象
    const context = {
      provides: {},
      components: {},
      directives: {},
      plugins: new Set(),
    };

    const app = {
      _uid: uid++,
      _context: context,
      _component: rootComponent,
      mount(rootContainer: any) {
        const vnode = createVNode(rootComponent);
        vnode.appContext = context; // 全局context
        render(vnode, rootComponent);
      },
      // app use
      use(plugin: any, options: any) {
        if (!context.plugins.has(plugin)) {
          context.plugins.add(plugin);
          // 执行循环的install方法，
          plugin.install(app, ...options);
        }
      },
      // app provide
      provide(key: string, val: any) {
        context.provides[key as string | symbol] = val;
      },
      component(name: string, component) {
        context.components[name] = component;
      },
    };
    return app;
  };
}
