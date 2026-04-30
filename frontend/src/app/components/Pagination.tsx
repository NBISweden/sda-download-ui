"use client";

type PaginationProps = {
  itemsPerPage?: number;
  totalItems?: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({
  itemsPerPage,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pageNumbers = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  );

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  let startItem;
  let endItem;

  if (itemsPerPage && totalItems) {
    startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    endItem = Math.min(currentPage * itemsPerPage, totalItems);
  }

  return (
    <nav aria-label="Pagination">
      <ul className="pagination flex-wrap">
        <li className={`page-item ${isFirstPage ? "disabled" : ""}`}>
          <button
            type="button"
            className="page-link"
            onClick={() => onPageChange(1)}
            disabled={isFirstPage}
          >
            First
          </button>
        </li>

        <li className={`page-item ${isFirstPage ? "disabled" : ""}`}>
          <button
            type="button"
            className="page-link"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={isFirstPage}
          >
            <span className="d-inline d-sm-none">&lt;&lt;</span>
            <span className="d-none d-sm-inline">Previous</span>
          </button>
        </li>

        {pageNumbers.map((pageNumber) => (
          <li
            key={pageNumber}
            className={`page-item ${pageNumber === currentPage ? "active" : ""}`}
            aria-current={pageNumber === currentPage ? "page" : undefined}
          >
            <button
              type="button"
              className="page-link"
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          </li>
        ))}

        <li className={`page-item ${isLastPage ? "disabled" : ""}`}>
          <button
            type="button"
            className="page-link"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={isLastPage}
          >
            <span className="d-inline d-sm-none">&gt;&gt;</span>
            <span className="d-none d-sm-inline">Next</span>
          </button>
        </li>

        <li className={`page-item ${isLastPage ? "disabled" : ""}`}>
          <button
            type="button"
            className="page-link"
            onClick={() => onPageChange(totalPages)}
            disabled={isLastPage}
          >
            Last
          </button>
        </li>
        {itemsPerPage && totalItems && (
          <p className="ms-3 ms-lg-4 my-3 my-lg-0 align-self-center">
            Viewing{" "}
            <strong>
              {startItem}-{endItem}
            </strong>{" "}
            of <strong>{totalItems}</strong>
          </p>
        )}
      </ul>
    </nav>
  );
}
