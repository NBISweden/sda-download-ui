type NextPageToken = {
  nextPageToken: string | null;
};

export type DatasetListResponse = {
  datasets: string[];
} & NextPageToken;

export type DatasetMetadata = {
  datasetId: string;
  date: string;
  files: number;
  size: number;
};

export type Checksum = {
  type: string;
  checksum: string;
};

export type DatasetFile = {
  fileId: string;
  filePath: string;
  size: number;
  decryptedSize: number;
  checksums: Checksum[];
  downloadUrl: string;
};

export type DatasetFilesResponse = {
  files: DatasetFile[];
} & NextPageToken;

const urlRoot = "http://localhost:3002"

export async function fetchDatasets(
  pageToken?: string,
): Promise<DatasetListResponse> {
  const params = new URLSearchParams();
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  const baseUrl = `${urlRoot}/api/datasets`;
  console.log("URL:", baseUrl)

  const response = await fetch(baseUrl + (params.size ? `?${params}` : ""), {
    cache: "no-store",
    credentials: "same-origin"
  });
  console.log("RESPONSE:", response)

  if (!response.ok) {
    throw new Error(`Failed to fetch datasets: ${response.status}`);
  }

  return response.json();
}

export async function fetchDatasetMetadata(
  datasetId: string,
): Promise<DatasetMetadata> {
  const response = await fetch(`${urlRoot}/api/datasets/${datasetId}`, {
    cache: "no-store",
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset metadata: ${response.status}`);
  }

  return response.json();
}

export async function fetchDatasetFiles(
  datasetId: string,
  pageToken?: string,
): Promise<DatasetFilesResponse> {
  const params = new URLSearchParams();
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  const baseUrl = `${urlRoot}/api/datasets/${datasetId}/files`;
  const response = await fetch(baseUrl + (params.size ? `?${params}` : ""), {
    cache: "no-store",
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset files: ${response.status}`);
  }

  return response.json();
}

export async function fetchAll<T>(
  fetchPage: (pageToken?: string) => Promise<{ items: T[] } & NextPageToken>,
) {
  const items: T[] = [];
  let nextPageToken: NextPageToken["nextPageToken"] | false = null;
  while (nextPageToken !== false) {
    const data = await fetchPage(nextPageToken || undefined);
    items.push(...data.items);
    nextPageToken = data.nextPageToken || false;
  }
  return items;
}
