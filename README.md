# Trafficlight Proxy Client

An http-proxy that registers as a [trafficlight client](https://github.com/matrix-org/trafficlight) which allows selective blocking of endpoints.  

See [this](https://github.com/matrix-org/trafficlight/pull/28/files) for more information.

## Running
---
Install dependencies using:
```bash
yarn install
```

Run the client using:
```bash
yarn start
```
The proxy should now be available at `http://localhost:4040`

## Development

Instead, run the client using:
```bash
yarn start-dev
```

The proxy will again be at `http://localhost:4040`, but nodemon will reload the proxy when changes are made.

## Docker

There is a supported docker image at ghcr.io/vector-im/trafficlight-proxy can be used to run this proxy.

You must pass `TRAFFICLIGHT_URL` and `PROXY_URL`. You may also pass `LISTEN_PORT`.

`TRAFFICLIGHT_URL` should be set to a trafficlight server.

`PROXY_URL` should be set to an endpoint that the trafficlight clients can access.

`LISTEN_PORT` should be set to the tcp port that the proxy should bind to. If unset it will use the port from `PROXY_URL`.


## Changing Proxy link and trafficlight server link
---
The defaults are:
- Trafficlight server is assumed to be running at http://localhost:5000
- Proxy will be running at http://localhost:4040
- Proxy will listen on the port from PROXY\_URL (:4040)

Change them via `TRAFFICLIGHT_URL` and `PROXY_URL` environment variables respectively.
