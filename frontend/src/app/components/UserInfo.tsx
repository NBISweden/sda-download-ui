import type {
  TokenHeaderRow,
  TokenPayloadRow,
} from "@/app/(pages)/userinfo/page";

type UserInfoProps = {
  userName: string;
  payloadRows: TokenPayloadRow[];
  headerRows: TokenHeaderRow[];
};

export default function UserInfo({
  userName,
  payloadRows,
  headerRows,
}: UserInfoProps) {
  return (
    <div className="col-12 col-xl-8">
      <div className="card shadow-sm">
        <div className="card-body">
          <h3 className="h4 mb-3">User {userName}</h3>
          <h4 className="h5 mb-3">Token</h4>

          <section className="mb-4">
            <h5 className="h6">Payload</h5>
            <div className="table-responsive">
              <table className="table table-striped table-bordered align-middle">
                <thead>
                  <tr>
                    <th scope="col">Param</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {payloadRows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-4">
            <h5 className="h6">Header</h5>
            <div className="table-responsive">
              <table className="table table-striped table-bordered align-middle">
                <thead>
                  <tr>
                    <th scope="col">Param</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {headerRows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h5 className="h6">Set public encryption key</h5>
            <label htmlFor="public-key-upload" className="form-label">
              Select a public key to upload:
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
