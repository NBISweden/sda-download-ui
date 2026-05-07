"use client";

type PaginationProps = {
  itemsPerPage?: number;
  totalItems?: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number | string) => void;
};

export default function Pagination({
  itemsPerPage,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const shouldShowPagination = totalPages > 1;
  const shouldShowViewingSummary =
      typeof itemsPerPage === "number" &&
      typeof totalItems === "number";

  if (!shouldShowPagination && !shouldShowViewingSummary) {
    return null;
  }

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  const pageThreshold = 7;

  const getVisibleItems = () => {
    if (totalPages <= pageThreshold) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, "ellipsis-right", totalPages];
    }

    if (currentPage >= totalPages - 2) {
      return [
        1,
        "ellipsis-left",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "ellipsis-left",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis-right",
      totalPages,
    ];
  };

  const visibleItems = getVisibleItems();

  let startItem;
  let endItem;

  if (itemsPerPage && totalItems) {
    startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    endItem = Math.min(currentPage * itemsPerPage, totalItems);
  }

  return (
    <nav aria-label="Pagination">
      <ul className="pagination flex-wrap">
        {shouldShowPagination && (
            <>
              <li className={`page-item ${isFirstPage ? "disabled" : ""}`}>
                <button
                    type="button"
                    className="page-link"
                    onClick={() => onPageChange(1)}
                    disabled={isFirstPage}
                >
                  <span className="d-inline d-sm-none">&lt;&lt;</span>
                  <span className="d-none d-sm-inline">First</span>
                </button>
              </li>

              <li className={`page-item ${isFirstPage ? "disabled" : ""}`}>
                <button
                    type="button"
                    className="page-link"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={isFirstPage}
                >
                  <span className="d-inline d-sm-none">&lt;</span>
                  <span className="d-none d-sm-inline">Previous</span>
                </button>
              </li>
              {visibleItems.map((item) =>
                  typeof item === "number" ? (
                      <li
                          key={item}
                          className={`page-item ${item === currentPage ? "active" : ""}`}
                          aria-current={item === currentPage ? "page" : undefined}
                      >
                        <button
                            type="button"
                            className="page-link"
                            onClick={() => onPageChange(item)}
                            aria-label={`Go to page ${item}`}
                        >
                          {item}
                        </button>
                      </li>
                  ) : (
                      <li key={item} className="page-item disabled" aria-hidden="true">
                        <span className="page-link">…</span>
                      </li>
                  ),
              )}

              <li className={`page-item ${isLastPage ? "disabled" : ""}`}>
                <button
                    type="button"
                    className="page-link"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={isLastPage}
                >
                  <span className="d-inline d-sm-none">&gt;</span>
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
                  <span className="d-inline d-sm-none">&gt;&gt;</span>
                  <span className="d-none d-sm-inline">Last</span>
                </button>
              </li>
            </>
        )}

        {shouldShowViewingSummary && (
          <li className="ms-3 ms-lg-4 my-3 my-lg-0 align-self-center">
            Viewing{" "}
            <strong>
              {startItem}-{endItem}
            </strong>{" "}
            of <strong>{totalItems}</strong>
          </li>
        )}
      </ul>
    </nav>
  );
}
