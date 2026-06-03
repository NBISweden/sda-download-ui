"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Pagination from "@/app/components/Pagination";
import type { DatasetMetadata } from "../actions/datasets";
import Alert from "@/app/components/Alert";
import { filesize } from "filesize";
import { ItemSelector, useItemsPerPage } from "./ItemsPerPage";
import InfoTooltip from "./InfoTooltip";

type DatasetsListProps = {
  datasets: DatasetMetadata[];
  defaultItemsPerPage: number;
};

export default function DatasetsList({
  datasets,
  defaultItemsPerPage = 15,
}: DatasetsListProps) {
  const { itemsPerPage, setItemsPerPage, itemsPerPageOptions } =
    useItemsPerPage(defaultItemsPerPage);
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
      <ItemSelector
        item={itemsPerPage}
        setItem={(i) => {
          setItemsPerPage(i);
          setCurrentPage(1);
        }}
        items={itemsPerPageOptions}
        label="Items per page"
      />
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
          <Alert
            type="warning"
            alertMessage="No datasets match your search."
            iconClass="bi bi-exclamation-triangle-fill"
          />
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
                  <InfoTooltip
                    content={`${dataset.size.toLocaleString("en-GB")} bytes`}
                  >
                    <span className="text-muted" tabIndex={0}>
                      {filesize(dataset.size)}
                    </span>
                  </InfoTooltip>
                </div>
                <div className="text-left">
                  <Link
                    className="btn btn-secondary"
                    href={`/datasets/${dataset.datasetId}`}
                  >
                    View dataset
                  </Link>
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
