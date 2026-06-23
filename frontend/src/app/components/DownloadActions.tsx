"use client";

import { useState } from "react";
import { ModalDialog } from "@/app/components/ModalDialog";

type DownloadActionsProps = {
  datasetId: string;
};

export function DownloadActions(datasetId: DownloadActionsProps) {
  const [copied, setCopied] = useState(false);
  const command = `sda-cli --config <configuration_file> download \\
  --pubkey <public-key-file> \\
  --dataset-id ${datasetId} \\
  --url <downloadServiceUrl> \\
  --outdir <outdir> \\
  --dataset`;

  const copyCommand = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
  };

  return (
    <>
      <div className="dropdown">
        <button
          className="btn btn-secondary dropdown-toggle"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          Download options
        </button>
        <ul className="dropdown-menu">
          <li>
            <button
              type="button"
              className="dropdown-item"
              data-bs-toggle="modal"
              data-bs-target="#cliModal"
            >
              Download via sda-cli
            </button>
          </li>
          <li>
            <a className="dropdown-item" href="#">
              Another action
            </a>
          </li>
          <li>
            <a className="dropdown-item" href="#">
              Something else here
            </a>
          </li>
        </ul>
      </div>
      <ModalDialog
        id="cliModal"
        title="Download via sda-cli command"
        body={command}
        action={copyCommand}
        iconClass={copied ? "bi-clipboard-check": "bi-copy" }
        actionButtonLabel="Copy command"/>
    </>
  );
}
