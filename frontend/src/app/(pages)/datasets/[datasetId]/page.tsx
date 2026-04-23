import {
  fetchDatasetMetadata,
  type DatasetMetadata,
} from "../../../actions/datasets";
import { getSession } from "@/app/lib/session";

interface DatasetDetailsViewProps {
  params: Promise<{
    datasetId: string;
  }>;
}

export default async function DatasetDetailsView({
  params,
}: DatasetDetailsViewProps) {
  const { datasetId } = await params;
  console.log(datasetId);

  const sessionData = await getSession();
  const token = sessionData?.token;

  let errorMessage: string | null = null;
  let metadata: DatasetMetadata | null = null;

  if (!token) {
    return <p>No token found in session.</p>;
  } else {
    try {
      metadata = await fetchDatasetMetadata(token, datasetId);
      console.log("metadata", metadata);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";

      errorMessage = message.includes("fetch failed")
        ? "Could not connect to backend. Is it running?"
        : `Could not load datasets: ${message}`;
    }
  }
  return (
    <main>
      <div className="container">
        <h2 className="my-3">Dataset details</h2>
        <div className="row">
          {errorMessage ? (
            <div className="alert alert-warning" role="alert">
              <i className="bi bi-exclamation-triangle-fill fs-4 pe-1"></i>
              {errorMessage}
            </div>
          ) : !metadata ? (
            <div className="alert alert-info" role="alert">
              <i className="bi bi-info-circle-fill fs-4 pe-1"></i>
              Information on the dataset couln't be loaded.
            </div>
          ) : (
            <p>{metadata.datasetId}</p>
          )}
        </div>
      </div>
    </main>
  );
}
