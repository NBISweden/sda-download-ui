import { DatasetMetadata } from "../actions/datasets";

type DatasetDetailsProps = {
  dataset: DatasetMetadata;
};

export default function DatasetDetails({
  dataset: dataset,
}: DatasetDetailsProps) {
  return (
    <>
      <p className="fst-italics">
        Created {new Date(dataset.date).toLocaleDateString("sv-SE")}
      </p>
      <div className="card p-5 bg-light col-12 col-lg-6">
        <div className="card-body d-flex flex-column-reverse flex-sm-row">
          <div className="d-flex flex-column justify-content-evenly flex-grow-1">
            <button className="btn btn-primary align-self-start mb-3">
              Download dataset
            </button>
            <button className="btn btn-primary align-self-start">
              Download checksums
            </button>
          </div>
          <div className="d-flex flex-column flex-grow-1 align-items-start mb-4 mb-sm-0">
            <div className="d-flex fs-3">
              <i className="bi bi-files me-2" />
              <p className="mb-1">{dataset.files} files</p>
            </div>
            <p className="fs-5">{dataset.size} bytes</p>
          </div>
        </div>
      </div>
    </>
  );
}
