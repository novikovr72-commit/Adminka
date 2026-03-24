import { memo } from "react";

const REPORT_SETTINGS_CENTER_COLUMN_KEYS = new Set([
  "method",
  "status",
  "numberDays",
  "outputFileType"
]);

function reportListRowKeyPart(row, rowIndex) {
  return (
    row?.id ??
    row?.reportTemplateId ??
    row?.employeeId ??
    row?.relationId ??
    row?.email ??
    row?.sapId ??
    `row-${rowIndex}`
  );
}

function ReportSettingsListTableRow({
  row,
  rowIndex,
  visibleColumns,
  getStickyProps,
  isMainGridCellTooltipEnabled,
  handleCellMouseEnter,
  updateCellTooltipPosition,
  handleCellMouseLeave,
  isSelected,
  onRowClick,
  virtualizer,
  virtualIndex
}) {
  const baseKey = reportListRowKeyPart(row, rowIndex);
  const measureProps =
    virtualizer != null && virtualIndex != null
      ? {
          ref: virtualizer.measureElement,
          "data-index": virtualIndex
        }
      : {};
  return (
    <tr
      {...measureProps}
      data-row-index={rowIndex}
      tabIndex={-1}
      aria-selected={isSelected}
      className={isSelected ? "selected-row" : ""}
      onClick={() => onRowClick(rowIndex)}
    >
      {visibleColumns.map((column) => {
        const rawValue = row[column.key];
        const displayValue = rawValue ?? "-";
        const cellKey = `${baseKey}-${column.key}`;
        const centerClass =
          REPORT_SETTINGS_CENTER_COLUMN_KEYS.has(column.key) ? " cell-center" : "";
        return (
          <td
            key={cellKey}
            className={`${getStickyProps(column.key).className}${centerClass}`.trim()}
            style={getStickyProps(column.key).style}
            onMouseEnter={
              isMainGridCellTooltipEnabled
                ? (event) => handleCellMouseEnter(event, displayValue)
                : undefined
            }
            onMouseMove={isMainGridCellTooltipEnabled ? updateCellTooltipPosition : undefined}
            onMouseLeave={isMainGridCellTooltipEnabled ? handleCellMouseLeave : undefined}
          >
            {displayValue}
          </td>
        );
      })}
    </tr>
  );
}

export default memo(ReportSettingsListTableRow);
