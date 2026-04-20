"use server";
import { redirect } from "next/navigation";
import { createOrUpdateSession } from "@/app/lib/session";

export default async function mockAuth(data: FormData) {
  let token: string | undefined = undefined;
  try {
    token = await fetchMockToken();
  } catch (error) {
    throw new Error(`Failed to fetch token: ${error}`);
  }
  if (token) {
    await createOrUpdateSession({ token });
  }
  const target = data.get("target");
  redirect(typeof target === "string" ? target : "/");
}

export async function fetchMockToken() {
  const tokenUrl =
    process.env.MOCK_TOKEN_URL || "http://host.docker.internal:8001/tokens";
  const data: string[] = await (await fetch(tokenUrl)).json();
  const token = data[0];
  return token;
}

export async function fetchDatasets(token: string) {
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

export async function fetchDatasetMetadata(token: string, datasetId: string) {
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
