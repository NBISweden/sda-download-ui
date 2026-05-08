"use client";

import { useMemo, useState } from "react";
import Pagination from "@/app/components/Pagination";
import type { DatasetMetadata } from "../actions/datasets";

type DatasetsListProps = {
  datasets: DatasetMetadata[];
  itemsPerPage: number;
};

export default function DatasetsList({
  datasets,
  itemsPerPage = 10,
}: DatasetsListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDatasets = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return datasets;
    }

    return datasets.filter((dataset) => {
      const formattedDate = new Date(dataset.date).toLocaleDateString("sv-SE");

      const searchableMetadata = [
        dataset.datasetId,
        dataset.date,
        formattedDate,
        dataset.files,
        dataset.size,
      ]
        .join(" ")
        .toLowerCase();

      return searchableMetadata.includes(normalizedSearchTerm);
    });
  }, [datasets, searchTerm]);

  const totalPages = Math.ceil(filteredDatasets.length / itemsPerPage);

  const currentDatasets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredDatasets.slice(startIndex, endIndex);
  }, [filteredDatasets, currentPage, itemsPerPage]);

  const startItem =
    filteredDatasets.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredDatasets.length);

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  }

  return (
    <>
      <div className="input-group col-12 mb-3">
        <label
          htmlFor="dataset-filter"
          className="input-group-text text-success-emphasis
                bg-success border border-success"
        >
          Filter datasets
        </label>
        <input
          id="dataset-filter"
          type="search"
          className="form-control"
          placeholder="Search by dataset ID, date, number of files or size"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredDatasets.length}
          itemsPerPage={itemsPerPage}
        />
      )}

      {filteredDatasets.length === 0 ? (
        <div className="col-12">
          <div className="alert alert-warning" role="alert">
            <i className="bi bi-exclamation-triangle-fill fs-4 pe-1"></i>
            No datasets match your search.
          </div>
        </div>
      ) : (
        currentDatasets.map((dataset) => (
          <div className="col col-lg-4 p-2" key={dataset.datasetId}>
            <div className="card shadow-sm">
              <div className="card-body d-flex flex-column">
                <div className="d-flex justify-content-between">
                  <h3 className="card-title h5">{dataset.datasetId} </h3>
                  <span
                    className="d-inline-flex mb-3 px-2 py-1 text-secondary-emphasis
                bg-secondary-subtle border border-secondary-subtle rounded-1"
                  >
                    <i className="bi bi-files fs-6 pe-1"></i>
                    {dataset.files} {dataset.files === 1 ? "file" : "files"}
                  </span>
                </div>
                <div className="d-flex flex-wrap justify-content-between mb-3 text-muted">
                  <span>
                    <i className="bi bi-calendar pe-1"></i>Created{" "}
                    {new Date(dataset.date).toLocaleDateString("sv-SE")}
                  </span>
                  <span>{dataset.size} bytes</span>
                </div>
                <div className="text-left">
                  <a
                    className="btn btn-secondary"
                    href={`/datasets/${dataset.datasetId}`}
                  >
                    View dataset
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredDatasets.length}
          itemsPerPage={itemsPerPage}
        />
      )}
    </>
  );
}
