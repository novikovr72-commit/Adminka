import { Fragment } from "react";

/**
 * Обёртка для tbody: отступы сверху/снизу + только видимые строки.
 */
export default function ListTableVirtualRows({ virtualizer, colSpan, renderRow }) {
  const items = virtualizer.getVirtualItems();
  if (items.length === 0) {
    return null;
  }
  const totalSize = virtualizer.getTotalSize();
  const scrollMargin = virtualizer.options.scrollMargin ?? 0;
  /* items[i].start включает scrollMargin (смещение под sticky-thead в расчёте виртуализатора); thead уже в DOM — не дублируем в tbody */
  const paddingTop = Math.max(0, items[0].start - scrollMargin);
  const paddingBottom = totalSize - items[items.length - 1].end;
  return (
    <>
      {paddingTop > 0 ? (
        <tr aria-hidden="true">
          <td className="list-virtual-spacer" colSpan={colSpan} style={{ height: `${paddingTop}px` }} />
        </tr>
      ) : null}
      {items.map((virtualRow) => (
        <Fragment key={virtualRow.key}>{renderRow(virtualRow)}</Fragment>
      ))}
      {paddingBottom > 0 ? (
        <tr aria-hidden="true">
          <td className="list-virtual-spacer" colSpan={colSpan} style={{ height: `${paddingBottom}px` }} />
        </tr>
      ) : null}
    </>
  );
}
