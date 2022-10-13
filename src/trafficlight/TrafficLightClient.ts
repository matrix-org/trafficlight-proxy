import fetch from 'node-fetch';
import * as crypto from 'crypto';

type PollData = {
    action: string;
    data: Record<string, any>;
};

type ActionCallback = (data?: Record<string, string>, client?: TrafficLightClient) => Promise<string | void>;

export class ActionMap {
    constructor(
        private readonly actions: Record<string, ActionCallback> = {},
    ) {}

    on(action: string, callback: ActionCallback): void {
        if (this.actions[action]) {
            throw new Error(`Action for "${action}" is already specified!`);
        }
        this.actions[action] = callback;
    }

    off(action: string): void {
        if (!this.actions[action]) {
            throw new Error(`Action "${action}" is not specified!`);
        }
        this.actions[action] = undefined;
    }

    get(action: string): ActionCallback {
        return this.actions[action];
    }
}

export class TrafficLightClient {
    private uuid: string;

    constructor(
		private readonly trafficLightServerURL: string,
        private readonly actionMap: ActionMap = new ActionMap(),
    ) {}

    protected async _register(type: string, data: Record<string, string>): Promise<void> {
        console.log('Registering trafficlight client ...');
        const body = JSON.stringify({
            type,
            ...data,
        });
        this.uuid = crypto.randomUUID();
        const target = `${this.trafficLightServerURL}/client/${this.uuid}/register`;
        const response = await fetch(target, {
            method: "POST",
            body,
            headers: { "Content-Type": "application/json" },
        });
        if (response.status != 200) {
            throw new Error(`Unable to register client, got ${ response.status } from server`);
        } else {
            console.log(`Registered to trafficlight as ${this.uuid}`);
        }
    }

    async start() {
        let shouldExit = false;
        while (!shouldExit) {
            const pollResponse = await fetch(this.pollUrl);
            if (pollResponse.status !== 200) {
                throw new Error(`poll failed with ${pollResponse.status}`);
            }
            const pollData = await pollResponse.json() as PollData;
            console.log(`* Trafficlight asked to execute action "${pollData.action}", data = ${JSON.stringify(pollData.data)}:`);
            if (pollData.action === 'exit') {
                shouldExit = true;
            } else {
                let result: Awaited<ReturnType<ActionCallback>>;
                try {
                    const { action, data } = pollData;
                    const callback = this.actionMap.get(action);
                    if (!callback) {
                        console.log("\tWARNING: unknown action ", action);
                        continue;
                    }
                    console.log(`\tAction for "${action}" found in action-map  ✔`);
                    result = await callback(data, this);
                } catch (err) {
                    console.error(err);
                    result = 'error';
                }
                if (result) {
                    const respondResponse = await fetch(this.respondUrl, {
                        method: 'POST',
                        body: JSON.stringify({
                            response: result,
                        }),
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                    });
                    if (respondResponse.status !== 200) {
                        throw new Error(`respond failed with ${respondResponse.status}`);
                    }
                }
            }
        }
    }

    on(action: string, callback: ActionCallback): void {
        this.actionMap.on(action, callback);
    }

    off(action: string): void {
        this.actionMap.off(action);
    }

    get clientBaseUrl(): string {
        return `${this.trafficLightServerURL}/client/${encodeURIComponent(this.uuid)}`;
    }
    get pollUrl() {
        return `${this.clientBaseUrl}/poll`;
    }

    get respondUrl() {
        return `${this.clientBaseUrl}/respond`;
    }
}
