/** Вкладки карточки отчёта, режимы SQL/шаблона и связанные числовые константы UI. */

export const REPORT_CARD_TABS = {
  MAIN: "main",
  SQL: "sql",
  TEMPLATE: "template",
  PREVIEW: "preview"
};

export const REPORT_SQL_VIEW_MODES = {
  EDITOR: "editor",
  RESULTS: "results"
};

export const REPORT_TEMPLATE_VIEW_MODES = {
  SETTINGS: "settings",
  JSON: "json"
};

export const REPORT_SQL_BASE_FONT_SIZE_PX = 13;
export const REPORT_SQL_EDITOR_PADDING_PX = 12;
export const REPORT_SQL_EDITOR_LINE_HEIGHT_PX = 18;

/** Лимит строк превью в UI выполнения SQL в карточке. */
export const REPORT_SQL_RESULTS_PREVIEW_LIMIT = 50;

/** Длительность «заморозки» списка при закрытии боковой карточки (как в App.jsx для отчётов). */
export const REPORT_CARD_LIST_TRANSITION_MS = 2100;

export const REPORT_ACCESS_GROUP_ENUM = Array.from(
  { length: 10 },
  (_, index) => `GRP${String(index + 1).padStart(2, "0")}`
);
