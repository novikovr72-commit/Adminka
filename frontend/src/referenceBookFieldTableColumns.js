/** Ключи колонок таблицы «Параметры полей» в карточке справочника — общие для всех карточек (localStorage). */
export const REFERENCE_BOOK_FIELD_TABLE_STORAGE_KEY = "reference-book-card.fields-table-column-widths.v2";

export const REFERENCE_BOOK_FIELD_TABLE_MIN_WIDTH = 56;

/** Порядок и подписи колонок (без колонки действий в режиме просмотра). */
export const REFERENCE_BOOK_FIELD_TABLE_COLUMNS = [
  { key: "orderNumber", title: "Пор.№", defaultWidth: 72 },
  { key: "fieldName", title: "Наименование поля", defaultWidth: 120 },
  { key: "fieldCaption", title: "Заголовок поля", defaultWidth: 120 },
  { key: "fieldType", title: "Тип поля", defaultWidth: 100 },
  { key: "fieldRequired", title: "Обязательное", defaultWidth: 100 },
  { key: "fieldDefaultString", title: "Знач. по умолч. (строка)", defaultWidth: 120 },
  { key: "fieldDefaultNumeric", title: "Знач. по умолч. (число)", defaultWidth: 110 },
  { key: "fieldDefaultBoolean", title: "Знач. по умолч. (булево)", defaultWidth: 110 },
  { key: "fieldShow", title: "В UI", defaultWidth: 80 },
  { key: "fieldEdit", title: "Редактирование", defaultWidth: 110 },
  { key: "uniqueValue", title: "Уникальное значение", defaultWidth: 120 },
  { key: "fieldValues", title: "Значение (хранение)", defaultWidth: 140 },
  { key: "fieldValueShow", title: "Отображение", defaultWidth: 140 },
  {
    key: "fieldLinkTable",
    title: "Связь таблица",
    hint: "Таблица, из которой берётся подпись (например party.organ_unit)",
    defaultWidth: 120
  },
  {
    key: "fieldLinkField",
    title: "Ключ связи",
    hint:
      "Столбец в этой таблице, равный значению в строке справочника (для организации обычно id, не sh_name)",
    defaultWidth: 100
  },
  {
    key: "fieldLinkShowFields",
    title: "Подпись (показ)",
    hint: "Что вывести в ячейке (например sh_name); порядок — orderPos",
    defaultWidth: 160
  },
  { key: "fieldLinkShowLists", title: "Связь список", defaultWidth: 160 },
  {
    key: "fieldLinkListType",
    title: "Тип списка",
    hint: "Полный — при открытии полный список (до 100); Совпадение — только по введённому тексту с подгрузкой",
    defaultWidth: 140
  },
  { key: "fieldLinkShowTooltips", title: "Связь тултип", defaultWidth: 160 },
  { key: "fieldLinkFiltr", title: "Условие доступности", defaultWidth: 180 },
  { key: "fieldShowLink", title: "Гиперссылка", defaultWidth: 120 },
  { key: "fieldCartType", title: "Тип карточки", defaultWidth: 120 },
  { key: "actions", title: "", defaultWidth: 48 }
];

export function getDefaultReferenceBookFieldColumnWidths() {
  return REFERENCE_BOOK_FIELD_TABLE_COLUMNS.reduce((acc, col) => {
    acc[col.key] = col.defaultWidth;
    return acc;
  }, {});
}

export function parseStoredReferenceBookFieldColumnWidths() {
  const defaults = getDefaultReferenceBookFieldColumnWidths();
  try {
    const raw = window.localStorage.getItem(REFERENCE_BOOK_FIELD_TABLE_STORAGE_KEY);
    if (!raw) {
      return { ...defaults };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...defaults };
    }
    const next = { ...defaults };
    for (const col of REFERENCE_BOOK_FIELD_TABLE_COLUMNS) {
      const w = Number(parsed[col.key]);
      if (Number.isFinite(w)) {
        next[col.key] = Math.max(REFERENCE_BOOK_FIELD_TABLE_MIN_WIDTH, Math.round(w));
      }
    }
    return next;
  } catch {
    return { ...defaults };
  }
}
