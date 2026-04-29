import { DatasetMetadata } from "../actions/datasets";

type DatasetDetailsProps = {
  dataset: DatasetMetadata;
};

export default function DatasetDetails({
  dataset: dataset,
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
                <p className="mb-1">
                  {dataset.files} {dataset.files === 1 ? "file" : "files"}
                </p>
              </div>
              <p className="fs-5">{dataset.size} bytes</p>
            </div>
            <span
              className="d-inline-flex align-self-start mb-3 px-2 py-1 text-secondary-emphasis
            bg-secondary-subtle border border-secondary-subtle rounded-1"
            >
              <i className="bi bi-calendar fs-6 pe-1"></i>
              Created {new Date(dataset.date).toLocaleDateString("sv-SE")}
            </span>
          </div>
          <div className="d-flex justify-content-start mt-3">
            <button className="btn btn-primary align-self-start me-3">
              Download dataset
            </button>
            <button className="btn btn-primary align-self-start">
              Download checksums
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
