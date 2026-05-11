import React from 'react';
import './ui.css';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items',
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
    .reduce<(number | '...')[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <nav className="ui-pagination" aria-label="Pagination">
      <span className="ui-pagination-summary">
        Showing {start}-{end} of {totalItems} {itemLabel}
      </span>
      <div className="ui-pagination-controls">
        <button className="ui-pagination-btn" aria-label="First page" disabled={currentPage === 1} onClick={() => onPageChange(1)}>
          «
        </button>
        <button className="ui-pagination-btn" aria-label="Previous page" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
          ‹
        </button>

        {pages.map((p, i) =>
          p === '...'
            ? <span key={`ellipsis-${i}`} className="ui-pagination-ellipsis">...</span>
            : (
              <button
                key={p}
                className={`ui-pagination-btn ${currentPage === p ? 'is-active' : ''}`}
                aria-label={`Page ${p}`}
                aria-current={currentPage === p ? 'page' : undefined}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </button>
            )
        )}

        <button className="ui-pagination-btn" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
          ›
        </button>
        <button className="ui-pagination-btn" aria-label="Last page" disabled={currentPage === totalPages} onClick={() => onPageChange(totalPages)}>
          »
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
