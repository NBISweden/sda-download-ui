"use client";

import { useState, useMemo } from "react";
import { type DatasetFile } from "../actions/datasets";
import Pagination from "./Pagination";
import { Table } from "./Table";
import { filesize } from "filesize";
import { ClipboardValue } from "./ClipboardValue";
import InfoTooltip from "./InfoTooltip";
import { ItemSelector, useItemsPerPage } from "./ItemsPerPage";
import { ChecksumExportActions } from "./ChecksumExportActions";
import { BatchDownloadActions } from "./BatchDownloadActions";

type DatasetFilesProps = {
  files: DatasetFile[];
  defaultItemsPerPage: number;
  canDownload?: boolean;
  datasetId: string;
};

export default function DatasetFiles({
  files,
  defaultItemsPerPage = 15,
  canDownload = true,
  datasetId,
}: DatasetFilesProps) {
  const { itemsPerPage, setItemsPerPage, itemsPerPageOptions } =
    useItemsPerPage(defaultItemsPerPage);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(),
  );

  const formattedFiles = files.map((file) => ({
    fileId: file.fileId,
    rawFilePath: file.filePath,
    filePath: (
      <ClipboardValue
        value={file.filePath}
        ariaLabel={`Copy ${file.filePath} to clipboard`}
      >
        <InfoTooltip content={file.filePath} monospace>
          <span className="clipboard-value-truncate" tabIndex={0}>
            {file.filePath}
          </span>
        </InfoTooltip>
      </ClipboardValue>
    ),
    decryptedSize: filesize(file.decryptedSize),
    checksums: file.checksums.map((c) => (
      <ClipboardValue
        key={c.checksum}
        value={c.checksum}
        ariaLabel={`Copy ${c.type} to clipboard`}
      >
        <InfoTooltip content={c.checksum} monospace>
          <em tabIndex={0}>{c.type}</em>
        </InfoTooltip>
      </ClipboardValue>
    )),

    downloadUrl: canDownload ? (
      <a
        href={`/api/files/${encodeURIComponent(file.fileId)}?name=${encodeURIComponent(file.filePath)}`}
        download
        target="_blank"
        rel="noopener noreferrer"
      >
        Download file
      </a>
    ) : (
      <span
        className="text-muted"
        title="Upload your Crypt4GH public key on the profile page to enable downloads."
      >
        Download file
      </span>
    ),
  }));

  const filteredFiles = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return formattedFiles;
    }

    return formattedFiles.filter((file) => {
      const searchableMetadata = [
        file.fileId,
        file.rawFilePath,
        file.decryptedSize,
        file.checksums,
      ]
        .join(" ")
        .toLowerCase();

      return searchableMetadata.includes(normalizedSearchTerm);
    });
  }, [formattedFiles, searchTerm]);

  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);

  const currentFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredFiles.slice(startIndex, endIndex);
  }, [filteredFiles, currentPage, itemsPerPage]);

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  }
  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((previousSelectedIds) => {
      const nextSelectedIds = new Set(previousSelectedIds);

      if (nextSelectedIds.has(fileId)) {
        nextSelectedIds.delete(fileId);
      } else {
        nextSelectedIds.add(fileId);
      }

      return nextSelectedIds;
    });
  };

  const selectCurrentPage = () => {
    setSelectedFileIds((previousSelectedIds) => {
      const nextSelectedIds = new Set(previousSelectedIds);

      currentFiles.forEach((file) => {
        nextSelectedIds.add(file.fileId);
      });

      return nextSelectedIds;
    });
  };

  const allCurrentPageFilesSelected =
    currentFiles.length > 0 &&
    currentFiles.every((file) => selectedFileIds.has(file.fileId));

  const handleSelectionButtonClick = () => {
    if (allCurrentPageFilesSelected) {
      setSelectedFileIds(new Set());
    } else {
      selectCurrentPage();
    }
  };

  return (
    <>
      <div className="input-group col-12 my-3">
        <label
          htmlFor="file-filter"
          className="input-group-text text-success-emphasis
                bg-success border border-success"
        >
          Filter files
        </label>
        <input
          id="file-filter"
          type="search"
          className="form-control"
          placeholder="Search by file ID, path, checksums or decrypted size"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      <ItemSelector
        item={itemsPerPage}
        setItem={(i) => {
          setItemsPerPage(i);
          setCurrentPage(1);
        }}
        items={itemsPerPageOptions}
        label="Items per page"
      />
      <Pagination
        itemsPerPage={itemsPerPage}
        totalItems={filteredFiles.length}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
      <div className="d-flex justify-content-start align-items-center mb-3 gap-3">
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-secondary selection-button"
            onClick={handleSelectionButtonClick}
            disabled={currentFiles.length === 0}
          >
            {allCurrentPageFilesSelected
              ? "Clear selection"
              : "Select visible files"}
          </button>
        </div>
        <div className="selection-info">
          <strong>{selectedFileIds.size}</strong>{" "}
          {selectedFileIds.size === 1 ? "file selected" : "files selected"}
        </div>
        <BatchDownloadActions
          selectedFileIds={selectedFileIds}
          datasetId={datasetId}
          canDownload={canDownload}
        />
        <ChecksumExportActions
          files={files}
          selectedFileIds={selectedFileIds}
          datasetId={datasetId}
        />
      </div>
      {currentFiles.length > 0 && (
        <Table
          data={currentFiles}
          columns={[
            "fileId",
            "filePath",
            "decryptedSize",
            "checksums",
            "downloadUrl",
          ]}
          getRowId={(file) => file.fileId}
          selectedIds={selectedFileIds}
          onToggleRow={toggleFileSelection}
          headers={{
            fileId: "File ID",
            filePath: "Path",
            decryptedSize: "Decrypted size",
            checksums: "Checksums",
            downloadUrl: " ",
          }}
        />
      )}
      <Pagination
        itemsPerPage={itemsPerPage}
        totalItems={filteredFiles.length}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </>
  );
}
