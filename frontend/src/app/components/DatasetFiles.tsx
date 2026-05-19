"use client";

import { useState, useMemo } from "react";
import { type DatasetFile } from "../actions/datasets";
import Pagination from "./Pagination";
import { Table } from "./Table";
import { filesize } from "filesize";
import { ClipboardValue } from "./ClipboardValue";

type DatasetFilesProps = {
  files: DatasetFile[];
  itemsPerPage: number;
};

export default function DatasetFiles({
  files,
  itemsPerPage = 10,
}: DatasetFilesProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(),
  );

  const formattedFiles = files.map((file) => ({
    fileId: file.fileId,
    filePath: file.filePath,
    decryptedSize: filesize(file.decryptedSize),
    checksums: file.checksums.map((c) => (
      <ClipboardValue key={c.checksum} value={c.checksum} label={c.type} />
    )),

    downloadUrl: <a href={file.downloadUrl}>Download file</a>,
  }));

  const filteredFiles = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return formattedFiles;
    }

    return formattedFiles.filter((file) => {
      const searchableMetadata = [
        file.fileId,
        file.filePath,
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

  const clearSelection = () => {
    setSelectedFileIds(new Set());
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
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={selectCurrentPage}
            disabled={currentFiles.length === 0}
          >
            Select visible files
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={clearSelection}
            disabled={selectedFileIds.size === 0}
          >
            Clear selection
          </button>
        </div>
        <div>
          <strong>{selectedFileIds.size}</strong>{" "}
          {selectedFileIds.size === 1 ? "file selected" : "files selected"}
        </div>
      </div>

      <Pagination
        itemsPerPage={itemsPerPage}
        totalItems={filteredFiles.length}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
      {currentFiles.length > 0 && (
        <Table
          data={currentFiles}
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
