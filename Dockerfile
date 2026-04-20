FROM node:lts-alpine AS base

ARG BUILD_ID=1000:1000
ARG RUNTIME_ID=1000:1000
ARG UID=${BUILD_ID%:*}
ARG GID=${BUILD_ID#*:}

RUN --mount=type=cache,id=apk-cache,target=/var/cache/apk \
	apk --cache-dir=/var/cache/apk add \
		dumb-init

ENV HOME=/app
ENV XDG_CACHE_HOME="$HOME/.cache"

RUN install -d -o "$UID" -g "$GID" "$HOME"

USER "$BUILD_ID"

WORKDIR "$HOME"

ENV npm_config_cache="$XDG_CACHE_HOME/npm" \
    npm_config_loglevel=info
ENV NEXT_TELEMETRY_DISABLED=1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]

# ----

## Production build stage
FROM base AS prod-build

RUN --mount=type=bind,source=package.json,target=./package.json,readonly \
    --mount=type=bind,source=package-lock.json,target=./package-lock.json,readonly \
    --mount=type=cache,id=npm-cache,uid="$UID",target="$npm_config_cache" \
	npm ci

COPY --chown="$UID:$GID" package*.json .
COPY --chown="$UID:$GID" ./tsconfig.json .
COPY --chown="$UID:$GID" ./next*.ts .
COPY --chown="$UID:$GID" ./src ./src

ARG BUILD_GIT_COMMIT
ARG BUILD_GIT_BRANCH

ENV NEXT_PUBLIC_BUILD_GIT_COMMIT="$BUILD_GIT_COMMIT" \
    NEXT_PUBLIC_BUILD_GIT_BRANCH="$BUILD_GIT_BRANCH"

RUN mkdir -p .next/cache
RUN --mount=type=cache,id=npm-cache,uid="$UID",target="$npm_config_cache" \
    --mount=type=cache,id=next-cache,uid="$UID",target=.next/cache \
	npm run build

# ----

## Production stage
FROM node:lts-alpine AS prod

ARG BUILD_ID=1000:1000
ARG RUNTIME_ID=1000:1000
ARG UID=${BUILD_ID%:*}
ARG GID=${BUILD_ID#*:}

RUN --mount=type=cache,id=apk-cache,target=/var/cache/apk \
	apk --cache-dir=/var/cache/apk add dumb-init

ENV HOME=/app

RUN install -d -o "$UID" -g "$GID" "$HOME"

USER "$BUILD_ID"

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SERVICE_MODE=production

WORKDIR "$HOME"

# Copy standalone server output
COPY --from=prod-build --chown="$BUILD_ID" "$HOME/.next/standalone" ./
COPY --from=prod-build --chown="$BUILD_ID" "$HOME/.next/static" ./.next/static
COPY --chown="$BUILD_ID" --chmod=755 docker-entrypoint.sh .

USER "$RUNTIME_ID"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]

# ----

## Development stage
FROM base AS dev

ARG BUILD_DATE
ARG BUILD_GIT_COMMIT
ARG BUILD_GIT_BRANCH

ENV NEXT_PUBLIC_BUILD_DATE="$BUILD_DATE" \
    NEXT_PUBLIC_BUILD_GIT_COMMIT="$BUILD_GIT_COMMIT" \
    NEXT_PUBLIC_BUILD_GIT_BRANCH="$BUILD_GIT_BRANCH"

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development
ENV SERVICE_MODE=development

USER "$RUNTIME_ID"
