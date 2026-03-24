import { memo } from "react";

function employeeRowKeyPart(row, rowIndex) {
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

function EmployeesListTableRow({
  row,
  rowIndex,
  visibleColumns,
  getStickyProps,
  isMainGridCellTooltipEnabled,
  handleCellMouseEnter,
  updateCellTooltipPosition,
  handleCellMouseLeave,
  getEmployeeDerivedPositionData,
  normalizeOrganizationId,
  buildOrganizationCardUrl,
  isSelected,
  virtualizer,
  virtualIndex,
  onRowClick
}) {
  const baseKey = employeeRowKeyPart(row, rowIndex);
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
        const derivedPositionData = getEmployeeDerivedPositionData(row);
        const rawValue =
          column.key === "organName" ||
          column.key === "departName" ||
          column.key === "positionName" ||
          column.key === "bossName"
            ? derivedPositionData[column.key]
            : row[column.key];
        const displayValue = rawValue ?? "-";
        const organTooltip =
          column.key === "organName" &&
          derivedPositionData &&
          (derivedPositionData.organNamesForTooltip.length > 0 || derivedPositionData.organTooltipText)
            ? derivedPositionData.organNamesForTooltip.length > 0
              ? derivedPositionData.organNamesForTooltip.join("\n")
              : derivedPositionData.organTooltipText
            : null;
        const departTooltip =
          column.key === "departName" &&
          derivedPositionData &&
          derivedPositionData.departNamesForTooltip.length > 0
            ? derivedPositionData.departNamesForTooltip.join("\n")
            : null;
        const fixedTooltipText = organTooltip ?? departTooltip;
        return (
          <td
            key={`${baseKey}-${column.key}`}
            className={`${getStickyProps(column.key).className}${
              column.key === "signResident" ? " cell-center" : ""
            }`.trim()}
            style={getStickyProps(column.key).style}
            onMouseEnter={
              isMainGridCellTooltipEnabled
                ? (event) =>
                    handleCellMouseEnter(
                      event,
                      displayValue,
                      fixedTooltipText,
                      Boolean(fixedTooltipText && String(fixedTooltipText).trim())
                    )
                : undefined
            }
            onMouseMove={isMainGridCellTooltipEnabled ? updateCellTooltipPosition : undefined}
            onMouseLeave={isMainGridCellTooltipEnabled ? handleCellMouseLeave : undefined}
          >
            {column.key === "organName" && normalizeOrganizationId(derivedPositionData?.organUnitId) ? (
              <a
                className="entity-card-hover-link employee-name-link"
                href={buildOrganizationCardUrl(derivedPositionData?.organUnitId)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                data-tooltip="Открыть карточку организации в новой вкладке"
              >
                {displayValue}
              </a>
            ) : (
              displayValue
            )}
          </td>
        );
      })}
    </tr>
  );
}

export default memo(EmployeesListTableRow, (prev, next) => {
  if (prev.row !== next.row) {
    return false;
  }
  if (prev.rowIndex !== next.rowIndex) {
    return false;
  }
  if (prev.isSelected !== next.isSelected) {
    return false;
  }
  if (prev.visibleColumns !== next.visibleColumns) {
    return false;
  }
  if (prev.getStickyProps !== next.getStickyProps) {
    return false;
  }
  if (prev.isMainGridCellTooltipEnabled !== next.isMainGridCellTooltipEnabled) {
    return false;
  }
  if (prev.virtualIndex !== next.virtualIndex) {
    return false;
  }
  return (
    prev.handleCellMouseEnter === next.handleCellMouseEnter &&
    prev.updateCellTooltipPosition === next.updateCellTooltipPosition &&
    prev.handleCellMouseLeave === next.handleCellMouseLeave &&
    prev.getEmployeeDerivedPositionData === next.getEmployeeDerivedPositionData &&
    prev.normalizeOrganizationId === next.normalizeOrganizationId &&
    prev.buildOrganizationCardUrl === next.buildOrganizationCardUrl &&
    prev.onRowClick === next.onRowClick &&
    prev.virtualizer === next.virtualizer
  );
});
