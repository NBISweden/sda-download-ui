import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { fetchDatasets, fetchDatasetMetadata } from "./datasets";

/**
 * Unit tests for the dataset fetch functions in datasets.ts.
 *
 * These tests mock global fetch to verify that each function:
 * - sends the request to the correct endpoint
 * - includes the expected Authorization header and cache option
 * - returns parsed JSON on successful responses
 * - throws the expected error on non-OK HTTP responses
 * - propagates fetch/network errors
 *
 * The goal is to test the request/response logic in isolation,
 * without depending on a running backend.
 */

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("datasets API functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    {
      name: "fetchDatasets returns parsed JSON on success",
      call: () => fetchDatasets("my-token"),
      mockData: { datasets: ["ds1", "ds2"] },
      expectedUrl: "http://host.docker.internal:8085/datasets",
    },
    {
      name: "fetchDatasetMetadata returns parsed JSON on success",
      call: () => fetchDatasetMetadata("my-token", "ds1"),
      mockData: {
        datasetId: "ds1",
        date: "2026-04-23",
        files: 10,
      },
      expectedUrl: "http://host.docker.internal:8085/datasets/ds1",
    },
  ])("$name", async ({ call, mockData, expectedUrl }) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(mockData));

    const result = await call();

    expect(globalThis.fetch).toHaveBeenCalledWith(expectedUrl, {
      headers: {
        Authorization: "Bearer my-token",
      },
      cache: "no-store",
    });

    expect(result).toEqual(mockData);
  });

  test.each([
    {
      name: "fetchDatasets throws on non-ok response",
      call: () => fetchDatasets("my-token"),
      status: 500,
      body: "Internal Server Error",
      expectedMessage: "Failed to fetch datasets: 500",
    },
    {
      name: "fetchDatasetMetadata throws on non-ok response",
      call: () => fetchDatasetMetadata("my-token", "ds1"),
      status: 404,
      body: "Not Found",
      expectedMessage: "Failed to fetch dataset metadata: 404",
    },
  ])("$name", async ({ call, status, body, expectedMessage }) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, { status }),
    );

    await expect(call()).rejects.toThrow(expectedMessage);
  });

  test.each([
    {
      name: "fetchDatasets rejects if fetch itself fails",
      call: () => fetchDatasets("my-token"),
      expectedMessage: "Network error",
    },
    {
      name: "fetchDatasetMetadata rejects if fetch itself fails",
      call: () => fetchDatasetMetadata("my-token", "ds1"),
      expectedMessage: "Network error",
    },
  ])("$name", async ({ call, expectedMessage }) => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error(expectedMessage));

    await expect(call()).rejects.toThrow(expectedMessage);
  });
});
