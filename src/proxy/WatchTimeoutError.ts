export class WatchTimeoutError extends Error {
    get name() {
        return "WatchTimeoutError";
    }

    get message() {
        return "Endpoint was not accessed before timeout.";
    }
}
