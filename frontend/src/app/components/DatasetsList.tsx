"use client";

import { useMemo, useState } from "react";
import Pagination from "@/app/components/Pagination";
import type { DatasetMetadata } from "../actions/datasets";

type DatasetsListProps = {
  datasets: DatasetMetadata[];
  itemsPerPage?: number;
};

export default function DatasetsList({
  datasets,
  itemsPerPage = 6,
}: DatasetsListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(datasets.length / itemsPerPage);

  const currentDatasets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return datasets.slice(startIndex, endIndex);
  }, [datasets, currentPage, itemsPerPage]);

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, datasets.length);

  return (
    <>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
      <div className="col-12 mb-3">
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border border-info-subtle bg-info-subtle rounded ">
          <span className="text-body-secondary">
            Viewing{" "}
            <strong>
              {startItem}-{endItem}
            </strong>{" "}
            of <strong>{datasets.length}</strong>
          </span>
          <span className="text-muted fw-light">
            Total of {datasets.length} datasets
          </span>
        </div>
      </div>

      {currentDatasets.map((dataset) => (
        <div className="col col-lg-4 p-2" key={dataset.datasetId}>
          <div className="card">
            <div className="card-body d-flex flex-column">
              <div className="d-flex justify-content-between">
                <h3 className="card-title h5">{dataset.datasetId} </h3>
                <span
                  className="d-inline-flex mb-3 px-2 py-1 text-secondary-emphasis
                bg-secondary-subtle border border-secondary-subtle rounded-1"
                >
                  <i className="bi bi-files fs-6 pe-1"></i>
                  {dataset.files} {dataset.files == "1" ? "file" : "files"}
                </span>
              </div>
              <div className="d-flex flex-wrap justify-content-between mb-3 text-muted">
                <span>
                  <i className="bi bi-calendar-fill pe-1"></i>Created{" "}
                  {new Date(dataset.date).toLocaleDateString("sv-SE")}
                </span>
                <span>
                  <i className="bi bi-aspect-ratio-fill pe-1"></i>
                  {dataset.size} bytes
                </span>
              </div>
              <div className="text-left">
                <a className="btn dataset-button" href="">
                  View dataset
                </a>
              </div>
            </div>
          </div>
        </div>
      ))}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </>
  );
}
