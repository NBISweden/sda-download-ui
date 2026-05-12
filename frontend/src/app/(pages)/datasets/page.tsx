import {
  fetchDatasets,
  fetchDatasetMetadata,
  type DatasetMetadata,
} from "../../actions/datasets";
import { getSession } from "@/app/lib/session";
import DatasetsList from "../../components/DatasetsList";
import Alert from "@/app/components/Alert";

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
            <div className="col-12 col-lg-6">
              <Alert
                type="warning"
                alertMessage={errorMessage}
                iconClass="bi bi-exclamation-triangle-fill"
              />
            </div>
          ) : datasetMetadataList.length === 0 ? (
            <div className="col-12 col-lg-6">
              <Alert
                type="info"
                alertMessage="No datasets were found."
                iconClass="bi bi-info-circle-fill"
              />
            </div>
          ) : (
            <DatasetsList datasets={datasetMetadataList} itemsPerPage={15} />
          )}
        </div>
      </div>
    </main>
  );
}
