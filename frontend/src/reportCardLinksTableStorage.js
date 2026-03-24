/** Ширины колонок таблиц «Организации / Получатели / Группы доступа» в карточке отчёта — общие для трёх блоков. */
export const REPORT_CARD_LINKS_TABLE_WIDTHS_KEY = "report-card.links-tables.v1";

export const MIN_REPORT_CARD_LINK_MAIN = 120;
export const MIN_REPORT_CARD_LINK_ACTIONS = 48;

export const DEFAULT_REPORT_CARD_LINK_WIDTHS = {
  main: 280,
  actions: 96
};

export function loadReportCardLinksWidths() {
  try {
    const raw = window.localStorage.getItem(REPORT_CARD_LINKS_TABLE_WIDTHS_KEY);
    if (!raw) {
      return { ...DEFAULT_REPORT_CARD_LINK_WIDTHS };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_REPORT_CARD_LINK_WIDTHS };
    }
    return {
      main: Math.max(
        MIN_REPORT_CARD_LINK_MAIN,
        Math.round(Number(parsed.main) || DEFAULT_REPORT_CARD_LINK_WIDTHS.main)
      ),
      actions: Math.max(
        MIN_REPORT_CARD_LINK_ACTIONS,
        Math.round(Number(parsed.actions) || DEFAULT_REPORT_CARD_LINK_WIDTHS.actions)
      )
    };
  } catch {
    return { ...DEFAULT_REPORT_CARD_LINK_WIDTHS };
  }
}
