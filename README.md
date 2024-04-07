# notice

This repository is no longer maintained, there are better ways in reality.

这个仓库不再维护了，有更好的现实方式。

see: https://github.com/kinglisky/comlink-adapters

# rpc-shooter

A tool library for handling window && iframe && worker communication based on the JSON RPC specification

一个基于 [JSON-RPC](https://wiki.geekdream.com/Specification/json-rpc_2.0.html) 规范用于处理 window && iframe && worker 通讯的工具库

## 为什么要写这个工具？

使用 `iframe` 与 `Web Worker` 经常需要写如下代码：

iframe 中的服务调用

```javascript
// parent.js
const childWindow = document.querySelector('iframe').contentWindow;
window.addEventListener('message', function (event) {
    const data = event.data;
    if (data.event === 'do_something') {
        // ... handle iframe data
        childWindow.postMessage({
            event: 're:do_something',
            data: 'some data',
        });
    }
});

// iframe.js
window.top.postMessage(
    {
        event: 'do_something',
        data: 'ifame data',
    },
    '*'
);
window.addEventListener('message', function (event) {
    const data = event.data;
    if (data.event === 're:do_something') {
        // ... handle parent data
    }
});
```

worker 服务调用

```javascript
// parent.js
const worker = new Worker('worker.js');
worker.addEventListener('message', function (event) {
    const data = event.data;
    if (data.event === 'do_something') {
        // ... handle worker data
        worker.postMessage({
            event: 're:do_something',
            data: 'some data',
        });
    }
});

// worker.js
self.postMessage({
    event: 'do_something',
    data: 'worker data',
});
self.addEventListener('message', function (event) {
    const data = event.data;
    if (data.event === 're:do_something') {
        // ... handle parent data
    }
});
```

上述的方式可以处理简单的事件通信，但针对复杂场景下跨页面（进程）通信需要一个简单的有效的处理方式，如果可以封装成异步函数调用方式，则会优雅很多，如下：

```javascript
// parent.js
const parentRPC = new RPC({...});
parentRPC.registerMethod('parent.do_something', (data) => {
    return Promise.resolve({...});
});
parentRPC.invoke('child.do_something', { data: 'xxx' })
    .then(res => {
        console.error(res);
    })
    .catch(error => {
        console.error(error);
    });

// child.js
const childRPC = new RPC({...});
childRPC.registerMethod('child.do_something', (data) => {
    return Promise.resolve({...});
});
childRPC.invoke('parent.do_something', { data: 'xxx' })
    .then(res => {
        console.error(res);
    })
    .catch(error => {
        console.error(error);
    });
```

使用 [JSON-RPC 2.0](https://wiki.geekdream.com/Specification/json-rpc_2.0.html) 规范可以很清晰简单的描述两个服务间的调用，`rpc-shooter` 中使用 `JSON-RPC` 作为数据交互格式。

## 安装

```bash
yarn add rpc-shooter
# or
npm i rpc-shooter -S
```

## 使用

使用 `RPCMessageEvent` 模块可以涵盖下列模块的消息通信：

-   [Window](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/postMessage)
-   [Worker](https://developer.mozilla.org/zh-CN/docs/Web/API/Worker/postMessage)
-   [SharedWorker](https://developer.mozilla.org/zh-CN/docs/Web/API/SharedWorker)
-   [ServiceWorker](https://developer.mozilla.org/zh-CN/docs/Web/API/ServiceWorker)
-   [MessageChannel](https://developer.mozilla.org/zh-CN/docs/Web/API/MessageChannel)
-   [BroadcastChannel](https://developer.mozilla.org/zh-CN/docs/Web/API/BroadcastChannel)
-   [MessagePort](https://developer.mozilla.org/zh-CN/docs/Web/API/MessagePort)

如果有更复杂的事件交互场景，实现自己的 `event` 模块即可。

### iframe

```ts
// main.ts
import { RPCMessageEvent, RPC } from 'rpc-shooter';

(async function () {
    const iframe = document.querySelector('iframe')!;
    const rpc = new RPC({
        event: new RPCMessageEvent({
            currentEndpoint: window,
            targetEndpoint: iframe.contentWindow!,
            config: { targetOrigin: '*' },
        }),
        // 初始化时注册处理函数
        methods: {
            'Main.max': (a: number, b: number) => Math.max(a, b),
        },
    });
    // 动态注册处理函数
    rpc.registerMethod('Main.min', (a: number, b: number) => {
        return Promise.resolve(Math.min(a, b));
    });

    // 检查链接，配置超时时间
    await rpc.connect(2000);

    // 调用 iframe 服务中的注册方法
    const randomValue = await rpc.invoke('Child.random', null, { isNotify: false, timeout: 2000 });
    console.log(`Main invoke Child.random result: ${randomValue}`);
})();
```

```ts
// child.ts
import { RPCMessageEvent, RPC } from 'rpc-shooter';
(async function () {
    const rpc = new RPC({
        event: new RPCMessageEvent({
            currentEndpoint: window,
            targetEndpoint: window.top,
        }),
    });

    rpc.registerMethod('Child.random', () => Math.random());

    await rpc.connect(2000);

    const max = await rpc.invoke('Main.max', [1, 2]);
    const min = await rpc.invoke('Main.min', [1, 2]);
    console.log({ max, min });
})();
```

### window

```ts
// main.ts
import { RPCMessageEvent, RPC } from 'rpc-shooter';
(async function () {
    const openNewWindow = (path: string) => {
        return window.open(path, '_blank');
    };
    const newWindow = openNewWindow('new-window.html');
    const rpc = new RPC({
        event: new RPCMessageEvent({
            currentEndpoint: window,
            targetEndpoint: newWindow,
            config: { targetOrigin: '*' },
        }),
    });
    rpc.registerMethod('Main.max', (a: number, b: number) => {
        return Promise.resolve(Math.max(a, b));
    });
    await rpc.connect(2000);
    await rpc.invoke('Child.random', null);
})();
```

```ts
// child.ts
import { RPCMessageEvent, RPC } from 'rpc-shooter';
(async function () {
    const rpc = new RPC({
        event: new RPCMessageEvent({
            currentEndpoint: window,
            targetEndpoint: window.opener,
        }),
    });
    rpc.registerMethod('Child.random', () => Math.random());

    await rpc.connect(2000);

    await rpc.invoke('Main.max', [1, 2]);
})();
```

### Web Worker

```ts
// main.ts
import { RPCMessageEvent, RPC } from 'rpc-shooter';

(async function () {
    const worker = new Worker('./slef.worker.ts');
    const rpc = new RPC({
        event: new RPCMessageEvent({
            currentEndpoint: worker,
            targetEndpoint: worker,
        }),
    });
    rpc.registerMethod('Main.max', (a: number, b: number) => {
        return Promise.resolve(Math.max(a, b));
    });
    await rpc.connect(2000);
    await rpc.invoke('Child.random', null);
})();
```

```ts
// child.ts
import { RPCMessageEvent, RPC } from 'rpc-shooter';

(async function () {
    const ctx: Worker = self as any;
    const rpc = new RPC({
        event: new RPCMessageEvent({
            currentEndpoint: ctx,
            targetEndpoint: ctx,
        }),
    });
    rpc.registerMethod('Child.random', () => Math.random());

    await rpc.connect(2000);

    await rpc.invoke('Main.max', [1, 2]);
})();
```

### Shared Worker

```ts
// main.ts
import { RPCMessageEvent, RPC } from 'rpc-shooter';

(async function () {
    const worker: SharedWorker = new SharedWorker('./shared.worker.ts');
    worker.port.start();
    const rpc = new RPC({
        event: new RPCMessageEvent({
            currentEndpoint: worker.port,
            targetEndpoint: worker.port,
        }),
    });
    rpc.registerMethod('Main.max', (a: number, b: number) => {
        return Promise.resolve(Math.max(a, b));
    });
    await rpc.connect(2000);
    await rpc.invoke('Child.random', null);
})();
```

```ts
// child.ts
import { RPCMessageEvent, RPC } from 'rpc-shooter';

interface SharedWorkerGlobalScope {
    onconnect: (event: MessageEvent) => void;
}

const ctx: SharedWorkerGlobalScope = self as any;

ctx.onconnect = async (event: MessageEvent) => {
    const port = event.ports[0];
    port.start();
    const rpc = new RPC({
        event: new RPCMessageEvent({
            currentEndpoint: port,
            targetEndpoint: port,
        }),
    });
    rpc.registerMethod('Child.random', () => Math.random());

    await rpc.connect(2000);

    await rpc.invoke('Main.max', [1, 2]);
};
```

## 配置项

`rpc-shooter` 由核心两个模块组成：

-   RPCMessageEvent 用于两个通信上下文（window | iframe | worker）的事件交互
-   RPC 对 `RPCMessageEvent` 事件交互进行封装，提供方法注册与调用

### RPC

```ts
const RPCInitOptions = {
    timeout: 200,
    event: new RPCMessageEvent({
        currentEndpoint: window,
        targetEndpoint: iframe.contentWindow!,
        config: { targetOrigin: '*' },
    }),
    // 初始化时注册处理函数
    methods: {
        'Main.max': (a: number, b: number) => Math.max(a, b),
        'Main.abs': (a: number) => Math.abs(a),
    },
};
const rpc = new RPC(RPCInitOptions);
// 动态注册处理函数
rpc.registerMethod('Main.min', (a: number, b: number) => {
    return Promise.resolve(Math.min(a, b));
});
// 移除注册函数
rpc.removeMethod('Main.abs');
// 检查链接，配置超时时间
await rpc.connect(2000);
// 调用 iframe 服务中的注册方法
const value = await rpc.invoke('Child.random', null, { isNotify: false, timeout: 2000 });
```

#### RPC Options

```ts
interface RPCEvent {
    emit(event: string, ...args: any[]): void;
    on(event: string, fn: RPCHandler): void;
    off(event: string, fn?: RPCHandler): void;
    onerror: null | ((error: RPCError) => void);
    destroy?: () => void;
}

interface RPCHandler {
    (...args: any[]): any;
}

interface RPCInitOptions {
    event: RPCEvent;
    methods?: Record<string, RPCHandler>;
    timeout?: number;
}
```

| 参数    | 类型                              | 说明                                                                              |
| :------ | :-------------------------------- | :-------------------------------------------------------------------------------- |
| event   | 必填 `RPCEvent`                   | 用于服务间通信的事件模块，可参考 `RPCMessageEvent` 实现，满足 `RPCEvent` 接口即可 |
| methods | 可选 `Record<string, RPCHandler>` | 用于注册当前服务可调用的方法                                                      |
| timeout | 可选 `number`                     | 方法调用的全局超时时间，为 0 则不设置超时时间                                     |

#### RPC Methods

**connect**

```ts
connect(timeout?: number): Promise<void>;
```

timeout 超时设置，会覆盖全局设置

**registerMethod**

```ts
registerMethod(method: string, handler: RPCHandler);
```

注册调用方法

**removeMethod**

```ts
removeMethod(method: string);
```

移除调用方法

**invoke**

```ts
invoke(
    method: string,
    ...args: any[] | [...any[], RPCInvokeOptions]
): Promise<any>;
```

```ts
rpc1.registerMethod('add', (a: number, b: number, c: number) => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(a + b + c), 400);
    });
});
// 可以通过 invokeOptions 配置调用超时
const res1 = await rpc2.invoke('add', 1, 2, 3);
const res2 = await rpc2.invoke('add', 4, 5, 6, { isNotify: true });
const res3 = await rpc2.invoke('add', 7, 8, 9, { timeout: 1000 });
const res4 = await rpc2.invoke('add', 10, 11, 12, { timeout: 4 }).catch((error) => error);
```

调用远程服务

-   method `string` 方法名
-   args `any` 参数
-   invokeOptions.timeout `number` timeout 超时设置，会覆盖全局设置
-   invokeOptions.isNotify `boolean` 是否是个一个通知消息

可以函数调用参数末尾配置 invokeOptions 选项，如果 invoke 配置了 isNotify，则作为一个通知消息，方法调用后会立即返回，不理会目标服务是否相应，目标也不会响应回复此消息。内部使用 JSON-PRC 的 id 进行标识。

> 没有包含“id”成员的请求对象为通知， 作为通知的请求对象表明客户端对相应的响应对象并不感兴趣，本身也没有响应对象需要返回给客户端。服务端必须不回复一个通知，包含那些批量请求中的。
> 由于通知没有返回的响应对象，所以通知不确定是否被定义。同样，客户端不会意识到任何错误（例如参数缺省，内部错误）。

### RPCMessageEvent

RPCMessageEvent 实现一套与 [socket.io](https://socket.io/) 类似的事件接口，用于处理 window iframe worker 场景下消息通信：

```ts
interface RPCHandler {
    (...args: any[]): any;
}

interface RPCEvent {
    emit(event: string, ...args: any[]): void;
    on(event: string, fn: RPCHandler): void;
    off(event: string, fn?: RPCHandler): void;
    onerror: null | ((error: RPCError) => void);
    destroy?: () => void;
}
```

使用：

```ts
// main.ts
import { RPCMessageEvent } from 'rpc-shooter';
const mainEvent = new RPCMessageEvent({
    currentEndpoint: window,
    targetEndpoint: iframe.contentWindow,
    config: {
        targetOrigin: '*',
    },
    receiveAdapter(event) {
        return event.data;
    },
    receiveAdapter(data) {
        return data;
    },
});

mainEvent.on('Main.test', (data) => {});
mainEvent.emit('Child.test', (data) => {});
// mainEvent.off('Main.someMethod');
// mainEvent.destroy();
```

```ts
// child.ts
import { RPCMessageEvent } from 'rpc-shooter';
const childEvent = new RPCMessageEvent({
    currentEndpoint: window,
    targetEndpoint: window.top,
    config: {
        targetOrigin: '*',
    },
    receiveAdapter(event) {
        return event.data;
    },
    receiveAdapter(data) {
        return data;
    },
});

childEvent.emit('Main.test', (data) => {});
```

#### RPCMessageEvent Options

RPCMessageEvent 初始化选项定义如下：

```ts
interface RPCMessageDataFormat {
    event: string;
    args: any[];
}

interface RPCPostMessageConfig {
    targetOrigin?: string;
    transfer?: Transferable[];
}

interface RPCMessageEventOptions {
    currentEndpoint: RPCMessageReceiveEndpoint;
    targetEndpoint: RPCMessageSendEndpoint;
    config?:
        | ((data: any, context: RPCMessageSendEndpoint) => RPCPostMessageConfig)
        | RPCPostMessageConfig;
    sendAdapter?: (
        data: RPCMessageDataFormat | any,
        context: RPCMessageSendEndpoint
    ) => {
        data: RPCMessageDataFormat;
        transfer?: Transferable[];
    };
    receiveAdapter?: (event: MessageEvent) => RPCMessageDataFormat;
}
```

| 参数            | 类型                                                                                                   | 说明                                                                    |
| :-------------- | :----------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| currentEndpoint | 必填 `Window`、`Worker`、`MessagePort` 等满足 [RPCMessageReceiveEndpoint](./src/index.ts#L68) 接口对象 | 当前通信对象的上下文，可以是 `Window`、`Worker` 或者 `MessagePort` 对象 |
| targetEndpoint  | 必填 `Window`、`Worker`、`MessagePort` 等满足 [RPCMessageSendEndpoint](./src/index.ts#L68) 接口对象    | 目标通信对象的上下文，可以是 `Window`、`Worker` 或者 `MessagePort` 对象 |
| config          | 可选 `RPCPostMessageConfig` or `Function`                                                              | 用于给 targetEndpoint.postMessage 方法配置参数                          |
| sendAdapter     | 可选 `Function`                                                                                        | 消息发动前数据处理函数                                                  |
| receiveAdapter  | 可选 `Function`                                                                                        | 消息接受前数据处理函数                                                  |

**config**

```ts
interface WindowPostMessageOptions {
    transfer?: Transferable[];
    targetOrigin?: string;
}

interface RPCPostMessageConfig extends WindowPostMessageOptions {
}

type config?:
        | ((data: any, context: RPCMessageSendEndpoint) => RPCPostMessageConfig)
        | RPCPostMessageConfig;
```

用于给 targetEndpoint 的 `postMessage` 方法配置参数，可以直接配置一个对象，也可以通过函数动态返回一个配置。

-   给 `window.postMessage` 配置 `targetOrigin` -> `{ targetOrigin: '*' }`
-   给 `worker.postMessage` 配置 `transfer` -> `{ transfer: [...] }`
-   给 `figma.ui.postMessage` 配置 `origin` -> `{ origin: '*' }`

```ts
new RPCMessageEvent({
    currentEndpoint: worker,
    targetEndpoint: worker,
    config: {
        targetOrigin: '*',
    },
});
// window.postMessage(data, targetOrigin, [transfer]);
```

**sendAdapter**

```ts
type sendAdapter = (
    data: RPCMessageDataFormat | any,
    context: RPCMessageSendEndpoint
) => {
    data: RPCMessageDataFormat;
    transfer?: Transferable[];
};
```

发送数据前的适配函数，在一些特殊环境下可以对发送的数据做一些处理：

-   可以为发送的数据附加 [transfer](https://developer.mozilla.org/zh-CN/docs/Web/API/Transferable) 优化数据传输
-   一些应用插件场景对交互数据格式有一定要求则可以使用此适配器进行包装

```ts
new RPCMessageEvent({
    currentEndpoint: worker,
    targetEndpoint: worker,
    sendAdapter(data) {
        const transfer = [];
        // 将 ImageBitmap 添加至 transfer 优化数据传输
        JSON.stringify(data, (_, value) => {
            if (value?.constructor.name === 'ImageBitmap') {
                transfer.push(value);
            }
            return value;
        });
        return { data, transfer };
    },
});
```

**receiveAdapter**

```ts
type receiveAdapter = (event: MessageEvent) => RPCMessageDataFormat;
```

数据接收前的处理函数，**一般情况不需要配置**，在一些特殊场景下：

-   检查数据 `origin` 来源过滤掉不安全消息请求
-   过滤掉本地开发场景下一些 dev server 抛出消息事件
-   一些应用插件场景对交互数据格式有一定要求则可以使用此适配器进行包装

```ts
new RPCMessageEvent({
    currentEndpoint: window,
    targetEndpoint: window.parent,
    receiveAdapter(event) {
        if (event.origin === 'xxx') {
            return event.data;
        }
        return null;
    },
});
```

如 figma 插件中 iframe 与主应用通信需要使用 `pluginMessage` 字段包裹。

```ts
// figma plugin ifame
new RPCMessageEvent({
    currentEndpoint: window,
    targetEndpoint: window.parent,
    receiveAdapter(event) {
        return event.data.pluginMessage;
    },
    sendAdapter(data) {
        return { pluginMessage: data };
    },
});
```

#### RPCMessageEvent Methods

```ts
interface RPCHandler {
    (...args: any[]): any;
}

interface RPCEvent {
    emit(event: string, ...args: any[]): void;
    on(event: string, fn: RPCHandler): void;
    off(event: string, fn?: RPCHandler): void;
    onerror: null | ((error: RPCError) => void);
    destroy?: () => void;
}
```

参考 [socket.io](https://socket.io/) API 不做赘述

| 方法    | 说明                                    |
| :------ | :-------------------------------------- |
| on      | 设置本地服务事件监听                    |
| emit    | 触发远程服务事件                        |
| off     | 移除本地服务事件监听                    |
| onerror | 发生错误时触发 onerror 回调             |
| destroy | 释放 RPCMessageEvent 资源与内部事件监听 |

#### RPCMessageEvent Event

**onerror**

```ts
type onerror = null | ((error: RPCError) => void);
```

事件模块内部发生错误时的回调函数。

```ts
const event = new RPCMessageEvent({...});
event.onerror = (error) => {
    console.log(error);
};
```

## 开发

```bash
# 依赖
yarn
# 开发
yarn dev
# 构建
yarn build
```

# TODO

-   [ ] 添加测试用例
-   [ ] onmessage 需要检查消息来源
-   [ ] proxy 化
-   [ ] 协程支持
