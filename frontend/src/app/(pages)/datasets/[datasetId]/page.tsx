import {
  fetchDatasetMetadata,
  type DatasetMetadata,
  type DatasetFile,
  fetchDatasetFiles,
  fetchAll,
} from "../../../actions/datasets";
import { getSession } from "@/app/lib/session";
import DatasetDetails from "../../../components/DatasetDetails";
import DatasetFiles from "@/app/components/DatasetFiles";
import Alert from "@/app/components/Alert";
import Link from "next/link";

interface DatasetDetailsViewProps {
  params: Promise<{
    datasetId: string;
  }>;
}

export default async function DatasetDetailsView({
  params,
}: DatasetDetailsViewProps) {
  const { datasetId } = await params;

  const sessionData = await getSession();
  const token = sessionData?.token;
  const hasPublicKey = !!sessionData?.publicKey?.key;

  let errorMessage: string | null = null;
  let dataset: DatasetMetadata | null = null;
  let files: DatasetFile[] = [];

  if (!token) {
    return <p>No token found in session.</p>;
  }

  try {
    dataset = await fetchDatasetMetadata(token, datasetId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    errorMessage = message.includes("fetch failed")
      ? "Could not connect to backend. Is it running?"
      : `Could not load dataset metadata: ${message}`;
  }

  try {
    files = await fetchAll(async (pageToken) => {
      const page = await fetchDatasetFiles(token, datasetId, pageToken);
      return { items: page.files, nextPageToken: page.nextPageToken };
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error occurred";

    errorMessage = message.includes("fetch failed")
      ? "Could not connect to backend. Is it running?"
      : `Could not load dataset files: ${message}`;
  }

  return (
    <main>
      <div className="container">
        <div className="row mt-5">
          {errorMessage ? (
            <Alert
              type="warning"
              alertMessage={errorMessage}
              iconClass="bi bi-exclamation-triangle-fill"
            />
          ) : !dataset ? (
            <Alert
              type="info"
              alertMessage="Information on the dataset could not be loaded."
              iconClass="bi bi-info-circle-fill"
            />
          ) : (
            <>
              <DatasetDetails dataset={dataset} />
              <div className="container mt-5 px-0">
                <h3>Files</h3>
                {!hasPublicKey && (
                  <Alert
                    type="warning"
                    iconClass="bi bi-exclamation-triangle-fill"
                    alertMessage={
                      <>
                        File download will be unavailable until you{" "}
                        <Link href="/userinfo">
                          upload a Crypt4GH public key on your profile page
                        </Link>
                        .
                      </>
                    }
                  />
                )}
                <DatasetFiles
                  files={files}
                  defaultItemsPerPage={10}
                  canDownload={hasPublicKey}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
