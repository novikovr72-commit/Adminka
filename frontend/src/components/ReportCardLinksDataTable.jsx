import { memo } from "react";

function ReportCardLinksDataTable({
  firstHeaderLabel,
  colWidths,
  onResizeMainStart,
  onResizeActionsStart,
  children
}) {
  const main = Number(colWidths?.main) || 280;
  const actions = Number(colWidths?.actions) || 96;
  return (
    <div className="report-card-links-table-wrapper">
      <table className="employee-card-positions-table report-card-links-table">
        <colgroup>
          <col style={{ width: `${main}px`, minWidth: `${main}px`, maxWidth: `${main}px` }} />
          <col style={{ width: `${actions}px`, minWidth: `${actions}px`, maxWidth: `${actions}px` }} />
        </colgroup>
        <thead>
          <tr>
            <th className="report-card-links-table-data-header">
              <div className="column-sort-button">
                <span>{firstHeaderLabel}</span>
              </div>
              <span
                className="column-resize-handle"
                onMouseDown={onResizeMainStart}
                role="presentation"
              />
            </th>
            <th
              className="report-card-links-table-actions-header employee-card-positions-actions-header"
              aria-label="Действия"
            >
              <span
                className="column-resize-handle"
                onMouseDown={onResizeActionsStart}
                role="presentation"
              />
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default memo(ReportCardLinksDataTable);
