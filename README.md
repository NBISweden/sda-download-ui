# sda-download-ui

Repository containing the UI implementation of the sda-download service

## Development

The local development environment for the `sda-download UI` can be
deployed using docker compose files from this repository. The
environment consists of a compose file for starting a minimal sda
development stack and the compose file for deploying the download UI
webapp.

### SDA development stack

The necessary configuration and compose files for starting the
development stack for the `sda` backend services can be found under
`./dev-tools`. The stack includes the `sda-download` API service, OIDC
services and any required dependencies. Details for the stack and
instructions on how to run and test it can be found in the [README
file](dev-tools/README.md) of that folder.

### Download UI development stack

``` sh
./compose-dev.sh up --build
```

This mounts `./frontend` into the container, installs dependencies (if
needed), and runs `next dev`.

Open the UI at:

- http://localhost:3002

Notes:

- On first run the container will run `npm ci` and create
  `frontend/node_modules/` on your host (Linux recommended).

Stop and remove containers:

``` sh
./compose-dev.sh down
```

### Download UI production-like build and local run

Build and run the production image using the `compose-prod.sh` :

``` sh
./compose-prod.sh up --build
```

Open the UI at:

- http://localhost:3002

This mode is intended to be close to Kubernetes "PSA (Pod Security
Admission) restricted" operation:

- runs as a non-root UID/GID (`6001:6001`)
- no-new-privileges
- drops all Linux capabilities
- read-only root filesystem
- writable `/tmp` via tmpfs

Stop and remove containers:

``` sh
./compose-prod.sh down
```

To build only (no run):

``` sh
./compose-prod.sh build
```

### Connectivity to the sda dev stack

The `sda-download-UI` containers can access services of the sda-stack
through calls to the host gateway, e.g. fetching a token array from
`http://host.docker.internal:8001/tokens` should work.
