export const REPORT_TEMPLATE_DATA_TYPE_OPTIONS = [
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "boolean", label: "Булево (true/false)" },
  { value: "date", label: "Дата" },
  { value: "datetime", label: "Дата/время" }
];

export const REPORT_TEMPLATE_DATA_FORMAT_OPTIONS = {
  text: [
    { value: "", label: "Без формата" },
    { value: "@", label: "Текст (@)" }
  ],
  number: [
    { value: "0", label: "Целое (0)" },
    { value: "0.0", label: "С 1 знаком (0.0)" },
    { value: "0.00", label: "С 2 знаками (0.00)" },
    { value: "0.000", label: "С 3 знаками (0.000)" },
    { value: "#,##0.00", label: "Разделитель тысяч (#,##0.00)" }
  ],
  boolean: [{ value: "", label: "Без формата" }],
  date: [
    { value: "ДД.ММ.ГГГГ", label: "ДД.ММ.ГГГГ" },
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }
  ],
  datetime: [
    { value: "ДД.ММ.ГГГГ чч:мм;@", label: "ДД.ММ.ГГГГ чч:мм;@" },
    { value: "YYYY-MM-DD HH:mm:ss", label: "YYYY-MM-DD HH:mm:ss" }
  ]
};

export const REPORT_TEMPLATE_VERTICAL_ALIGN_OPTIONS = [
  { value: "ВЕРХ", label: "ВЕРХ" },
  { value: "СЕРЕДИНА", label: "СЕРЕДИНА" },
  { value: "НИЗ", label: "НИЗ" }
];

export const REPORT_TEMPLATE_HORIZONTAL_ALIGN_OPTIONS = [
  { value: "СЛЕВА", label: "СЛЕВА" },
  { value: "ЦЕНТР", label: "ЦЕНТР" },
  { value: "СПРАВА", label: "СПРАВА" }
];

export const REPORT_TEMPLATE_FIELDS_COLUMNS = [
  { key: "fieldOrderNumber", title: "Пор.№" },
  { key: "fieldName", title: "Название поля" },
  { key: "reportVisible", title: "Показывать" },
  { key: "fieldCaption", title: "Заголовок поля" },
  { key: "fieldDataType", title: "Тип данных" },
  { key: "fieldDataFormat", title: "Формат данных" },
  { key: "fieldVertAlign", title: "Выр. по вертикали" },
  { key: "fieldHorizAlign", title: "Выр. по горизонтали" },
  { key: "fieldLink", title: "Ссылка" },
  { key: "fieldAutoWidth", title: "Автоширина" },
  { key: "filedWidth", title: "Ширина (Excel)" },
  { key: "fieldAutoTransfer", title: "Автоперенос" },
  { key: "fieldBoldFont", title: "Жирный шрифт" }
];

export const REPORT_TEMPLATE_FIELDS_MIN_COLUMN_WIDTH_PX = 120;

export const REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS = {
  fieldOrderNumber: 150,
  fieldName: 240,
  reportVisible: 130,
  fieldCaption: 240,
  fieldDataType: 140,
  fieldDataFormat: 170,
  fieldVertAlign: 170,
  fieldHorizAlign: 170,
  fieldLink: 160,
  filedWidth: 140,
  fieldAutoWidth: 120,
  fieldAutoTransfer: 130,
  fieldBoldFont: 120
};

export const REPORT_TEMPLATE_GENERAL_SETTINGS_COLUMNS = {
  parameter: { key: "parameter", title: "Параметр" },
  value: { key: "value", title: "Значение параметра" }
};

export const REPORT_TEMPLATE_GENERAL_SETTINGS_MIN_PARAMETER_COL_PX = 220;
export const REPORT_TEMPLATE_GENERAL_SETTINGS_MIN_VALUE_COL_PX = 220;
export const REPORT_TEMPLATE_GENERAL_SETTINGS_DEFAULT_PARAMETER_COL_PX = 360;

export const REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS = {
  ASC: "ASC",
  DESC: "DESC"
};

export const REPORT_TEMPLATE_GENERAL_SETTINGS_ROWS = [
  { key: "showLogoReport", label: "Отображение логотипа", type: "boolean" },
  { key: "headerCaption", label: "Заголовок отчета", type: "text" },
  { key: "headerFontSize", label: "Размер шрифта заголовка отчета, px", type: "number" },
  { key: "headerFontColor", label: "Цвет шрифта заголовка отчета", type: "color" },
  { key: "heightTabCaption", label: "Высота табличного заголовка, px", type: "number" },
  { key: "backTabCaptionColor", label: "Цвет фона табличного заголовка", type: "color" },
  { key: "fontTabCaptionColor", label: "Цвет шрифта табличного заголовка", type: "color" },
  { key: "fontTabCaptionSize", label: "Размер шрифта табличного заголовка, px", type: "number" },
  { key: "recordFontSize", label: "Размер шрифта записей таблицы, px", type: "number" },
  { key: "startReportRow", label: "Номер начальной строки отчета", type: "number" },
  { key: "startReportCol", label: "Номер начальной колонки отчета", type: "number" },
  { key: "filtrSet", label: "Включить фильтр", type: "boolean" }
];

export const REPORT_TEMPLATE_GENERAL_SETTINGS_ROWS_ASC = [...REPORT_TEMPLATE_GENERAL_SETTINGS_ROWS].sort(
  (left, right) =>
    left.label.localeCompare(right.label, "ru-RU", {
      sensitivity: "base",
      numeric: true
    })
);
