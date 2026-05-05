import { getSession } from "@/app/lib/session";
import * as jose from "jose";
import UserInfo from "@/app/components/UserInfo";

export type TokenPayloadRow = {
  label: string;
  value: string;
};

export type TokenHeaderRow = {
  label: string;
  value: string;
};

function formatUnixTimestamp(value: unknown) {
  if (typeof value !== "number") {
    return "";
  }

  return new Date(value * 1000).toLocaleString("sv-SE", {
    hour12: false,
  });
}

function formatValue(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function getPayloadRows(payload: jose.JWTPayload): TokenPayloadRow[] {
  return [
    { label: "Issuer", value: formatValue(payload.iss) },
    { label: "Subject", value: formatValue(payload.sub) },
    { label: "Audience", value: formatValue(payload.aud) },
    { label: "Issued at", value: formatUnixTimestamp(payload.iat) },
    { label: "Expires at", value: formatUnixTimestamp(payload.exp) },
    { label: "Token ID", value: formatValue(payload.jti) },
  ].filter((row) => row.value !== "");
}

function getHeaderRows(header: jose.ProtectedHeaderParameters): TokenHeaderRow[] {
  return [
    { label: "Algorithm", value: formatValue(header.alg) },
    { label: "Type", value: formatValue(header.typ) },
    { label: "Key ID", value: formatValue(header.kid) },
  ].filter((row) => row.value !== "");
}

export default async function UserPage() {
  const sessionData = await getSession();
  const token = sessionData?.token;

  let errorMessage: string | null = null;
  let userName = "";
  let payloadRows: TokenPayloadRow[] = [];
  let headerRows: TokenHeaderRow[] = [];

  if (!token) {
    errorMessage = "No token found in session.";
  } else {
    try {
      const payload = jose.decodeJwt(token);
      const header = jose.decodeProtectedHeader(token);

      userName = formatValue(
        payload.sub ?? payload.email ?? payload["user"] ?? "Unknown user",
      );
      payloadRows = getPayloadRows(payload);
      headerRows = getHeaderRows(header);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      errorMessage = `Could not read token information: ${message}`;
    }
  }

  return (
    <main>
      <div className="container">
        <h2 className="my-3">User info</h2>
        <div className="row">
          {errorMessage ? (
            <div className="col-12 col-lg-6">
              <div className="alert alert-warning" role="alert">
                <i className="bi bi-exclamation-triangle-fill fs-4 pe-1"></i>
                {errorMessage}
              </div>
            </div>
          ) : (
            <UserInfo
              userName={userName}
              payloadRows={payloadRows}
              headerRows={headerRows}
            />
          )}
        </div>
      </div>
    </main>
  );
}
