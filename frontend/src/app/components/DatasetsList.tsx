"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Pagination from "@/app/components/Pagination";
import type { DatasetMetadata } from "../actions/datasets";
import Alert from "@/app/components/Alert";
import { ItemSelector, useItemsPerPage } from "./ItemsPerPage";
import { Table } from "./Table";
import DatasetCard from "./DatasetCard";
import DatasetSize from "./DatasetSize";
import { formatDatasetDate, formatFileCount } from "../lib/datasetFormat";

type ViewMode = "card" | "table";

const viewOptions: { mode: ViewMode; icon: string; label: string }[] = [
  { mode: "card", icon: "bi-grid", label: "Cards" },
  { mode: "table", icon: "bi-list-ul", label: "List" },
];

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
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  const filteredDatasets = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return datasets;
    }

    return datasets.filter((dataset) => {
      const formattedDate = formatDatasetDate(dataset.date);

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

  const tableRows = useMemo(
    () =>
      currentDatasets.map((dataset) => ({
        datasetId: dataset.datasetId,
        date: formatDatasetDate(dataset.date),
        files: formatFileCount(dataset.files),
        size: <DatasetSize size={dataset.size} />,
        action: (
          <Link
            className="btn btn-secondary btn-sm"
            href={`/datasets/${dataset.datasetId}`}
          >
            View dataset
          </Link>
        ),
      })),
    [currentDatasets],
  );

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  }

  const viewToggle = (
    <div className="col-12 d-flex justify-content-end mb-3">
      <div className="btn-group" role="group" aria-label="Toggle dataset view">
        {viewOptions.map(({ mode, icon, label }) => (
          <button
            key={mode}
            type="button"
            className={`btn btn-outline-secondary ${
              viewMode === mode ? "active" : ""
            }`}
            aria-pressed={viewMode === mode}
            onClick={() => setViewMode(mode)}
          >
            <i className={`bi ${icon} pe-1`}></i>
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="input-group col-12 mb-3">
        <label
          htmlFor="dataset-filter"
          className="input-group-text text-success-emphasis
                bg-success-subtle border "
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
      {viewToggle}
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
      ) : viewMode === "table" ? (
        <div className="col-12">
          <Table
            data={tableRows}
            columns={["datasetId", "date", "files", "size", "action"]}
            headers={{
              datasetId: "Dataset ID",
              date: "Created",
              files: "Number of files",
              size: "Dataset size",
              action: " ",
            }}
          />
        </div>
      ) : (
        currentDatasets.map((dataset) => (
          <DatasetCard key={dataset.datasetId} dataset={dataset} />
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
