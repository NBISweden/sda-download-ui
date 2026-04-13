# Download API v2 - Local Development

Dev stack for building applications against the sda-download v2 API. It includes, `sda-download`, `sda-auth`, `ls-aai-mock`, their dependencies and scripts to populate the database and the s3 inbox with mock data for testing. This is a modified version of the stack from [this](https://github.com/neicnordic/sensitive-data-archive/pull/2368) PR.

There are two mock services included for issuing tokens:

- The `mockauth` is a python script that serves tokens directly from a `/token` endpoint. These work with the dataset initialized by `seed.sh`. This is great for developing all website functionality except the login flow that involves `sda-auth`.

- The `sda-auth` and `ls-aai-mock` stack included here is the more realistic mock that mirrors closely what is used in production to fetch tokens. This can be used for [developing the login flow of the website](https://github.com/neicnordic/sensitive-data-archive/blob/example/use-sda-auth-for-download-webapp/sda/cmd/auth/auth2webapp.md) once the necessary modifications in `sda-auth` are merged in the sda repository. The website will ultimately work with this stack.

Both mock oidc services above will serve tokens that work with `sda-download-v2` but at the moment only the `mockauth` token contains visas that grand access to the test dataset.

## Quick Start

### With `mockauth` only

```bash
# Start all services
docker compose -f sda-dev-stack.yml up -d
```

```bash
# Get a token
TOKEN=$(curl -s http://localhost:8001/tokens | jq -r '.[0]')

# List datasets
curl -H "Authorization: Bearer $TOKEN" http://localhost:8085/datasets

# List files in dataset
curl -H "Authorization: Bearer $TOKEN" http://localhost:8085/datasets/EGAD00000000001/files
```

### With `sda-auth` and `ls-aai-mock`

To save on resources, the `sda-auth` stack is not started by default but activated as a profile. In order to do so, first uncomment the following line from `config.yaml`:

```yaml
jwt:
  pubkey-path: "/shared/keys/pub/"
  # pubkey-url: "http://localhost:8800/oidc/jwk"
  allow-all-data: false
```

and then change

```yaml
userinfo-url: "http://mockauth:8000/userinfo"
```

to

```yaml
userinfo-url: "http://localhost:8800/oidc/userinfo"
```

Finally run:

```bash
docker compose -f sda-dev-stack.yml --profile sda-auth up -d
```

## Services

| Service  | Port  | Description                                         |
|----------|-------|-----------------------------------------------------|
| download | 8085  | Download API v2                                     |
| mockauth | 8001  | Mock OIDC (JWKS, userinfo, /tokens)                 |
| postgres | 15432 | PostgreSQL with SDA schema                          |
| minio    | 19000 | S3 storage (console at 19001)                       |
| reencrypt| 50051 | gRPC re-encryption for file downloads               |
| auth-aai | 8801  | OpenIDConnect client for fetching tokens            |
| mock-aai | 8800  | Mock LS-AAI OIDC server for issuing tokens and visas|

## Getting Tokens

### With mockauth

```bash
# Token for integration_test@example.org (has access to all test datasets)
TOKEN=$(curl -s http://localhost:8001/tokens | jq -r '.[0]')
```

### With sda-auth

Manual flow:

Go to `http://localhost:8801` and follow the login flow, copy the second token (the one for download) on the final page and paste it in a file. Then `token=$(cat <filename>)` and use it the same way as described above.

Note: since the token issued from `sda-auth`/`ls-aai-mock` contains no granted visas for accessing the test dataset, if this token is used in the examples of this document the expected response is an empty list.

Code handoff flow:

Description to be added when an `sda-auth` image with the feature implemented is available.

## API Endpoints

Full documentation: [sda/cmd/download/download.md](../../sda/cmd/download/download.md)

```bash
# Health check
curl http://localhost:8085/health/ready

# List datasets
curl -H "Authorization: Bearer $TOKEN" http://localhost:8085/datasets

# Dataset details
curl -H "Authorization: Bearer $TOKEN" http://localhost:8085/datasets/EGAD00000000001

# List files in dataset
curl -H "Authorization: Bearer $TOKEN" http://localhost:8085/datasets/EGAD00000000001/files

# File metadata
curl -H "Authorization: Bearer $TOKEN" http://localhost:8085/files/EGAF00000000001

# DRS object resolution
curl -H "Authorization: Bearer $TOKEN" http://localhost:8085/objects/EGAD00000000001/test-file.c4gh

# Get the c4gh public key from the running stack
docker cp sda-download:/shared/c4gh.pub.pem /tmp/dev-c4gh.pub.pem
C4GH_KEY=$(base64 -w0 /tmp/dev-c4gh.pub.pem)

# Download a file (requires c4gh public key)
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-C4GH-Public-Key: $C4GH_KEY" \
     http://localhost:8085/files/EGAF00000000001 -o file.c4gh

# Download content only (stable ETag, supports Range requests)
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-C4GH-Public-Key: $C4GH_KEY" \
     http://localhost:8085/files/EGAF00000000001/content -o content.c4gh
```

## Test Data

The stack is pre-seeded with:

- **Dataset**: `EGAD00000000001` ("Test Dataset")
- **File**: `EGAF00000000001` (`test-file.c4gh`, 1000 bytes archived, 500 bytes decrypted)
- **User**: `integration_test@example.org` (file owner)

## Cleanup

```bash
docker compose -f sda-dev-stack.yml down
```

or

```bash
docker compose -f sda-dev-stack.yml --profile sda-auth down
```

## Versioning

By default the deployed sda stack version is set to the latest stable at the time of writing. It is possible to change the stack version by setting the image `TAG` variable as follows:

```bash
TAG=PR2026-03-30 docker compose -f sda-dev-stack.yml up
```

Note that the [sensitive data archive repository](https://github.com/neicnordic/sensitive-data-archive) builds new images whenever a new PR is merged or opened.
