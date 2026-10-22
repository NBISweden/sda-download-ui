// We currently cap the maximum number of files that can be requested in one TAR to
// keep the request line limit <8KB and to avoid DoS risks. This can be relaxed in the
// future if we implement a more robust request format (e.g. POST with JSON body).
export const MAX_TAR_SELECTION = 200;
