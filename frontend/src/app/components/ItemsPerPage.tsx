import { useState } from "react";

export function useItemsPerPage(
  defaultItemsPerPage: number,
  itemStep: number = 15,
) {
  const itemsPerPageOptions = Array.from({ length: 4 }).map(
    (_, index) => itemStep * Math.pow(2, index),
  );
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
  return {
    itemsPerPage,
    setItemsPerPage,
    itemsPerPageOptions,
  };
}

export function ItemSelector<T extends string | number>({
  item,
  items,
  setItem,
  label,
}: {
  item: T;
  items: T[];
  setItem: (i: T) => void;
  label: string;
}) {
  return (
    <div className="col-12 d-flex mb-3">
      <div className="btn-group flex-grow-0">
        {items.map((i) => (
          <a
            key={i}
            onClick={() => setItem(i)}
            className={`btn btn-secondary ${i === item ? "active" : ""}`}
            aria-current="page"
          >
            {i}
          </a>
        ))}
      </div>
      <span className="py-2 mx-2 ms-lg-4 ms-3 flex-shrink-0 flex-grow-1">
        {label}
      </span>
    </div>
  );
}
