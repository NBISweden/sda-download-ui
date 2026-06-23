"use client";

type DownloadActionsProps = {
  datasetId: string;
};

export function DownloadActions(datasetId: DownloadActionsProps) {
  const command = `sda-cli --config <configuration_file> download \\
  --pubkey <public-key-file> \\
  --dataset-id ${datasetId} \\
  --url <downloadServiceUrl> \\
  --outdir <outdir> \\
  --dataset`;

  const copyCommand = () => {
    navigator.clipboard.writeText(command);
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-primary me-3"
        data-bs-toggle="modal"
        data-bs-target="#cliModal"
      >
        Download via sda-cli
      </button>

      <div
        className="modal fade"
        id="cliModal"
        tabIndex="-1"
        aria-labelledby="cliModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="cliModalLabel">
                Download via sda-cli command
              </h1>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">{command}</div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                data-bs-dismiss="modal"
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={copyCommand}
              >
                <i className="bi bi-copy"></i>Copy command
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
