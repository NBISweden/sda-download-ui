"use client";

import { useMemo, useState } from "react";
import Pagination from "@/app/components/Pagination";
import type { DatasetMetadata } from "../actions/datasets";

type DatasetsListProps = {
    datasets: DatasetMetadata[];
    itemsPerPage?: number;
};

export default function DatasetsList({
                                         datasets,
                                         itemsPerPage = 6,
                                     }: DatasetsListProps) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(datasets.length / itemsPerPage);

    const currentDatasets = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return datasets.slice(startIndex, endIndex);
    }, [datasets, currentPage, itemsPerPage]);

    return (
        <>
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />

            {currentDatasets.map((dataset) => (
                <div className="col-4 p-2" key={dataset.datasetId}>
                    <div className="card">
                        <h5 className="card-header">{dataset.datasetId}</h5>

                        <ul className="list-group list-group-flush">
                            <li className="list-group-item">
                                {new Date(dataset.date).toLocaleDateString("sv-SE")}
                            </li>
                            <li className="list-group-item">
                                {dataset.files} <em>files</em>
                            </li>
                            <li className="list-group-item">
                                <em>Dataset size is</em> {dataset.size}
                            </li>
                        </ul>

                        <div className="card-body">
                            <a
                                className="btn bg-primary-subtle text-break"
                                href=""
                            >
                                View dataset {dataset.datasetId}
                            </a>
                        </div>
                    </div>
                </div>
            ))}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        </>
    );
}