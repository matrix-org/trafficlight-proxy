import { NetworkProxyTrafficLightClient } from "./trafficlight";

async function doFoo() {
    const SYNAPSE_HOST = "http://localhost:35355";
    const trafficLightClient = new NetworkProxyTrafficLightClient("http://localhost:5000", "http://localhost:4040");
    trafficLightClient["createProxy"]("http://172.18.0.5:8008");
    trafficLightClient["disableEndpoint"]("/_matrix/static/");
    // await trafficLightClient.register();
    // await trafficLightClient.start();
}

doFoo();
