import { RPCMessageEvent, RPC } from '../src/index';
import { AMethods } from './methods';
import './style.css';

const iframe = document.querySelector('iframe')!;

const rpc = new RPC({
  event: new RPCMessageEvent({
    currentContext: window,
    targetContext: iframe.contentWindow!,
    origin: '*',
  }),
  methods: AMethods,
});

rpc.invoke('B.now', null).then((res) => {
  console.log(`A invoke B.now result: ${res}`);
});
