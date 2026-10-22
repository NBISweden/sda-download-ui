"use client";

import { useState } from "react";
import { ModalDialog, useModalTrigger } from "@/app/components/ModalDialog";
import DropdownButton from "./DropdownButton";
import { DatasetFile } from "../actions/datasets";
import {
  createChecksumFileContent,
  downloadTextFile,
  pickChecksumType,
} from "../actions/checksums";
import { useFSABatchDownload } from "./FileSystemAccessBatchDownloadContext";
import { useFileSystemAccessSupported } from "./FileSystemAccessBatchDownloadActions";

type CLIDownloadModalProps = {
  id: string;
  datasetId: string;
};

function CLIDownloadModal({ datasetId, id }: CLIDownloadModalProps) {
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
        After copying the command replace the values inside angle brackets, such
        as <code>&lt;configuration_file&gt;</code>,{" "}
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
    <ModalDialog
      id={id}
      title="Download via sda-cli command"
      body={modalBody}
      buttons={[
        {
          label: "Copy command",
          action: copyCommand,
          iconClass: copied ? "bi-clipboard-check" : "bi-copy",
        },
      ]}
    />
  );
}

type DownloadActionsProps = {
  datasetId: string;
  files: DatasetFile[];
  canDownload: boolean;
};

export function DownloadActions({
  datasetId,
  files,
  canDownload,
}: DownloadActionsProps) {
  const [modalTrigger, modalId] = useModalTrigger();

  const checksumType: "sha256" | "md5" | null = pickChecksumType(files || []);
  const handleChecksumDownload = () => {
    if (!checksumType) return;

    const content = createChecksumFileContent(files, checksumType);
    downloadTextFile(content, `${datasetId}_checksums.${checksumType}`);
  };

  const downloadContext = useFSABatchDownload();
  const supportsFileSystemAccess = useFileSystemAccessSupported();
  const downloadAll =
    canDownload && "startDownload" in downloadContext
      ? () => {
          downloadContext.startDownload(files);
        }
      : undefined;

  return (
    <>
      <DropdownButton
        label="Download options"
        items={[
          {
            label: "Download via CLI",
            onClick: () => modalTrigger(),
            disabled: false,
          },
          ...(supportsFileSystemAccess
            ? [
                {
                  label: "Download to folder",
                  onClick: downloadAll,
                  disabled: !downloadAll,
                },
              ]
            : []),
          {
            label: "Download checksums",
            onClick: handleChecksumDownload,
            disabled: !checksumType,
          },
        ]}
      />
      <CLIDownloadModal datasetId={datasetId} id={modalId} />
    </>
  );
}
