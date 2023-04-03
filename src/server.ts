import { NetworkProxyTrafficLightClient } from "./trafficlight";

const proxyURL = new URL(process.env.PROXY_URL ?? "http://localhost:4040");
const proxyURLPort = parseInt(proxyURL.port, 10);
const listenPort = parseInt(process.env.LISTEN_PORT) ?? proxyURLPort;
const trafficlightURL = process.env.trafficlightURL ?? "http://localhost:5000";

async function start() {
    const trafficLightClient = new NetworkProxyTrafficLightClient(trafficlightURL, proxyURL, listenPort);
    await trafficLightClient.register();
    await trafficLightClient.start();
}

start();
