"use client";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({
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

  return (
    <nav aria-label="Pagination">
      <ul className="pagination overflow-auto">
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
            Previous
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
            Next
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
      </ul>
    </nav>
  );
}
