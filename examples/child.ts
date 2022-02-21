import { RPCMessageEvent, RPC } from '../src/index';
import { BMethods } from './methods';
import './style.css';

const rpc = new RPC({
  event: new RPCMessageEvent({
    currentContext: window,
    targetContext: window.top,
    origin: '*',
  }),
  methods: BMethods,
});

rpc.invoke('A.add', [1, 2]).then((res) => {
  console.log(`B invoke A.add result: ${res}`);
});
