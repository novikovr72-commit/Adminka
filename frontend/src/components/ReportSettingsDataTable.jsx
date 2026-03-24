import ListTableVirtualRows from "./ListTableVirtualRows";
import ReportSettingsListTableRow from "./ReportSettingsListTableRow";
import { REPORT_SETTINGS_FILTERABLE_FIELDS } from "../reportSettingsConstants";

export default function ReportSettingsDataTable({
  tableWrapperRef,
  tableWidthWithActionsPx,
  visibleColumns,
  getColumnWidthPx,
  getStickyProps,
  getSortDirectionForField,
  getSortOrderForField,
  handleSortClick,
  handleResizeStart,
  filters,
  handleFilterChange,
  employeesLoading,
  employeesError,
  displayedEmployees,
  listVirtualizationActive,
  listVirtualizer,
  isMainGridCellTooltipEnabled,
  handleCellMouseEnter,
  updateCellTooltipPosition,
  handleCellMouseLeave,
  selectedRowIndex,
  onReportRowClick
}) {
  const colSpan = visibleColumns.length;
  return (
    <div className="table-wrapper" ref={tableWrapperRef} tabIndex={0}>
      <table
        className="employee-grid"
        style={{
          width: `${tableWidthWithActionsPx}px`,
          minWidth: `${tableWidthWithActionsPx}px`,
          maxWidth: `${tableWidthWithActionsPx}px`
        }}
      >
        <colgroup>
          {visibleColumns.map((column) => (
            <col
              key={`col-${column.key}`}
              style={{
                width: `${getColumnWidthPx(column.key)}px`,
                minWidth: `${getColumnWidthPx(column.key)}px`,
                maxWidth: `${getColumnWidthPx(column.key)}px`
              }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {visibleColumns.map((column) => {
              const isColumnSortable = Boolean(column.sortField);
              const columnSortDirection = isColumnSortable
                ? getSortDirectionForField(column.sortField)
                : null;
              const columnSortOrder = isColumnSortable ? getSortOrderForField(column.sortField) : null;
              const sortIcon =
                columnSortDirection === "ASC" ? "▲" : columnSortDirection === "DESC" ? "▼" : null;
              return (
                <th
                  key={column.key}
                  className={`${getStickyProps(column.key, true).className}`.trim()}
                  style={getStickyProps(column.key, true).style}
                >
                  {isColumnSortable ? (
                    <button
                      type="button"
                      className={`column-sort-button${columnSortDirection ? " active" : ""}`}
                      onClick={() => handleSortClick(column.sortField)}
                    >
                      <span>{column.title}</span>
                      {sortIcon && (
                        <span className="sort-icon-group">
                          <span className="sort-icon">{sortIcon}</span>
                          {columnSortOrder && (
                            <span className="sort-order-index">{columnSortOrder}</span>
                          )}
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="column-sort-button">
                      <span>{column.title}</span>
                    </div>
                  )}
                  <span
                    className="column-resize-handle"
                    onMouseDown={(event) => handleResizeStart(column.key, event)}
                    role="presentation"
                  />
                </th>
              );
            })}
          </tr>
          <tr className="filter-row">
            {visibleColumns.map((column) => (
              <th
                key={`filter-${column.key}`}
                className={`${getStickyProps(column.key, true).className}`.trim()}
                style={getStickyProps(column.key, true).style}
              >
                {!REPORT_SETTINGS_FILTERABLE_FIELDS.has(column.key) ? null : (
                  <div className="column-filter-input-wrapper">
                    <input
                      type="text"
                      value={filters[column.key] ?? ""}
                      onChange={(event) => handleFilterChange(column.key, event.target.value)}
                      className="column-filter-input"
                    />
                    {String(filters[column.key] ?? "").trim() !== "" && (
                      <button
                        type="button"
                        className="column-filter-clear-button"
                        aria-label="Очистить фильтр"
                        onClick={() => handleFilterChange(column.key, "")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employeesLoading && displayedEmployees.length === 0 && (
            <tr>
              <td colSpan={colSpan}>Загрузка данных...</td>
            </tr>
          )}
          {!employeesLoading && !employeesError && displayedEmployees.length === 0 && (
            <tr>
              <td colSpan={colSpan}>Записи не найдены</td>
            </tr>
          )}
          {!employeesError &&
            (listVirtualizationActive ? (
              <ListTableVirtualRows
                virtualizer={listVirtualizer}
                colSpan={colSpan}
                renderRow={(virtualRow) => {
                  const row = displayedEmployees[virtualRow.index];
                  const rowIndex = virtualRow.index;
                  return (
                    <ReportSettingsListTableRow
                      row={row}
                      rowIndex={rowIndex}
                      virtualIndex={virtualRow.index}
                      virtualizer={listVirtualizer}
                      visibleColumns={visibleColumns}
                      getStickyProps={getStickyProps}
                      isMainGridCellTooltipEnabled={isMainGridCellTooltipEnabled}
                      handleCellMouseEnter={handleCellMouseEnter}
                      updateCellTooltipPosition={updateCellTooltipPosition}
                      handleCellMouseLeave={handleCellMouseLeave}
                      isSelected={selectedRowIndex === rowIndex}
                      onRowClick={onReportRowClick}
                    />
                  );
                }}
              />
            ) : (
              displayedEmployees.map((row, rowIndex) => (
                <ReportSettingsListTableRow
                  key={`${
                    row.id ??
                    row.reportTemplateId ??
                    row.employeeId ??
                    row.relationId ??
                    row.email ??
                    row.sapId ??
                    "row"
                  }-${rowIndex}`}
                  row={row}
                  rowIndex={rowIndex}
                  visibleColumns={visibleColumns}
                  getStickyProps={getStickyProps}
                  isMainGridCellTooltipEnabled={isMainGridCellTooltipEnabled}
                  handleCellMouseEnter={handleCellMouseEnter}
                  updateCellTooltipPosition={updateCellTooltipPosition}
                  handleCellMouseLeave={handleCellMouseLeave}
                  isSelected={selectedRowIndex === rowIndex}
                  onRowClick={onReportRowClick}
                />
              ))
            ))}
        </tbody>
      </table>
    </div>
  );
}
