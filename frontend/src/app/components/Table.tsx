import React, { ReactNode } from "react";

type CellValue = string | number | ReactNode;

type RowData = Record<string, CellValue>;

type TableProps<T extends RowData> = {
  data: T[];
  columns?: (keyof T)[];
  headers?: Partial<Record<keyof T, string>>;
  getRowId?: (row: T) => string;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
};

export function Table<T extends RowData>({
  data,
  columns,
  headers,
  getRowId,
  selectedIds,
  onToggleRow,
}: TableProps<T>) {
  const tableColumns =
    columns ?? (data.length > 0 ? (Object.keys(data[0]) as (keyof T)[]) : []);

  const formatHeader = (key: keyof T): string => {
    if (headers?.[key]) return headers[key]!;

    return String(key).toUpperCase();
  };

  const renderCell = (value: CellValue): ReactNode => {
    if (React.isValidElement(value)) {
      return value;
    }

    if (typeof value === "number") {
      return value.toString();
    }

    return value;
  };

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Select</th>
            {tableColumns.map((column) => (
              <th key={String(column)}>{formatHeader(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const rowId = getRowId?.(row);
            const isSelected = rowId ? selectedIds?.has(rowId) : false;
            return (
              <tr key={rowId ?? rowIndex}>
                <td>
                  <input
                    type="checkbox"
                    className="form-check-input file-selection-checkbox"
                    checked={isSelected}
                    onChange={() => {
                      if (rowId) {
                        onToggleRow?.(rowId);
                      }
                    }}
                    aria-label="Select file"
                    autoComplete="off"
                  />
                </td>
                {tableColumns.map((column) => (
                  <td key={String(column)}>{renderCell(row[column])}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
