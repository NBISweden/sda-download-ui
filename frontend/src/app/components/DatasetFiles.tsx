"use client";

import { useState, useMemo } from "react";
import { type DatasetFile } from "../actions/datasets";
import Pagination from "./Pagination";
import { Table } from "./Table";

type DatasetFilesProps = {
  files: DatasetFile[];
  itemsPerPage?: number;
};

export default function DatasetFiles({
  files,
  itemsPerPage = 10,
}: DatasetFilesProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const tableFiles = files.map((file) => ({
    fileId: file.fileId,
    filePath: file.filePath,
    decryptedSize: file.decryptedSize,
    checksums: file.checksums.map((c) => c.checksum).join(","),
    downloadUrl: <a href={file.downloadUrl}>Download file</a>,
  }));

  const totalPages = Math.ceil(files.length / itemsPerPage);

  const currentFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return tableFiles.slice(startIndex, endIndex);
  }, [tableFiles, currentPage, itemsPerPage]);

  return (
    <>
      <Pagination
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
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </>
  );
}
