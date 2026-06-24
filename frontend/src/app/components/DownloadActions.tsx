"use client";

import { useState } from "react";
import { ModalDialog } from "@/app/components/ModalDialog";
import DropdownButton from "@/app/components/DropdownButton";

type DownloadActionsProps = {
  datasetId: string;
};

export function DownloadActions({ datasetId }: DownloadActionsProps) {
  const [copied, setCopied] = useState(false);
  const command = [
    "sda-cli --config <configuration_file> download \\",
    "--pubkey <public-key-file> \\",
    `--dataset-id ${datasetId} \\`,
    "--url <download-service-url> \\",
    "--outdir <outdir> \\",
    "--dataset",
  ].join("\n");

  const modalBody = (
    <>
      <p>
        Use this command to download the full dataset with <code>sda-cli</code>.
        The command assumes that credentials from <strong>SDA Login</strong> are
        available in your config file.
      </p>

      <p>
        After copying the command replace the values inside angle brackets,
          such as{" "}
        <code>&lt;configuration_file&gt;</code>,{" "}
        <code>&lt;public-key-file&gt;</code>,{" "}
        <code>&lt;download-service-url&gt;</code>, and{" "}
        <code>&lt;outdir&gt;</code>, with paths or values for your local setup.
      </p>
      <pre className="p-3 mb-2 bg-light rounded">
        <code>{command}</code>
      </pre>
    </>
  );

  const copyCommand = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);

    // Time out so that the button icon will go back to a copy symbol
    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };

  return (
    <>
      <DropdownButton
        label="Download options"
        className="btn btn-outline-primary dropdown-toggle me-3"
        items={[
          {
            label: "Download via sda-cli",
            modalTarget: "#cliModal",
          },
        ]}
      />
      <ModalDialog
        id="cliModal"
        title="Download via sda-cli command"
        body={modalBody}
        action={copyCommand}
        iconClass={copied ? "bi-clipboard-check" : "bi-copy"}
        actionButtonLabel="Copy command"
      />
    </>
  );
}
