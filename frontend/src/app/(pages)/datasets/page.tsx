import {
  fetchDatasets,
  fetchDatasetMetadata,
  type DatasetMetadata,
  fetchAll,
} from "../../actions/datasets";
import { getSession } from "@/app/lib/session";
import DatasetsList from "../../components/DatasetsList";
import Alert from "@/app/components/Alert";
import { LoginButton } from "@/app/components/LoginButton";

export default async function DataSetsViewPage() {
  const sessionData = await getSession();
  const token = sessionData?.token;

  let errorMessage: string | null = null;
  let datasetMetadataList: DatasetMetadata[] = [];

  if (!token) {
    errorMessage = "No token found in session";
  } else {
    try {
      const datasetIds = await fetchAll(async (pageToken) => {
        const page = await fetchDatasets(token, pageToken);
        return { items: page.datasets, nextPageToken: page.nextPageToken };
      });

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
            <>
              <div className="col-12 col-lg-6">
                <Alert
                  type="warning"
                  alertMessage={errorMessage}
                  iconClass="bi bi-exclamation-triangle-fill"
                />
              </div>
              <div className="mt-3">
                <LoginButton buttonText="Sign in again" />
              </div>
            </>
          ) : datasetMetadataList.length === 0 ? (
            <div className="col-12 col-lg-6">
              <Alert
                type="info"
                alertMessage="No datasets were found."
                iconClass="bi bi-info-circle-fill"
              />
            </div>
          ) : (
            <DatasetsList
              datasets={datasetMetadataList}
              defaultItemsPerPage={15}
            />
          )}
        </div>
      </div>
    </main>
  );
}
