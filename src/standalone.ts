import { Proxy, WatchTimeoutError } from "./proxy";

const proxyURL = new URL(process.env.PROXY_URL ?? "http://localhost:4040");
const targetURL = process.env.TARGET_URL ?? "http://localhost:8008";

async function start() {
   const port = parseInt(proxyURL.port, 10);
   // TODO: refactor this into shared library
   const replaceSynapseServerUrlWithProxyUrl = (data: string) => { 
       console.log(`Replacer running on ${targetURL} -> ${proxyURL.toString()}`);
       return data.replaceAll(targetURL + "/", proxyURL.toString());
   }
   const proxy = new Proxy()
       .target(targetURL)
       .addResponseModifier("/_matrix/client/v3/login", replaceSynapseServerUrlWithProxyUrl)
       .addResponseModifier("/_matrix/client/r0/login", replaceSynapseServerUrlWithProxyUrl)
       .addResponseModifier("/.well-known/matrix/client", replaceSynapseServerUrlWithProxyUrl)
       .addResponseDelay("/_matrix/client/", 500)
       .responseDelayDefault(0);
   

   proxy.listen(port);
}

start();
