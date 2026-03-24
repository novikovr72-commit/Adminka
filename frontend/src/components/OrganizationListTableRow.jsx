import { memo } from "react";

function organizationRowKeyPart(row, rowIndex) {
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

function OrganizationListTableRow({
  row,
  rowIndex,
  visibleColumns,
  getStickyProps,
  handleCellMouseEnter,
  updateCellTooltipPosition,
  handleCellMouseLeave,
  virtualizer,
  virtualIndex,
  onRowMouseDown,
  onRowClick
}) {
  const baseKey = organizationRowKeyPart(row, rowIndex);
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
      aria-selected={false}
      onMouseDown={onRowMouseDown}
      onClick={() => onRowClick(rowIndex)}
    >
      {visibleColumns.map((column) => {
        const displayValue =
          column.key === "organUnitTypeNames"
            ? (() => {
                const sourceTypes = Array.isArray(row?.organUnitTypes)
                  ? row.organUnitTypes
                  : Array.isArray(row?.organ_unit_types)
                    ? row.organ_unit_types
                    : [];
                const sortedTypes = sourceTypes
                  .map((item) => ({
                    name: String(item?.organUnitTypeName ?? item?.organ_unit_type_name ?? "").trim(),
                    sortOrder: Number(
                      item?.organUnitTypeSort ?? item?.organ_unit_type_sort ?? Number.MAX_SAFE_INTEGER
                    )
                  }))
                  .filter((item) => item.name)
                  .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) {
                      return left.sortOrder - right.sortOrder;
                    }
                    return left.name.localeCompare(right.name, "ru-RU", {
                      sensitivity: "base",
                      numeric: true
                    });
                  });
                const names = sortedTypes.map((item) => item.name);
                return names.length > 0 ? names.join(", ") : "-";
              })()
            : row?.[column.key] ?? "-";
        return (
          <td
            key={`${baseKey}-${column.key}`}
            className={`${getStickyProps(column.key).className}${
              column.key === "signResident" ? " cell-center" : ""
            }`.trim()}
            style={getStickyProps(column.key).style}
            onMouseEnter={(event) => handleCellMouseEnter(event, displayValue)}
            onMouseMove={updateCellTooltipPosition}
            onMouseLeave={handleCellMouseLeave}
          >
            {displayValue}
          </td>
        );
      })}
    </tr>
  );
}

export default memo(OrganizationListTableRow);
