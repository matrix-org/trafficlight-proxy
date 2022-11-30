import httpProxy from "http-proxy";
import http from "http";
import zlib from "zlib";

import { WatchTimeoutError } from "./WatchTimeoutError";

type ResponseModifier = (response: string) => string;

type IncomingMessageWithStartTime = http.IncomingMessage & { startTime: number };

class ResponseDelay {
    raw: string
    compiled: RegExp
    delay: number
    constructor(raw: string, delay: number) {
        this.raw = raw;
        this.delay = delay;
        this.compiled = new RegExp(raw);
    }
}

export class Proxy {
    private httpProxy: ReturnType<typeof httpProxy.createProxyServer>;
    private httpSever: http.Server;
    private disabledEndpoints: string[] = [];
    private delayedEndpoints: Record<string, number> = {};
    private responseModifierMap: Map<string, ResponseModifier> = new Map();
    private waitForMap: Map<string, () => void> = new Map();
    private responseDelayList: Array<ResponseDelay>= new Array();
    private defaultResponseDelay = 0;
    public targetURL: string;
    // milliseconds of added delay for early requests
    private underspillDuration = 0;
    // milliseconds of extra delay for late requests
    private overspillDuration = 0;

    target(url: string) {
        try {
            new URL(url);
        } catch (e) {
            throw new Error("Invalid URL provided to Proxy.target() method");
        }
        this.targetURL = url;
        this.httpProxy = httpProxy.createProxyServer({ target: url, selfHandleResponse: true });
        this.httpSever = http.createServer((req, res) => { this.httpServerHandle(req, res); });
        this.setupEvents();
        return this;
    }

    private httpServerHandle(req: http.IncomingMessage, res: http.ServerResponse) {
        const currentEndpoint = req.url;
        this.resolveWaitIfNeeded(currentEndpoint);
        const isEndpointBlocked = this.disabledEndpoints.some(endpoint => currentEndpoint.includes(endpoint));
        if (isEndpointBlocked) {
            console.log(`Current endpoint "${currentEndpoint}" is blocked 🔴`);
            res.statusCode = 503;
            res.end("Blocked");
            return;
        }
        for (const [endpoint, delay] of Object.entries(this.delayedEndpoints)) {
            if (currentEndpoint.includes(endpoint)) {
                console.log(`Current endpoint "${currentEndpoint}" is delayed by ${delay} ms 🟡`);
                this.respondAfterDelay(req, res, delay);
                return;
            }
        }
        console.log(`Current endpoint "${currentEndpoint}" is not blocked 🟢`);
        (req as IncomingMessageWithStartTime).startTime = Date.now();
        this.httpProxy.web(req, res, { changeOrigin: true});
    }

    listen(port: number) {
        if (!this.httpProxy || !this.httpSever) {
            throw new Error("You must call Proxy.target() before you can use listen()");
        }
        this.httpSever.listen(port);
        return this;
    }

