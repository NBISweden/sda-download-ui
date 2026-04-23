import {
  fetchDatasets,
  fetchDatasetMetadata,
  type DatasetMetadata,
} from "../../actions/datasets";
import { getSession } from "@/app/lib/session";
import DatasetsList from "../../components/DatasetsList";

export default async function DataSetsViewPage() {
  const sessionData = await getSession();
  const token = sessionData?.token;

  let errorMessage: string | null = null;
  let datasetMetadataList: DatasetMetadata[] = [];

  if (!token) {
    return <p>No token found in session.</p>;
  } else {
    try {
      const result = await fetchDatasets(token);
      const datasetIds = result.datasets;

      datasetMetadataList = await Promise.all(
        datasetIds.map((datasetId) => fetchDatasetMetadata(token, datasetId)),
      );
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
        <h2 className="my-3">Datasets</h2>
        <div className="row">
          {errorMessage ? (
            <div className="alert alert-warning" role="alert">
              <i className="bi bi-exclamation-triangle-fill fs-4 pe-1"></i>
              {errorMessage}
            </div>
          ) : datasetMetadataList.length === 0 ? (
            <div className="alert alert-info" role="alert">
              <i className="bi bi-info-circle-fill fs-4 pe-1"></i>
              No datasets were found.
            </div>
          ) : (
            <DatasetsList datasets={datasetMetadataList} itemsPerPage={21} />
          )}
        </div>
      </div>
    </main>
  );
}
