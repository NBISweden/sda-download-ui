import { getSession } from "@/app/lib/session";
import * as jose from "jose";
import UserInfo from "@/app/components/UserInfo";
import Alert from "@/app/components/Alert";

export type TokenInfoRow = {
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

function getTokenInfoRows(payload: jose.JWTPayload): TokenInfoRow[] {
  return [
    {
      label: "Signed in as",
      value: formatValue(
        payload.sub ?? payload.email ?? payload["user"] ?? "Unknown user",
      ),
    },
    {
      label: "Issued",
      value: formatUnixTimestamp(payload.iat),
    },
    {
      label: "Expires",
      value: formatUnixTimestamp(payload.exp),
    },
    {
      label: "Provided by",
      value: formatValue(payload.iss),
    },
    {
      label: "For application",
      value: formatValue(payload.aud),
    },
  ].filter((row) => row.value !== "");
}

export default async function UserPage() {
  const sessionData = await getSession();
  const token = sessionData?.token;

  let errorMessage: string | null = null;
  let userName = "";
  let tokenInfoRows: TokenInfoRow[] = [];

  if (!token) {
    errorMessage = "No token found in session.";
  } else {
    try {
      const payload = jose.decodeJwt(token);

      userName = formatValue(
        payload.sub ?? payload.email ?? payload["user"] ?? "Unknown user",
      );
      tokenInfoRows = getTokenInfoRows(payload);
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
              <Alert
                type="warning"
                alertMessage={errorMessage}
                iconClass="bi bi-exclamation-triangle-fill"
              />
            </div>
          ) : (
            <UserInfo userName={userName} tokenInfoRows={tokenInfoRows} />
          )}
        </div>
      </div>
    </main>
  );
}
