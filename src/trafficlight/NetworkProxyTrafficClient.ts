import { TrafficLightClient } from "./TrafficLightClient";
import { Proxy } from "../proxy/Proxy";

export class NetworkProxyTrafficLightClient extends TrafficLightClient {
    private proxy: Proxy;
    public proxyURL: URL;

    constructor(trafficLightServerURL: string, proxyURL: string) {
        super(trafficLightServerURL);
        this.hookActionsToMethods();
        this.proxyURL = new URL(proxyURL);
    }

    private hookActionsToMethods() {
        this.on("idle", async () => await new Promise(r => setTimeout(r, 5000)));

        this.on("proxyTo", async (data: Record<string, string>) => {
            this.createProxy(data.url);
            console.log(`\tProxy available at ${this.proxyURL.toString()}, pointing to ${data.url}`);
            return "proxyToSet";
        });

        this.on("disableEndpoint", async (data: Record<string, string>) => {
            this.disableEndpoint(data.endpoint);
            return "endpointDisabled";
        });

        this.on("enableEndpoint", async (data: Record<string, string>) => {
            this.enableEndpoint(data.endpoint);
            return "endpointDisabled";
        });

        this.on("exit", async () => { this.exit(); });
    }

    async register(): Promise<void> {
        await super._register("element-web", {
            endpoint: this.proxyURL.toString(),
        });
    }

    private createProxy(url: string) {
        if (!url) {
            throw new Error(`"url" is not supplied with proxyTo action!`);
        }
        const port = parseInt(this.proxyURL.port, 10);
        const replaceSynapseServerUrlWithProxyUrl = (data: string) => {
            console.log("Replacer running on ", url, this.proxyURL.toString());
            return data.replaceAll(url + "/", this.proxyURL.toString());
        };
        this.proxy = new Proxy()
            .target(url)
            .addResponseModifier("/_matrix/client/v3/login", replaceSynapseServerUrlWithProxyUrl)
            .addResponseModifier("/_matrix/client/r0/login", replaceSynapseServerUrlWithProxyUrl)
            .addResponseModifier("/.well-known/matrix/client", replaceSynapseServerUrlWithProxyUrl)
            .listen(port);

    }

    private disableEndpoint(endpoint: string) {
        if (!endpoint) {
            throw new Error(`"endpoint" is not supplied with disableEndpoint action!`);
        }
        this.proxy.disableEndpoint(endpoint);
    }

    private enableEndpoint(endpoint: string) {
        if (!endpoint) {
            throw new Error(`"endpoint" is not supplied with disableEndpoint action!`);
        }
        this.proxy.enableEndpoint(endpoint);
    }

    private exit() {
        this.proxy.close();
    }
}
