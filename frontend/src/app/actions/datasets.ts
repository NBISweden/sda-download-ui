"use server";

import { getConfig } from "../lib/config";

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

export async function fetchDatasets(
  token: string,
  pageToken?: string,
): Promise<DatasetListResponse> {
  const { sdaBaseUrl } = await getConfig();
  const params = new URLSearchParams();
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  const baseUrl = `${sdaBaseUrl}/datasets`;
  const response = await fetch(baseUrl + (params.size ? `?${params}` : ""), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch datasets: ${response.status}`);
  }

  return response.json();
}

export async function fetchDatasetMetadata(
  token: string,
  datasetId: string,
): Promise<DatasetMetadata> {
  const { sdaBaseUrl } = await getConfig();
  const response = await fetch(`${sdaBaseUrl}/datasets/${datasetId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset metadata: ${response.status}`);
  }

  return response.json();
}

export async function fetchDatasetFiles(
  token: string,
  datasetId: string,
  pageToken?: string,
): Promise<DatasetFilesResponse> {
  const { sdaBaseUrl } = await getConfig();
  const params = new URLSearchParams();
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  const baseUrl = `${sdaBaseUrl}/datasets/${datasetId}/files`;
  const response = await fetch(baseUrl + (params.size ? `?${params}` : ""), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
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
