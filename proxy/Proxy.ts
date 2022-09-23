import httpProxy from "http-proxy";
import zlib from "zlib";

type ResponseModifier = (response: string) => string;

export class Proxy {
    private httpProxy: httpProxy;
    private disabledEndpoints: string[] = [];
    private responseModifierMap: Map<string, ResponseModifier> = new Map();
    public targetURL: string;
    
    target(url: string) {
        try {
            new URL(url);
        }
        catch (e) {
            throw new Error("Invalid URL provided to Proxy.target() method");
        }
        this.targetURL = url;
        this.httpProxy = new httpProxy({ target: url, selfHandleResponse: true });
        this.setupEvents();
        return this;
    }

    listen(port: number) {
        if (!this.httpProxy) {
            throw new Error("You must call Proxy.target() before you can use listen()");
        }
        this.httpProxy.listen(port);
        return this;
    }

    disableEndpoint(endpoint: string) {
        if (!this.disabledEndpoints.includes(endpoint)) {
            this.disabledEndpoints.push(endpoint);
       }
        else {
            console.warn(`Endpoint ${endpoint} is already disabled!`)
       }
        return this;
    }

    enableEndpoint(endpoint: string) {
        const index = this.disabledEndpoints.findIndex(e => e === endpoint);
        if (index === -1) {
            console.warn(`Cannot enable endpoint ${endpoint} because it was never disabled!`);
            return;
        }
        this.disabledEndpoints.splice(index, 1);
        return this;
    }

    addResponseModifier(endpoint: string, modifier: ResponseModifier) {
        this.responseModifierMap.set(endpoint, modifier);
        return this;
    }

    close() {
        if (!this.httpProxy) {
            console.warn("Cannot close because proxy was never created!")
            return;
        }
        this.httpProxy.close();
        this.httpProxy = undefined;
    }

    private setupEvents() {
        this.httpProxy.on('proxyRes', (proxyRes, req, res) => {
            const currentEndpoint = req.url;
            const isEndpointBlocked = this.disabledEndpoints.some(endpoint => endpoint === currentEndpoint);
            const isCompressed = proxyRes.headers["content-encoding"] === "gzip";
            const responseModifier = this.responseModifierMap.get(currentEndpoint);
            const needsDataProcessing = !!responseModifier;
            if (!isEndpointBlocked) {
                console.log(`Current endpoint "${currentEndpoint}" is not blocked 🟢`);
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                if (!needsDataProcessing) {
                    proxyRes.pipe(res, {end: true});
                }
                else {
                    console.log("\t Need to process data, not piping");
                }
            }
            else {
                console.log(`Current endpoint "${currentEndpoint}" is blocked ​🔴​`);
                res.statusCode = 503;
                res.end("Blocked");
            }
            let body = [];
            proxyRes.on('data', (chunk) => { body.push(chunk); });
            proxyRes.on('end', () => {
                if (!needsDataProcessing) {
                    /**
                     * We've already piped the result; so nothing left to do. 
                     */
                    return;
                }
                let responseBuffer = Buffer.concat(body);
                // un-gzip the buffer if needed
                if (isCompressed) {
                    responseBuffer = zlib.gunzipSync(responseBuffer);
                }
                const modifiedResponseString = responseModifier(responseBuffer.toString());
                let modifiedBuffer = Buffer.from(modifiedResponseString);
                if (modifiedBuffer.toString() === responseBuffer.toString()) {
                    console.warn("Response modifier made no changes!");
                }
                // gzip the modified buffer if needed
                if (isCompressed) {
                    modifiedBuffer = zlib.gzipSync(modifiedBuffer);
                }
                // Pass this response to the client!
                res.end(modifiedBuffer);
            });
        });
    }

}
