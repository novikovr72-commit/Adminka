import { memo } from "react";
import { IconPencil, IconTrash } from "./AppIcons";

function relationRowKeyPart(row, rowIndex) {
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

function EmployeeRelationsListTableRow({
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
  onEditRelation,
  onDeleteRelation,
  normalizeEmployeeId,
  normalizeOrganizationId,
  buildEmployeeCardUrl,
  buildOrganizationCardUrl,
  virtualizer,
  virtualIndex
}) {
  const baseKey = relationRowKeyPart(row, rowIndex);
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
        const rawValue =
          column.key === "defaultFlag"
            ? row?.defaultFlag === true
              ? "Да"
              : row?.defaultFlag === false
                ? "Нет"
                : ""
            : row[column.key];
        const displayValue = rawValue ?? "-";
        const cellKey = `${baseKey}-${column.key}`;
        return (
          <td
            key={cellKey}
            className={`${getStickyProps(column.key).className}${
              column.key === "defaultFlag" ? " cell-center" : ""
            }`.trim()}
            style={getStickyProps(column.key).style}
            onMouseEnter={
              isMainGridCellTooltipEnabled
                ? (event) => handleCellMouseEnter(event, displayValue)
                : undefined
            }
            onMouseMove={isMainGridCellTooltipEnabled ? updateCellTooltipPosition : undefined}
            onMouseLeave={isMainGridCellTooltipEnabled ? handleCellMouseLeave : undefined}
          >
            {column.key === "employeeName" && normalizeEmployeeId(row?.employeeId) ? (
              <a
                className="entity-card-hover-link employee-name-link"
                href={buildEmployeeCardUrl(row?.employeeId)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                data-tooltip="Открыть карточку сотрудника в новой вкладке"
              >
                {displayValue}
              </a>
            ) : column.key === "organName" &&
              normalizeOrganizationId(row?.organUnitId ?? row?.organ_unit_id) ? (
              <a
                className="entity-card-hover-link employee-name-link"
                href={buildOrganizationCardUrl(row?.organUnitId ?? row?.organ_unit_id)}
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
      <td className="employee-card-relations-actions-cell relations-list-actions-cell">
        <button
          type="button"
          className="employee-card-position-action-button"
          aria-label="Редактировать связь"
          data-tooltip="Редактировать"
          onClick={() => onEditRelation(row)}
        >
          <IconPencil aria-hidden />
        </button>
        <button
          type="button"
          className="employee-card-position-action-button"
          aria-label="Удалить связь"
          data-tooltip="Удалить"
          onClick={() => onDeleteRelation(row)}
        >
          <IconTrash aria-hidden />
        </button>
      </td>
    </tr>
  );
}

export default memo(EmployeeRelationsListTableRow);
