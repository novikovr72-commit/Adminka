import { memo } from "react";

function ReportSqlResultsContent({
  isLoading,
  error,
  columns,
  rows,
  getSortDirectionForField,
  getSortOrderForField,
  onSortClick,
  formatCellValue
}) {
  if (isLoading) {
    return (
      <div className="report-sql-results-loader">
        <div className="report-sql-execution-loader" aria-label="Идет выполнение SQL-скрипта" />
        <p>Выполняется SQL-скрипт...</p>
      </div>
    );
  }
  if (error) {
    return <div className="report-sql-results-empty-state">{error}</div>;
  }
  if (columns.length === 0) {
    return <div className="report-sql-results-empty-state">Результаты не найдены</div>;
  }
  return (
    <table className="report-sql-results-table">
      <thead>
        <tr>
          <th className="report-sql-results-row-number-header">№</th>
          {columns.map((columnName) => (
            <th key={columnName}>
              <button
                type="button"
                className={`column-sort-button${getSortDirectionForField(columnName) ? " active" : ""}`}
                onClick={() => onSortClick(columnName)}
              >
                <span>{columnName}</span>
                {getSortDirectionForField(columnName) && (
                  <span className="sort-icon-group">
                    <span className="sort-icon">
                      {getSortDirectionForField(columnName) === "ASC" ? "▲" : "▼"}
                    </span>
                    {getSortOrderForField(columnName) && (
                      <span className="sort-order-index">{getSortOrderForField(columnName)}</span>
                    )}
                  </span>
                )}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`report-sql-row-${rowIndex}`}>
            <td className="report-sql-results-row-number-cell">{rowIndex + 1}</td>
            {columns.map((columnName) => (
              <td key={`report-sql-cell-${rowIndex}-${columnName}`}>{formatCellValue(row?.[columnName])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const MemoizedReportSqlResultsContent = memo(ReportSqlResultsContent);
