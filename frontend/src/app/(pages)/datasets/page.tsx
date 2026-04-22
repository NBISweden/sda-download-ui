import { fetchDatasets, fetchDatasetMetadata, type DatasetMetadata } from "../../actions/datasets";
import { getSession } from "@/app/lib/session";

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
          <h2>Datasets</h2>
          <div className="row">
            {errorMessage ? (
                <div className="alert alert-warning" role="alert"><i className="bi bi-exclamation-triangle-fill fs-4 pe-1"></i>
                  {errorMessage}</div>
            ) : datasetMetadataList.length === 0 ? (
                <p>No datasets found.</p>
            ) : (
                <ul>
                  {datasetMetadataList.map((dataset) => (
                      <li key={dataset.datasetId}>
                        <pre>{JSON.stringify(dataset, null, 2)}</pre>
                      </li>
                  ))}
                </ul>
            )}
          </div>

        </div>

      </main>
  );
}
