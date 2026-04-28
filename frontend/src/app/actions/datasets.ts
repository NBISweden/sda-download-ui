"use server";

import { getConfig } from "../lib/config";

export type DatasetListResponse = {
  datasets: string[];
  nextPageToken: string | null;
};

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
  nextPageToken: string | null;
};

const baseUrl =
  process.env.DATASETS_API_BASE_URL || "http://host.docker.internal:8085";

export async function fetchDatasets(
  token: string,
): Promise<DatasetListResponse> {
  const { sdaBaseUrl } = await getConfig();
  const response = await fetch(`${sdaBaseUrl}/datasets`, {
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
): Promise<DatasetFilesResponse> {
  console.log("fetching files for dataset", datasetId);
  const response = await fetch(`${baseUrl}/datasets/${datasetId}/files`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  console.log("response status", response.status);

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset files: ${response.status}`);
  }

  return response.json();
}
