"use client";
import type { TokenInfoRow } from "@/app/(pages)/userinfo/page";
import { useActionState } from "react";
import type { Crypt4GHFormStateData } from "../actions/crypt4ghKey";
import Alert from "./Alert";

type UserInfoProps = {
  tokenInfoRows: TokenInfoRow[];
  keyFormAction?: SetKeyFormFunction;
  currentPemChecksum?: string;
};

type SetKeyFormFunction = (
  state: Crypt4GHFormStateData,
  d?: FormData,
) => Promise<Crypt4GHFormStateData>;

export default function UserInfo({
  tokenInfoRows,
  keyFormAction,
  currentPemChecksum,
}: UserInfoProps) {
  const noAction: SetKeyFormFunction = async () => ({});
  const [state, formAction, pending] = useActionState<Crypt4GHFormStateData>(
    keyFormAction || noAction,
    { pemChecksum: currentPemChecksum },
  );
  const pemChecksum =
    "pemChecksum" in state ? state.pemChecksum : currentPemChecksum;

  return (
    <div className="col-12 col-xl-8">
      <div className="card shadow-sm">
        <div className="card-body">
          <h4 className="h5 mb-3">Token</h4>

          <div className="table-responsive mb-4">
            <table className="table table-striped table-bordered align-middle">
              <tbody>
                {tokenInfoRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="w-25">
                      {row.label}
                    </th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {keyFormAction ? (
            <section>
              <h4 className="h5 mb-3">Crypt4gh public encryption key</h4>

              <form method="POST" action={formAction}>
                {pemChecksum ? (
                  <Alert
                    type="success"
                    alertMessage={
                      <div className="d-flex">
                        <div className="flex-fill pe-1">
                          <i className="bi bi-filetype-key fs-4 pe-1"></i>
                          Current public key PEM file MD5 checksum:{" "}
                          <em>{pemChecksum}</em>
                        </div>
                        <div className="flex-shrink-0">
                          <button
                            className="btn btn-danger"
                            type="submit"
                            name="action"
                            value="remove"
                            disabled={pending || !pemChecksum}
                          >
                            Remove key
                          </button>
                        </div>
                      </div>
                    }
                  />
                ) : (
                  <></>
                )}
                <label htmlFor="public-key-upload" className="form-label">
                  Select a crypt4gh public key to upload:
                </label>
                <input
                  id="public-key-upload"
                  name="pemFile"
                  type="file"
                  accept=".pub,text/plain"
                  className="form-control mb-3"
                />
                <label htmlFor="public-key-upload" className="form-label">
                  ...or Input PEM file content:
                </label>
                <textarea
                  className="form-control mb-3"
                  placeholder="Public key PEM file content."
                  id="public-key-input"
                  name="pemKey"
                />
                {"errors" in state ? (
                  state.errors.map((error, index) => (
                    <Alert
                      type="warning"
                      iconClass="bi bi-exclamation-triangle-fill"
                      alertMessage={error}
                      key={index}
                    />
                  ))
                ) : (
                  <></>
                )}
                {"messages" in state ? (
                  state.messages.map((message, index) => (
                    <Alert
                      type="success"
                      iconClass="bi bi-check-circle-fill"
                      alertMessage={message}
                      key={index}
                    />
                  ))
                ) : (
                  <></>
                )}
                <button
                  className="btn btn-primary me-2"
                  type="submit"
                  name="action"
                  value="submit"
                  disabled={pending}
                >
                  Submit key
                </button>
              </form>
            </section>
          ) : (
            <></>
          )}
        </div>
      </div>
    </div>
  );
}
