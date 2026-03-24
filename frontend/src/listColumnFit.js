/** Как в списке сотрудников (App.jsx): масштабирование ширин колонок под ширину контейнера. */

export const MIN_COLUMN_WIDTH = 90;

/**
 * @param {{ key: string, width?: number }[]} renderedColumns
 * @param {number} targetTotalWidth
 * @param {number} [minColumnWidth=MIN_COLUMN_WIDTH] — для экрана данных справочника можно передать меньший минимум (56)
 * @returns {{ key: string, width: number }[] | null}
 */
export function fitListColumnsToTargetWidth(renderedColumns, targetTotalWidth, minColumnWidth = MIN_COLUMN_WIDTH) {
  if (!Array.isArray(renderedColumns) || renderedColumns.length === 0 || targetTotalWidth <= 0) {
    return null;
  }
  const currentTotalWidth = renderedColumns.reduce((sum, column) => sum + Number(column.width || 0), 0);
  if (currentTotalWidth <= 0) {
    return null;
  }

  const scale = targetTotalWidth / currentTotalWidth;
  const m = minColumnWidth;
  const scaledWidths = renderedColumns.map((column) => ({
    key: column.key,
    width: Math.max(m, Math.round(Number(column.width || 0) * scale))
  }));

  let diff = targetTotalWidth - scaledWidths.reduce((sum, column) => sum + column.width, 0);
  if (diff < 0) {
    let deficit = -diff;
    for (let index = scaledWidths.length - 1; index >= 0 && deficit > 0; index -= 1) {
      const shrinkCapacity = Math.max(0, scaledWidths[index].width - m);
      if (shrinkCapacity <= 0) {
        continue;
      }
      const shrinkBy = Math.min(shrinkCapacity, deficit);
      scaledWidths[index].width -= shrinkBy;
      deficit -= shrinkBy;
    }
    diff = deficit > 0 ? -deficit : 0;
  }

  if (diff > 0 && scaledWidths.length > 0) {
    scaledWidths[scaledWidths.length - 1].width += diff;
  }

  return scaledWidths;
}
