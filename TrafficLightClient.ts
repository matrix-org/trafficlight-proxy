import fetch from 'node-fetch';
import * as crypto from 'crypto';

type PollData = {
    action: string;
    data: Record<string, any>;
};

type ActionCallback = (action: string, data: Record<string, string>) => Promise<string>;

class ActionMap {
    private readonly actions: Record<string, ActionCallback>  = {};

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

export class TrafficLightClient extends ActionMap {
	constructor(
		private readonly trafficLightServerURL: string,
    ) {
        super();
    }

    async register(type:string, data: Record<string, string>): Promise<void> {
        console.log('Registering trafficlight client');
        const body = JSON.stringify({
            type,
            ...data
        });
        const uuid = crypto.randomUUID();
        const target = `${this.trafficLightServerURL}/client/${uuid}/register`;
        const response = await fetch(target, {
            method: "POST",
            body,
            headers: { "Content-Type": "application/json" },
        });
        if (response.status != 200) {
            throw new Error(`Unable to register client, got ${ response.status } from server`);
        } else {
            console.log(`Registered to trafficlight as ${uuid}`);
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
            console.log(` * running action ${pollData.action}`);
            if (pollData.action === 'exit') {
                shouldExit = true;
            } else {
                let result: string | undefined;
                try {
                    const { action, data } = pollData;
                    const callback = this.get(action);
                    if (!callback) {
                        console.log("WARNING: unknown action ", action);
                        continue;
                    } 
                    result = await callback(action, data);
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

    get pollUrl() {
        return `${this.trafficLightServerURL}/poll`; 
    }

    get respondUrl() {
        return `${this.trafficLightServerURL}/respond`;
    }
}