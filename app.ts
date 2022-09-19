import httpProxy from "http-proxy";
import { TrafficLightClient } from "./trafficlight/TrafficLightClient";

const SYNAPSE_HOST = "http://localhost:35355";
let proxy = httpProxy.createProxyServer({ target: SYNAPSE_HOST }).listen(4040);
const trafficLightClient = new TrafficLightClient("http://localhost:5000");
trafficLightClient.register("network-proxy", {endpoint: "http://somehost:3030"});