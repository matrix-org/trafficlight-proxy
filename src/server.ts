import { NetworkProxyTrafficLightClient } from "./trafficlight";

const proxyURL = process.env.PROXY_URL ?? "http://localhost:4040";
const trafficlightURL = process.env.trafficlightURL ?? "http://localhost:5000";

async function start() {
    const trafficLightClient = new NetworkProxyTrafficLightClient(trafficlightURL, proxyURL);
    await trafficLightClient.register();
    await trafficLightClient.start();
}

start();
