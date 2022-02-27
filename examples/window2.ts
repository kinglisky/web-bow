import { RPCMessageEvent, RPC } from '../src/index';
import { BMethods } from './methods';
import './style.css';

(async function () {
    const rpc = new RPC({
        event: new RPCMessageEvent({
            currentContext: window,
            targetContext: window.opener,
        }),
        methods: BMethods,
    });
    await rpc.connect(2000);

    rpc.invoke('A.add', [1, 2]).then((res) => {
        console.log(`B invoke A.add result: ${res}`);
    });
})();