    disableEndpoint(endpoint: string) {
        if (!this.disabledEndpoints.includes(endpoint)) {
            this.disabledEndpoints.push(endpoint);
        } else {
            console.warn(`Endpoint ${endpoint} is already disabled!`);
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

    delayEndpoint(endpoint: string, delay: number) {
        if (this.delayedEndpoints[endpoint]) {
            console.warn(`Endpoint ${endpoint} was already being delayed; it will now be delayed by ${delay} ms`);
            throw new Error("Endpoint is already being delayed!");
        }
        this.delayedEndpoints[endpoint] = delay;
        return this;
    }

    undelayEndpoint(endpoint: string) {
        if (!this.delayedEndpoints[endpoint]) {
            console.warn(`Cannot remove delay for endpoint ${endpoint} since no delay was added in the first place!`);
            return;
        }
        delete this.delayedEndpoints[endpoint];
        return this;
    }

    addResponseModifier(endpoint: string, modifier: ResponseModifier) {
        this.responseModifierMap.set(endpoint, modifier);
        return this;
    }

    addResponseDelay(endpointRegex: string, delayMs: number) {
        // We unshift onto the front of the array because generally adding
        // tests will want to go from least specific to most specific.
        this.responseDelayList.unshift(new ResponseDelay(endpointRegex, delayMs));
        return this;
    }

    responseDelayDefault(delayMs: number) {
        this.defaultResponseDelay = delayMs;
        return this;
    }
    async waitForEndpoint(endpoint: string, timeout: number) {
        // See if we're already tracking this endpoint
        const existingPromise = this.waitForMap.get(endpoint);
        if (existingPromise) {
            return existingPromise;
        }
        const timeoutPromise = new Promise((_, rej) => {
            setTimeout(() => { rej(new WatchTimeoutError()); }, timeout);
        });
        const watchPromise = new Promise((res: (val: void) => void) => {
            this.waitForMap.set(endpoint, res);
        });
        await Promise.race([watchPromise, timeoutPromise]);
        this.waitForMap.delete(endpoint);
    }

    private respondAfterDelay(req: http.IncomingMessage, res: http.ServerResponse, delay: number): void {
        setTimeout(() => {
            this.httpProxy.web(req, res);
        }, delay);
    }

    close() {
        console.log(`Proxy closing having needed ${this.underspillDuration}ms of delay to be added, `
                   +`and ${this.overspillDuration} of extra due to slow servers`);
        if (!this.httpProxy) {
            console.warn("Cannot close because proxy was never created!");
            return;
        }
        this.httpSever.close();
        this.httpProxy.close();
        this.httpProxy = undefined;
    }

    private identifyResponseDelay(currentEndpoint) {
        for (const responseDelay of this.responseDelayList) {
            if (responseDelay.compiled.test(currentEndpoint)) {
                return responseDelay.delay;
            }
        }
        return this.defaultResponseDelay;
    }

    private setupEvents() {
        this.httpProxy.on('proxyRes', (proxyRes, req, res) => {
            const currentEndpoint = req.url;
            const responseModifier = this.responseModifierMap.get(currentEndpoint);
            const needsDataProcessing = !!responseModifier;
            const responseDelay = this.identifyResponseDelay(currentEndpoint);
            const needsResponseDelay = (responseDelay != 0);
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            if (!needsDataProcessing && !needsResponseDelay) {
                // throw the result straight through, no edits or delays.
                proxyRes.pipe(res, { end: true });
            }
            const body = [];
            proxyRes.on('data', (chunk) => { body.push(chunk); });
            proxyRes.on('end', () => {
                if (!needsDataProcessing && !needsResponseDelay) {
                    /**
                     * We've already piped the result; so nothing left to do.
                     */
                    return;
                }
                console.log(`Response modifier or delay found for endpoint "${currentEndpoint}"`);
                let responseBuffer = Buffer.concat(body);
                if (needsDataProcessing) {
                    // Un-gzip the buffer if needed
                    const isCompressed = proxyRes.headers["content-encoding"] === "gzip";
                    if (isCompressed) {
                        responseBuffer = zlib.gunzipSync(responseBuffer);
                    }
                    const modifiedResponseString = responseModifier(responseBuffer.toString());
                    let modifiedBuffer = Buffer.from(modifiedResponseString);
                    if (modifiedBuffer.toString() === responseBuffer.toString()) {
                        console.warn("Response modifier made no changes!");
                        console.info("BEFORE", responseBuffer.toString());
                        console.info("AFTER", modifiedBuffer.toString());
                    }
                    // Gzip the modified buffer if needed
                    if (isCompressed) {
                        modifiedBuffer = zlib.gzipSync(modifiedBuffer);
                    }
                    // Pass this response to the client
                    responseBuffer = modifiedBuffer;
                }
                if (needsResponseDelay) {
                    const delay = responseDelay - (Date.now() - (req as IncomingMessageWithStartTime).startTime);
                    if (delay > 0) {
                        console.info(`Delaying  "${currentEndpoint}" by ${delay}ms`);
                        // response should be slower: add delay
                        setTimeout(function() {
                            res.end(responseBuffer);
                        }, delay);
                        this.underspillDuration = this.underspillDuration + delay;
                    } else {
                        res.end(responseBuffer);
                        console.warn(`Response for endpoint "${currentEndpoint}" returned ${-delay}ms late`);
                        this.overspillDuration = this.overspillDuration - delay;
                    }
                } else {
                    res.end(responseBuffer);
                }
            });
        });
    }

    private resolveWaitIfNeeded(endpoint: string) {
        for (const [key, resolve] of this.waitForMap) {
            if (endpoint.includes(key)) {
                resolve();
            }
        }
    }
}
