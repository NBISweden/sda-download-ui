import type { TokenInfoRow } from "@/app/(pages)/userinfo/page";

type UserInfoProps = {
  userName: string;
  tokenInfoRows: TokenInfoRow[];
};

export default function UserInfo({
  userName,
  tokenInfoRows,
}: UserInfoProps) {
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

          <section>
            <h4 className="h5 mb-3">Crypt4gh public encryption key</h4>
            <label htmlFor="public-key-upload" className="form-label">
              Select a crypt4gh public key to upload:
            </label>
            <input
              id="public-key-upload"
              type="file"
              className="form-control"
              disabled
            />
          </section>
        </div>
      </div>
    </div>
  );
}
