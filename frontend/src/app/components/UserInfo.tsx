"use client";
import type { TokenInfoRow } from "@/app/(pages)/userinfo/page";
import { useActionState } from "react";
import type { PublicKeyData } from "../actions/crypt4ghKey";

type UserInfoProps = {
  tokenInfoRows: TokenInfoRow[];
  keyFormAction?: SetKeyFormFunction;
  currentPemChecksum?: string;
};

type SetKeyFormFunction = (
  state: PublicKeyData | { errors: string[] },
  d?: FormData,
) => Promise<PublicKeyData | { errors: string[] }>;

export default function UserInfo({
  tokenInfoRows,
  keyFormAction,
  currentPemChecksum,
}: UserInfoProps) {
  const noAction: SetKeyFormFunction = async () => ({});
  const [state, formAction, pending] = useActionState<
    PublicKeyData | { errors: string[] }
  >(keyFormAction || noAction, { pemChecksum: currentPemChecksum });
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

              {pemChecksum ? (
                <div className="alert alert-success" role="alert">
                  <i className="bi bi-filetype-key fs-4 pe-1"></i>
                  Current public key PEM file MD5 checksum:{" "}
                  <em>{pemChecksum}</em>
                </div>
              ) : (
                <></>
              )}
              <form method="POST" action={formAction}>
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
                    <div
                      className="alert alert-warning"
                      role="alert"
                      key={index}
                    >
                      <i className="bi bi-exclamation-triangle-fill fs-4 pe-1"></i>
                      {error}
                    </div>
                  ))
                ) : (
                  <></>
                )}
                <input
                  className="btn btn-primary"
                  type="submit"
                  value="Set public key"
                  disabled={pending}
                />
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
