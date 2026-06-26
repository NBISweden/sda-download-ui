import { DatasetMetadata, DatasetFile } from "../actions/datasets";
import DownloadChecksumsButton from "./DownloadChecksumsButton";
import { DownloadActions } from "@/app/components/DownloadActions";
import DatasetSize from "./DatasetSize";
import { formatDatasetDate, formatFileCount } from "../lib/datasetFormat";

type DatasetDetailsProps = {
  dataset: DatasetMetadata;
  files: DatasetFile[];
};

export default function DatasetDetails({
  dataset: dataset,
  files: files,
}: DatasetDetailsProps) {
  return (
    <>
      <div className="card px-0 col-12 col-lg-6">
        <div className="card-header">
          <h3 className="card-title m-3">Dataset {dataset.datasetId}</h3>
        </div>
        <div className="card-body mx-3 mb-2">
          <div className="d-flex">
            <div className="d-flex flex-column flex-grow-1 align-items-start mb-4 mb-sm-0">
              <div className="d-flex fs-1">
                <p className="mb-1">{formatFileCount(dataset.files)}</p>
              </div>
              <DatasetSize size={dataset.size} className="fs-5" />
            </div>
            <span
              className="d-inline-flex align-self-start mb-3 px-2 py-1 text-secondary-emphasis
            bg-secondary-subtle border border-secondary-subtle rounded-1"
            >
              <i className="bi bi-calendar fs-6 pe-1"></i>
              Created {formatDatasetDate(dataset.date)}
            </span>
          </div>
          <div className="d-flex justify-content-start mt-3">
            <DownloadActions datasetId={dataset.datasetId} />
            <DownloadChecksumsButton
              files={files}
              datasetId={dataset.datasetId}
            />
          </div>
        </div>
      </div>
    </>
  );
}
