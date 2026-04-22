"use server";

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

export async function fetchDatasets(token: string): Promise<DatasetListResponse> {
    const response = await fetch("http://host.docker.internal:8085/datasets", {
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

export async function fetchDatasetMetadata(token: string, datasetId: string): Promise<DatasetMetadata> {
    const response = await fetch(
        `http://host.docker.internal:8085/datasets/${datasetId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
        },
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch dataset metadata: ${response.status}`);
    }

    return response.json();
}