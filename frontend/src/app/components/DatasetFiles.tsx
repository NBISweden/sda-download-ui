"use client";

import { useState, useMemo, useEffect, ReactNode } from "react";
import { type DatasetFile } from "../actions/datasets";
import Pagination from "./Pagination";
import { Table } from "./Table";

type DatasetFilesProps = {
  files: DatasetFile[];
  itemsPerPage?: number;
};

type FileTableRow = {
  fileId: string;
  filePath: string;
  decryptedSize: number;
  checksums: string;
  downloadUrl: ReactNode;
};

export default function DatasetFiles({
  files,
  itemsPerPage = 10,
}: DatasetFilesProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [tableFiles, setTableFiles] = useState<FileTableRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const formattedFiles = files.map((file) => ({
      fileId: file.fileId,
      filePath: file.filePath,
      decryptedSize: file.decryptedSize,
      checksums: file.checksums.map((c) => c.checksum).join(","),
      downloadUrl: <a href={file.downloadUrl}>Download file</a>,
    }));
    setTableFiles(formattedFiles);
  }, []);

  const filteredFiles = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return tableFiles;
    }

    return tableFiles.filter((file) => {
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
  }, [tableFiles, searchTerm]);

  const totalPages = Math.ceil(files.length / itemsPerPage);

  const currentFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredFiles.slice(startIndex, endIndex);
  }, [filteredFiles, currentPage, itemsPerPage]);

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  }

  return (
    <>
      <div className="input-group col-12 mb-3">
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
