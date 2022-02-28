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

使用 `RPCMessageEvent` 模块可以实现 `Window`、`Iframe`、`Worker` 或者 `Shared Worker` 间的事件交互，如果有更复杂的事件交互场景，实现自己的 `event` 模块即可。

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
    },
};
const rpc = new RPC(RPCInitOptions);
// 动态注册处理函数
rpc.registerMethod('Main.min', (a: number, b: number) => {
    return Promise.resolve(Math.min(a, b));
});
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
| methods | 可选 `Record<string, RPCHandler>` | 由于注册当前服务可调用的方法                                                      |
| timeout | 可选 `number`                     | 方法调用的全局超时时间，为 0 则不设置超时时间                                     |

#### RPC Methods

| 方法           | 说明             |
| :------------- | :--------------- |
| connect        | 用于检测链接状态 |
| registerMethod | 动态注册调用方法 |
| invoke         | 调用远程服务     |

**connect**

```ts
connect(timeout?: number): Promise<void>;
```

timeout 超时设置，会覆盖全局设置

**registerMethod**

```ts
registerMethod(method: string, handler: RPCHandler);
```

动态注册调用方法

**invoke**

```ts
invoke(
    method: string,
    params: any,
    options: RPCInvokeOptions = { isNotify: false, timeout: 0 }
): Promise<any>;
```

调用远程服务

-   method `string` 方法名
-   params `any` 参数
-   invokeOptions.timeout `number` timeout 超时设置，会覆盖全局设置
-   invokeOptions.isNotify `boolean` 是否是个一个通知消息

如果 invoke 配置了 isNotify，则作为一个通知消息，方法调用后会立即返回，不理会目标服务是否相应，目标也不会响应回复此消息。内部使用 JSON-PRC 的 id 进行标识。

> 没有包含“id”成员的请求对象为通知， 作为通知的请求对象表明客户端对相应的响应对象并不感兴趣，本身也没有响应对象需要返回给客户端。服务端必须不回复一个通知，包含那些批量请求中的。
> 由于通知没有返回的响应对象，所以通知不确定是否被定义。同样，客户端不会意识到任何错误（例如参数缺省，内部错误）。

### RPCMessageEvent

RPCMessageEvent 实现一套通用的事件接口，用于处理 window iframe worker 场景下消息通信：

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
    beforeReceive(event) {
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
    beforeReceive(event) {
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
    targetOrigin?: unknown;
}

interface RPCMessageEventOptions {
    currentEndpoint: Window | Worker | MessagePort;
    targetEndpoint: Window | Worker | MessagePort;
    config?:
        | ((data: any, context: Window | Worker | MessagePort) => RPCPostMessageConfig)
        | RPCPostMessageConfig;
    receiveAdapter?: (data: RPCMessageDataFormat) => any;
    beforeReceive?: (event: MessageEvent) => RPCMessageDataFormat;
}
```

| 参数            | 类型                                      | 说明                                                                   |
| :-------------- | :---------------------------------------- | :--------------------------------------------------------------------- |
| currentEndpoint | 必填 `Widow`、`Worker`、`MessagePort`     | 当前通信对象的上下文，可以是 `Widow`、`Worker` 或者 `MessagePort` 对象 |
| targetEndpoint  | 必填 `Widow`、`Worker`、`MessagePort`     | 目标通信对象的上下文，可以是 `Widow`、`Worker` 或者 `MessagePort` 对象 |
| config          | 可选 `RPCPostMessageConfig` or `Function` | 用于给 targetEndpoint.postMessage 方法配置参数                         |
| receiveAdapter  | 可选 `Function`                           | 消息发动前数据处理函数                                                 |
| beforeReceive   | 可选 `Function`                           | 消息接受前数据处理函数                                                 |

**config** 用于给 targetEndpoint 的 `postMessage` 方法配置参数，可以直接配置一个对象，也可以通过函数动态返回一个配置：

```ts
worker.postMessage(data, [transfer]);
window.postMessage(data, targetOrigin, [transfer]);
```

-   `data` 如果其值不为空，则发送数据时优先使用 data，一般不需要配置此项
-   `targetOrigin` 给 window.postMessage 配置 targetOrigin
-   `transferList` 配置 postMessage 的 [transfer] 项

```ts
new RPCMessageEvent({
    currentEndpoint: worker,
    targetEndpoint: worker,
    // 可使用 config 配置 transferList，优化 worker 数据交换
    config(data) {
        const rpcData = data.args[0];
        if (rpcData?.params?.constructor.name === 'ImageBitmap') {
            return { data, transferList: [rpcData.params] };
        }
        return { data };
    },
});
```

**receiveAdapter** 与 **beforeReceive** 用于数据发送与接受前处理，**一般情况不需要配置**，在一些特殊场景下，如一些应用插件开发场景对交互数据格式有一定要求则可以使用此方法：

如 figma 插件中 iframe 与主应用通信需要使用 `pluginMessage` 字段包裹。

```ts
// figma plugin ifame
new RPCMessageEvent({
    currentEndpoint: window,
    targetEndpoint: window.parent,
    beforeReceive(event) {
        return event.data.pluginMessage;
    },
    receiveAdapter(data) {
        return { pluginMessage: data };
    },
});
```

#### RPCMessageEvent Methods

| 方法    | 说明                                    |
| :------ | :-------------------------------------- |
| on      | 设置事件监听                            |
| emit    | 触发事件                                |
| off     | 移除事件监听                            |
| onerror | 发生错误时触发 onerror 回调             |
| destroy | 释放 RPCMessageEvent 资源与内部事件监听 |

```ts
onerror: null | ((error: RPCError) => void);

const event = new RPCMessageEvent({...});
event.onerror((error) => {
});
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

添加测试~
