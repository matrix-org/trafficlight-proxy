# Trafficlight Proxy Client

An http-proxy that registers as a [trafficlight client](https://github.com/matrix-org/trafficlight) which allows selective blocking of endpoints.  

See [this](https://github.com/matrix-org/trafficlight/pull/28/files) for more information.

## Running
---
Install dependencies using:
```bash
yarn install
```
Run client using:
```bash
yarn start
```
The proxy should now be available at `http://localhost:4040`

## Changing Proxy link and trafficlight server link
---
The defaults are:
- Trafficlight server is assumed to be running at http://localhost:5000
- Proxy will be running at http://localhost:4040

Change them via `TRAFFICLIGHT_URL` and `PROXY_URL` environment variables respectively.
