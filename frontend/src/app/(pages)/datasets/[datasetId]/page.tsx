import {
  fetchDatasetMetadata,
  type DatasetMetadata,
  type DatasetFile,
  fetchDatasetFiles,
} from "../../../actions/datasets";
import { getSession } from "@/app/lib/session";
import DatasetDetails from "../../../components/DatasetDetails";
import DatasetFiles from "@/app/components/DatasetFiles";

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
  let dataset: DatasetMetadata | null = null;
  let files: DatasetFile[] = [];

  if (!token) {
    return <p>No token found in session.</p>;
  }

  try {
    dataset = await fetchDatasetMetadata(token, datasetId);
    console.log("metadata", dataset);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    errorMessage = message.includes("fetch failed")
      ? "Could not connect to backend. Is it running?"
      : `Could not load dataset metadata: ${message}`;
  }

  try {
    const response = await fetchDatasetFiles(token, datasetId);
    files = response.files;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error occured";

    errorMessage = message.includes("fetch failed")
      ? "Could not connect to backend. Is it running?"
      : `Cound not load dataset files: ${message}`;
  }

  return (
    <main>
      <div className="container">
        <div className="row">
          {errorMessage ? (
            <div className="alert alert-warning" role="alert">
              <i className="bi bi-exclamation-triangle-fill fs-4 pe-1"></i>
              {errorMessage}
            </div>
          ) : !dataset ? (
            <div className="alert alert-info" role="alert">
              <i className="bi bi-info-circle-fill fs-4 pe-1"></i>
              Information on the dataset couln't be loaded.
            </div>
          ) : (
            <DatasetDetails dataset={dataset} />
          )}
        </div>
      </div>
      <div className="container mt-5 px-0">
        <h3>Files</h3>
        <DatasetFiles files={files} />
      </div>
    </main>
  );
}
