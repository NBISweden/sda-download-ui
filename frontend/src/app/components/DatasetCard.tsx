import Link from "next/link";
import type { DatasetMetadata } from "../actions/datasets";
import DatasetSize from "./DatasetSize";
import { formatDatasetDate, formatFileCount } from "../lib/datasetFormat";

type DatasetCardProps = {
  dataset: DatasetMetadata;
};

export default function DatasetCard({ dataset }: DatasetCardProps) {
  return (
    <div className="col col-lg-4 p-2">
      <div className="card shadow-sm">
        <div className="card-body d-flex flex-column">
          <div className="d-flex justify-content-between">
            <h3 className="card-title h5">{dataset.datasetId} </h3>
            <span
              className="d-inline-flex mb-3 px-2 py-1 text-secondary-emphasis
                bg-secondary-subtle border border-secondary-subtle rounded-1"
            >
              <i className="bi bi-files fs-6 pe-1"></i>
              {formatFileCount(dataset.files)}
            </span>
          </div>
          <div className="d-flex flex-wrap justify-content-between mb-3 text-muted">
            <span>
              <i className="bi bi-calendar pe-1"></i>Created{" "}
              {formatDatasetDate(dataset.date)}
            </span>
            <DatasetSize size={dataset.size} />
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
  );
}
