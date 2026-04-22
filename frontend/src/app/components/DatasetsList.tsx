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
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border rounded bg-body-tertiary">
          <span className="text-body-secondary">
            Viewing{" "}
            <strong>
              {startItem}-{endItem}
            </strong>{" "}
            of <strong>{datasets.length}</strong>
          </span>
          <span className="badge text-bg-light">
            {datasets.length} datasets
          </span>
        </div>
      </div>

      {currentDatasets.map((dataset) => (
        <div className="col col-lg-4 p-2" key={dataset.datasetId}>
          <div className="card">
            <h5 className="card-header">{dataset.datasetId}</h5>

            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                {new Date(dataset.date).toLocaleDateString("sv-SE")}
              </li>
              <li className="list-group-item">
                {dataset.files} <em>files</em>
              </li>
              <li className="list-group-item">
                <em>Dataset size is</em> {dataset.size}
              </li>
            </ul>

            <div className="card-body">
              <a className="btn bg-primary-subtle text-break" href="">
                View dataset {dataset.datasetId}
              </a>
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
