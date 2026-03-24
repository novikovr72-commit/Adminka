import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IconArrowRight, IconChevronLeft, IconChevronRight } from "./AppIcons";
import TableColumnSettingsPanel from "./TableColumnSettingsPanel";
import ReferenceBookRecordFormPanel from "./ReferenceBookRecordFormPanel";
import { REPORT_CARD_LIST_TRANSITION_MS } from "../reportCardConstants";
import { registerReferenceBookDataHeaderHandlers } from "../referenceBookDataHeaderHandlers";
import { fitListColumnsToTargetWidth } from "../listColumnFit";
import {
  normalizeFieldCartTypeValue,
  normalizeFieldLinkListTypeFromApi,
  normalizeFieldLinkShowFieldsFromApi,
  normalizeFieldLinkShowListsFromApi,
  normalizeFieldLinkShowTooltipsFromApi,
  normalizeFieldShowLinkValue,
  referenceUrlSuffixFromTableName
} from "../referenceBookProperties";
import { buildEmployeeCardUrl, buildOrganizationCardUrl } from "../utils/referenceBookCardLinks";

/** Минимум при ручном ресайзе и при автоподгонке ширины таблицы под контейнер (меньше, чем у списков 90px). */
const MIN_COLUMN_WIDTH = 56;
/** Как у `.employee-card-position-action-button` в index.css */
const ROW_ACTION_BUTTON_WIDTH_PX = 42;
/** Две кнопки + зазор — минимум ширины колонки действий (как список справочников: фикс. ширина через colgroup) */
const MIN_ACTIONS_COLUMN_WIDTH_PX = Math.ceil(ROW_ACTION_BUTTON_WIDTH_PX * 2 + 6);
/** Колонка «Изменить/Удалить» по умолчанию не шире 2.5× кнопки */
const ACTIONS_COLUMN_MAX_WIDTH_PX = Math.ceil(ROW_ACTION_BUTTON_WIDTH_PX * 2.5);

const REFERENCE_BOOK_DATA_STORAGE_SUFFIX = ".v1";

const LINK_RAW_SUFFIX = "__linkRaw";
const LINK_TIP_SUFFIX = "__linkTooltip";

/** Сырое значение / тултип связи: ключи как в JSON с бэкенда (snake_case и дубль camelCase). */
function referenceBookRowFieldAux(row, fieldKey, suffix) {
  if (row == null || fieldKey == null) {
    return undefined;
  }
  const fk = String(fieldKey).trim();
  if (!fk) {
    return undefined;
  }
  const tryKeys = [fk + suffix];
  if (fk.includes("_")) {
    const camel = fk.replace(/_([a-z0-9])/gi, (_, ch) => ch.toUpperCase());
    if (camel !== fk) {
      tryKeys.push(camel + suffix);
    }
  }
  for (const k of tryKeys) {
    if (Object.prototype.hasOwnProperty.call(row, k)) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") {
        return v;
      }
    }
  }
  for (const k of Object.keys(row)) {
    if (!k.endsWith(suffix)) {
      continue;
    }
    const base = k.slice(0, -suffix.length);
    if (base === fk || base.toLowerCase() === fk.toLowerCase()) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") {
        return v;
      }
    }
  }
  return undefined;
}

function referenceBookDataStorageKey(referenceBookUrlSuffix) {
  const s = String(referenceBookUrlSuffix ?? "").trim();
  return s ? `reference-book-data.${s}${REFERENCE_BOOK_DATA_STORAGE_SUFFIX}` : "";
}

function getFieldLinkMeta(col) {
  const table = String(col?.fieldLinkTable ?? col?.field_link_table ?? "").trim();
  const field = String(col?.fieldLinkField ?? col?.field_link_field ?? "").trim();
  const showFields = normalizeFieldLinkShowFieldsFromApi(col);
  const showLists = normalizeFieldLinkShowListsFromApi(col).filter((r) => String(r?.fieldLinkShowList ?? "").trim());
  return { table, field, showFields, showLists };
}

/** Колонка настроена на связь (fieldLinkShowFields и/или fieldLinkShowLists). */
function hasFieldLinkColumn(col) {
  const { table, field, showFields, showLists } = getFieldLinkMeta(col);
  return Boolean(table && field && (showFields.length > 0 || showLists.length > 0));
}

function buildReferenceBookDataHrefByFieldLinkTable(fieldLinkTable) {
  const suffix = referenceUrlSuffixFromTableName(String(fieldLinkTable ?? "").trim());
  if (!suffix) {
    return "";
  }
  return `/reference-books/${encodeURIComponent(suffix)}`;
}

/** Гиперссылка для колонки со связью: справочник / карточка орг. или сотрудника; ID — сырое значение поля связи. */
function resolveFieldLinkHref(col, row) {
  if (!hasFieldLinkColumn(col)) {
    return "";
  }
  const showLink = normalizeFieldShowLinkValue(col.fieldShowLink ?? col.field_show_link);
  if (showLink === "Нет") {
    return "";
  }
  if (showLink === "Справочник") {
    return buildReferenceBookDataHrefByFieldLinkTable(getFieldLinkMeta(col).table);
  }
  if (showLink === "Карточка") {
    const raw = referenceBookRowFieldAux(row, col.key, LINK_RAW_SUFFIX) ?? row[col.key];
    const cartType = normalizeFieldCartTypeValue(col.fieldCartType ?? col.field_cart_type, showLink);
    if (cartType === "Сотрудник") {
      return buildEmployeeCardUrl(raw);
    }
    return buildOrganizationCardUrl(raw);
  }
  return "";
}

function parseStoredJson(key, fallback) {
  if (typeof window === "undefined" || !key) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

let xlsxModulePromise = null;
function loadXlsxModule() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx").then((mod) => mod.default ?? mod);
  }
  return xlsxModulePromise;
}

function columnFieldKey(col) {
  return String(col?.fieldName ?? col?.field_name ?? "").trim();
}

function columnCaption(col) {
  return String(col?.fieldCaption ?? col?.field_caption ?? col?.fieldName ?? col?.field_name ?? "").trim();
}

/** Строка из properties (camelCase / snake_case в jsonb). */
function normalizeFieldValueRowFromApi(row) {
  if (row == null || typeof row !== "object") {
    return { fieldValueString: "", fieldValueShow: "" };
  }
  const fieldValueString = String(row.fieldValueString ?? row.field_value_string ?? "").trim();
  const showRaw = String(row.fieldValueShow ?? row.field_value_show ?? "").trim();
  return {
    fieldValueString,
    fieldValueShow: showRaw || fieldValueString
  };
}

function fieldValuesMatchStored(rawStored, rawCell) {
  const a = String(rawStored ?? "").trim();
  const b = String(rawCell ?? "").trim();
  if (a === "" || b === "") {
    return false;
  }
  if (a === b) {
    return true;
  }
  return a.toLowerCase() === b.toLowerCase();
}

/** Если в columns нет fieldValues (старый ответ / jsonb snake_case), подмешиваем из referenceBook.properties.fields. То же для fieldLink*. */
function mergeColumnsFieldValuesFromProperties(columnsList, referenceBook) {
  const rb = referenceBook ?? {};
  const propsFields = Array.isArray(rb.properties?.fields) ? rb.properties.fields : [];
  if (!Array.isArray(columnsList) || columnsList.length === 0) {
    return columnsList;
  }
  if (propsFields.length === 0) {
    return columnsList;
  }
  return columnsList.map((c) => {
    const k = columnFieldKey(c);
    if (!k) {
      return c;
    }
    const pf = propsFields.find((f) => columnFieldKey(f) === k);
    let next = c;

    const hasFv = Array.isArray(c.fieldValues) && c.fieldValues.length > 0;
    if (!hasFv && pf) {
      const rawFv = pf?.fieldValues;
      if (Array.isArray(rawFv) && rawFv.length > 0) {
        next = { ...next, fieldValues: rawFv.map(normalizeFieldValueRowFromApi) };
      }
    }

    if (pf && !hasFieldLinkColumn(next)) {
      const lt = String(pf.fieldLinkTable ?? pf.field_link_table ?? "").trim();
      const lf = String(pf.fieldLinkField ?? pf.field_link_field ?? "").trim();
      const showF = normalizeFieldLinkShowFieldsFromApi(pf);
      const showL = normalizeFieldLinkShowListsFromApi(pf).filter((r) => String(r?.fieldLinkShowList ?? "").trim());
      if (lt && lf && (showF.length > 0 || showL.length > 0)) {
        next = {
          ...next,
          fieldLinkTable: lt,
          fieldLinkField: lf,
          fieldLinkShowFields: showF,
          fieldLinkShowLists: normalizeFieldLinkShowListsFromApi(pf),
          fieldLinkShowTooltips: normalizeFieldLinkShowTooltipsFromApi(pf),
          fieldLinkFiltr: String(pf.fieldLinkFiltr ?? pf.field_link_filtr ?? "").trim(),
          fieldLinkListType: normalizeFieldLinkListTypeFromApi(pf),
          fieldShowLink: normalizeFieldShowLinkValue(pf.fieldShowLink ?? pf.field_show_link),
          fieldCartType: normalizeFieldCartTypeValue(
            pf.fieldCartType ?? pf.field_cart_type,
            pf.fieldShowLink ?? pf.field_show_link
          )
        };
      }
    }

    if (pf && hasFieldLinkColumn(next)) {
      next = {
        ...next,
        fieldShowLink: normalizeFieldShowLinkValue(pf.fieldShowLink ?? pf.field_show_link ?? next.fieldShowLink),
        fieldCartType: normalizeFieldCartTypeValue(
          pf.fieldCartType ?? pf.field_cart_type,
          pf.fieldShowLink ?? pf.field_show_link
        ),
        fieldLinkListType: normalizeFieldLinkListTypeFromApi(pf)
      };
    }

    if (pf) {
      if (next.fieldRequired === undefined) {
        next = { ...next, fieldRequired: Boolean(pf.fieldRequired) };
      }
      if (next.fieldEdit === undefined) {
        next = { ...next, fieldEdit: pf.fieldEdit !== false };
      }
      if (next.uniqueValue === undefined) {
        next = { ...next, uniqueValue: Boolean(pf.uniqueValue) };
      }
      const ft = String(next.fieldType ?? next.field_type ?? "varchar").toLowerCase();
      if (next.fieldDefaultValueString === undefined && next.fieldDefaultValueNumeric === undefined && next.fieldDefaultValueBoolean === undefined) {
        if (ft === "numeric") {
          const n = pf.fieldDefaultValueNumeric;
          next = {
            ...next,
            fieldDefaultValueNumeric: n != null && n !== "" ? n : null,
            fieldDefaultValueString: null,
            fieldDefaultValueBoolean: null
          };
        } else if (ft === "boolean") {
          next = {
            ...next,
            fieldDefaultValueBoolean: pf.fieldDefaultValueBoolean === true,
            fieldDefaultValueString: null,
            fieldDefaultValueNumeric: null
          };
        } else {
          next = {
            ...next,
            fieldDefaultValueString: pf.fieldDefaultValueString != null ? String(pf.fieldDefaultValueString) : "",
            fieldDefaultValueNumeric: null,
            fieldDefaultValueBoolean: null
          };
        }
      }
    }

    return next;
  });
}

const ACTIONS_COLUMN_KEY = "__actions";

function getRowStableKey(row, rowIndex) {
  if (row == null || typeof row !== "object") {
    return `row-${rowIndex}`;
  }
  if (row.id != null && String(row.id).trim() !== "") {
    return String(row.id);
  }
  const idKey = Object.keys(row).find((k) => k.toLowerCase() === "id");
  if (idKey != null && row[idKey] != null && String(row[idKey]).trim() !== "") {
    return String(row[idKey]);
  }
  return `row-${rowIndex}`;
}

/** Та же запись после перезагрузки списка (другой объект по ссылке) */
function referenceBookDataRowSameRecord(a, b) {
  if (a == null || b == null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (a === b) {
    return true;
  }
  if (a.id != null && b.id != null && String(a.id).trim() !== "" && String(b.id).trim() !== "") {
    return String(a.id) === String(b.id);
  }
  const keyA = Object.keys(a).find((k) => k.toLowerCase() === "id");
  const keyB = Object.keys(b).find((k) => k.toLowerCase() === "id");
  if (
    keyA &&
    keyB &&
    a[keyA] != null &&
    b[keyB] != null &&
    String(a[keyA]).trim() !== "" &&
    String(b[keyB]).trim() !== ""
  ) {
    return String(a[keyA]) === String(b[keyB]);
  }
  return false;
}

function formatCellValue(value, fieldType, columnMeta) {
  if (value === null || value === undefined) {
    return "";
  }
  const t = String(fieldType ?? "varchar").toLowerCase();
  const list = columnMeta?.fieldValues;
  const fieldNameKey = String(
    columnMeta?.key ?? columnMeta?.fieldName ?? columnMeta?.field_name ?? ""
  ).trim();
  if (t === "varchar" && Array.isArray(list) && list.length > 0 && fieldNameKey) {
    const entryForFieldName = list.find((fv) => fieldValuesMatchStored(fv?.fieldValueString, fieldNameKey));
    if (entryForFieldName) {
      const vNorm = String(value ?? "").trim();
      const fnNorm = fieldNameKey;
      const sameAsFieldName =
        vNorm === fnNorm ||
        vNorm.toLowerCase() === fnNorm.toLowerCase();
      if (sameAsFieldName) {
        const show = String(entryForFieldName.fieldValueShow ?? "").trim();
        if (show !== "") {
          return show;
        }
      }
    }
  }
  if (t === "varchar" && Array.isArray(list) && list.length > 0) {
    const hit = list.find((fv) => fieldValuesMatchStored(fv?.fieldValueString, value));
    if (hit) {
      const show = String(hit.fieldValueShow ?? "").trim();
      if (show !== "") {
        return show;
      }
    }
  }
  if (t === "boolean") {
    if (typeof value === "boolean") {
      return value ? "Да" : "Нет";
    }
    const s = String(value).toLowerCase();
    if (s === "t" || s === "true" || s === "1") {
      return "Да";
    }
    if (s === "f" || s === "false" || s === "0") {
      return "Нет";
    }
    return String(value);
  }
  if (t === "date" || t === "datetime") {
    const d = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return t === "date" ? d.toLocaleDateString("ru-RU") : d.toLocaleString("ru-RU");
    }
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function ReferenceBookDataPage({
  referenceBookUrlSuffix,
  listApiUrl,
  isDarkThemeEnabled = false,
  showSystemErrorToast = () => {},
  showSystemSuccessToast = () => {},
  onToolbarMeta,
  onPageTitleChange,
  onAddRecord,
  onEditRecord,
  onDeleteRecord,
  isMainGridCellTooltipEnabled = true,
  handleCellMouseEnter,
  updateCellTooltipPosition,
  handleCellMouseLeave
}) {
  const tableWrapperRef = useRef(null);
  const pageJumpInputRef = useRef(null);
  const mainBlockRef = useRef(null);
  const bottomControlsRef = useRef(null);

  const [columns, setColumns] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [referenceBook, setReferenceBook] = useState(null);
  /** Первый кадр со справочником — сразу «загрузка», без пустого состояния */
  const [loading, setLoading] = useState(() => Boolean(String(referenceBookUrlSuffix ?? "").trim()));
  const [loadError, setLoadError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [columnWidths, setColumnWidths] = useState({});
  const [filters, setFilters] = useState({});
  const [debouncedFilters, setDebouncedFilters] = useState({});
  const [columnSettings, setColumnSettings] = useState([]);
  const [sortRules, setSortRules] = useState([]);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [settingsPanelBounds, setSettingsPanelBounds] = useState({ top: 0, bottom: 0, right: 0 });
  const skipPersistAfterHydrateRef = useRef(true);
  /** После успешной загрузки строк для `referenceBookUrlSuffix` — повторные запросы без полной подмены таблицы на «Загрузка...» */
  const rowsShownForIdRef = useRef(null);
  /** Смена набора фильтров → первый запрос с offset 1, даже если currentPage ещё старый */
  const prevFilterKeyForFetchRef = useRef(null);

  const [selectedRowKey, setSelectedRowKey] = useState(null);
  /** null | 'add' | 'edit' — боковая панель записи (как карточка справочника в списке) */
  const [recordFormMode, setRecordFormMode] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [recordListTransitioning, setRecordListTransitioning] = useState(false);
  const recordListSnapshotRef = useRef(null);
  const recordListTransitionTimeoutRef = useRef(null);

  const insertFormFields = useMemo(
    () => mergeColumnsFieldValuesFromProperties(columns, referenceBook),
    [columns, referenceBook]
  );

  useLayoutEffect(() => {
    skipPersistAfterHydrateRef.current = true;
    prevFilterKeyForFetchRef.current = null;
    const id = String(referenceBookUrlSuffix ?? "").trim();
    rowsShownForIdRef.current = null;
    setSelectedRowKey(null);
    setRecordFormMode(null);
    setEditRow(null);
    if (!id) {
      setLoading(false);
      return;
    }
    setItems([]);
    setColumns([]);
    setTotal(0);
    setReferenceBook(null);
    setLoadError("");
    setLoading(true);

    const key = referenceBookDataStorageKey(referenceBookUrlSuffix);
    const stored = parseStoredJson(key, null);
    if (stored && typeof stored === "object") {
      if (stored.filters && typeof stored.filters === "object") {
        setFilters(stored.filters);
        setDebouncedFilters(stored.filters);
      } else {
        setFilters({});
        setDebouncedFilters({});
      }
      if (Array.isArray(stored.sortRules)) {
        setSortRules(
          stored.sortRules
            .filter(
              (r) =>
                r &&
                typeof r === "object" &&
                typeof r.field === "string" &&
                (r.direction === "ASC" || r.direction === "DESC")
            )
            .map((r) => ({ field: r.field, direction: r.direction }))
        );
      } else {
        setSortRules([]);
      }
      if (stored.columnWidths && typeof stored.columnWidths === "object") {
        setColumnWidths(stored.columnWidths);
      } else {
        setColumnWidths({});
      }
      if (Array.isArray(stored.columnSettings)) {
        setColumnSettings(stored.columnSettings.map((item) => ({ ...item })));
      } else {
        setColumnSettings([]);
      }
      if (typeof stored.pageSize === "number" && [20, 50, 100].includes(stored.pageSize)) {
        setPageSize(stored.pageSize);
      } else {
        setPageSize(50);
      }
      if (typeof stored.currentPage === "number" && stored.currentPage >= 1) {
        setCurrentPage(Math.floor(stored.currentPage));
      } else {
        setCurrentPage(1);
      }
    } else {
      setFilters({});
      setDebouncedFilters({});
      setSortRules([]);
      setColumnWidths({});
      setColumnSettings([]);
      setPageSize(50);
      setCurrentPage(1);
    }
  }, [referenceBookUrlSuffix]);

  useEffect(() => {
    const key = referenceBookDataStorageKey(referenceBookUrlSuffix);
    if (!key) {
      return;
    }
    if (skipPersistAfterHydrateRef.current) {
      skipPersistAfterHydrateRef.current = false;
      return;
    }
    const payload = {
      filters,
      sortRules,
      columnWidths,
      columnSettings,
      pageSize,
      currentPage
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, [referenceBookUrlSuffix, filters, sortRules, columnWidths, columnSettings, pageSize, currentPage]);

  const fetchPage = useCallback(async () => {
    const id = String(referenceBookUrlSuffix ?? "").trim();
    if (!id) {
      return;
    }
    const showBlockingLoading = rowsShownForIdRef.current !== id;
    if (showBlockingLoading) {
      setLoading(true);
    }
    setLoadError("");
    try {
      const filterKey = JSON.stringify(debouncedFilters);
      let pageToUse = currentPage;
      if (prevFilterKeyForFetchRef.current !== null && prevFilterKeyForFetchRef.current !== filterKey) {
        pageToUse = 1;
        if (currentPage !== 1) {
          setCurrentPage(1);
        }
      }
      prevFilterKeyForFetchRef.current = filterKey;
      const response = await fetch(`${listApiUrl}/${encodeURIComponent(id)}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: pageSize,
          offset: pageToUse,
          sorts: sortRules.map((rule) => ({ field: rule.field, direction: rule.direction })),
          filters: debouncedFilters
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Ошибка ${response.status}`);
      }
      setColumns(Array.isArray(data.columns) ? data.columns : []);
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total ?? data.total_count) || 0);
      setReferenceBook(data.referenceBook ?? data.reference_book ?? null);
      setColumnWidths((prev) => {
        const next = { ...prev };
        const list = Array.isArray(data.columns) ? data.columns : [];
        for (const col of list) {
          const key = columnFieldKey(col);
          if (key && next[key] == null) {
            const cap = columnCaption(col) || key;
            next[key] = Math.max(MIN_COLUMN_WIDTH, Math.min(360, cap.length * 9 + 40));
          }
        }
        return next;
      });
      rowsShownForIdRef.current = id;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Ошибка загрузки");
      showSystemErrorToast(err instanceof Error ? err.message : "Ошибка загрузки");
      setItems([]);
      setTotal(0);
      setColumns([]);
      setReferenceBook(null);
      rowsShownForIdRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [referenceBookUrlSuffix, listApiUrl, currentPage, pageSize, sortRules, debouncedFilters, showSystemErrorToast]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(filters), 320);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    setColumnSettings((prev) => {
      const keys = columns.map((c) => columnFieldKey(c)).filter(Boolean);
      const prevMap = new Map(prev.map((p) => [p.key, p]));
      return keys.map((k) => {
        const old = prevMap.get(k);
        return old ?? { key: k, visible: true, pin: "none" };
      });
    });
  }, [columns]);

  useEffect(() => {
    setFilters((prev) => {
      const next = {};
      for (const col of columns) {
        const k = columnFieldKey(col);
        if (k) {
          next[k] = prev[k] ?? "";
        }
      }
      return next;
    });
  }, [columns]);

  useEffect(() => {
    if (columns.length === 0) {
      return;
    }
    const allowed = new Set(columns.map((c) => columnFieldKey(c)).filter(Boolean));
    setSortRules((prev) => {
      const next = prev.filter(
        (r) => allowed.has(r.field) && (r.direction === "ASC" || r.direction === "DESC")
      );
      if (
        next.length === prev.length &&
        next.every((r, i) => prev[i]?.field === r.field && prev[i]?.direction === r.direction)
      ) {
        return prev;
      }
      return next;
    });
  }, [columns]);

  useEffect(() => {
    const rb = referenceBook ?? {};
    const addRecords = (rb.addRecords ?? rb.add_records) === true;
    const er = (rb.editRecords ?? rb.edit_records) === true;
    if (typeof onToolbarMeta === "function") {
      onToolbarMeta({ addRecords, editRecords: er });
    }
  }, [referenceBook, onToolbarMeta]);

  useEffect(() => {
    if (typeof onPageTitleChange !== "function") {
      return;
    }
    const rb = referenceBook ?? {};
    const line =
      [rb.code, rb.name].filter(Boolean).join(" — ") || String(rb.name ?? rb.code ?? "").trim();
    onPageTitleChange(line);
  }, [referenceBook, onPageTitleChange]);

  const hasActiveFilters = useMemo(
    () => Object.values(debouncedFilters).some((v) => String(v ?? "").trim() !== ""),
    [debouncedFilters]
  );

  const columnDefsByKey = useMemo(() => {
    const merged = mergeColumnsFieldValuesFromProperties(columns, referenceBook);
    const m = new Map();
    for (const c of merged) {
      const k = columnFieldKey(c);
      if (k) {
        m.set(k, c);
      }
    }
    return m;
  }, [columns, referenceBook]);

  const settingsColumnsForPanel = useMemo(
    () =>
      columnSettings.map((s) => {
        const col = columnDefsByKey.get(s.key);
        return {
          key: s.key,
          title: col ? columnCaption(col) || s.key : s.key
        };
      }),
    [columnSettings, columnDefsByKey]
  );

  const renderedColumnDefs = useMemo(() => {
    return columnSettings
      .filter((s) => s.visible)
      .map((s) => {
        const col = columnDefsByKey.get(s.key);
        if (!col) {
          return null;
        }
        return {
          key: s.key,
          title: columnCaption(col) || s.key,
          fieldType: col.fieldType ?? col.field_type,
          pin: s.pin,
          fieldValues: Array.isArray(col.fieldValues) ? col.fieldValues : undefined,
          fieldLinkTable: col.fieldLinkTable ?? col.field_link_table,
          fieldLinkField: col.fieldLinkField ?? col.field_link_field,
          fieldLinkShowFields: col.fieldLinkShowFields ?? col.field_link_show_fields,
          fieldLinkShowLists: col.fieldLinkShowLists ?? col.field_link_show_lists,
          fieldLinkShowTooltips: col.fieldLinkShowTooltips ?? col.field_link_show_tooltips,
          fieldLinkFiltr: col.fieldLinkFiltr ?? col.field_link_filtr,
          fieldLinkListType: col.fieldLinkListType ?? col.field_link_list_type,
          fieldShowLink: col.fieldShowLink ?? col.field_show_link,
          fieldCartType: col.fieldCartType ?? col.field_cart_type
        };
      })
      .filter(Boolean);
  }, [columnSettings, columnDefsByKey]);

  const editRecords = useMemo(() => {
    const rb = referenceBook ?? {};
    return (rb.editRecords ?? rb.edit_records) === true;
  }, [referenceBook]);

  /** Действия строки — в карточке записи (клик по строке открывает просмотр), не в таблице */
  const showRowActions = false;

  const tableColumnDefs = useMemo(() => {
    if (!showRowActions) {
      return renderedColumnDefs;
    }
    return [
      ...renderedColumnDefs,
      {
        key: ACTIONS_COLUMN_KEY,
        title: "",
        fieldType: "actions",
        pin: "none",
        isActions: true
      }
    ];
  }, [renderedColumnDefs, showRowActions]);

  useEffect(() => {
    if (!showRowActions) {
      return;
    }
    setColumnWidths((prev) => {
      if (prev[ACTIONS_COLUMN_KEY] != null) {
        return prev;
      }
      return { ...prev, [ACTIONS_COLUMN_KEY]: ACTIONS_COLUMN_MAX_WIDTH_PX };
    });
  }, [showRowActions]);

  useEffect(() => {
    if (!selectedRowKey) {
      return;
    }
    const keys = new Set(items.map((row, idx) => getRowStableKey(row, idx)));
    if (keys.has(selectedRowKey)) {
      return;
    }
    /* После fetch объекты строк новые — ключ мог разъехаться; пока открыта правка, не гасим выделение, если запись по id всё ещё в списке */
    if (
      (recordFormMode === "edit" || recordFormMode === "view") &&
      editRow != null &&
      items.some((r) => referenceBookDataRowSameRecord(r, editRow))
    ) {
      return;
    }
    setSelectedRowKey(null);
  }, [items, selectedRowKey, recordFormMode, editRow]);

  const calculateSettingsPanelBounds = useCallback(() => {
    const mainEl = mainBlockRef.current;
    if (!mainEl) {
      return { top: 0, bottom: 0, right: 0 };
    }
    const listLayoutRect =
      mainEl.querySelector(".list-content-layout")?.getBoundingClientRect() ?? mainEl.getBoundingClientRect();
    const bottomRect = bottomControlsRef.current?.getBoundingClientRect();
    const bottomEdge = bottomRect?.bottom ?? window.innerHeight - 24;
    return {
      top: Math.max(0, listLayoutRect.top),
      bottom: Math.max(0, window.innerHeight - bottomEdge),
      right: Math.max(0, window.innerWidth - listLayoutRect.right - 3)
    };
  }, []);

  const handleChangeFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getSortDirectionForField = (fieldKey) => {
    const match = sortRules.find((rule) => rule.field === fieldKey);
    return match ? match.direction : null;
  };

  const getSortOrderForField = (fieldKey) => {
    const sortIndex = sortRules.findIndex((rule) => rule.field === fieldKey);
    return sortIndex >= 0 ? sortIndex + 1 : null;
  };

  const handleSortClick = useCallback((columnSortField) => {
    setCurrentPage(1);
    setSortRules((prev) => {
      const currentRule = prev.find((rule) => rule.field === columnSortField);
      let nextRules;
      if (!currentRule) {
        nextRules = [...prev, { field: columnSortField, direction: "ASC" }];
      } else if (currentRule.direction === "ASC") {
        nextRules = prev.map((rule) =>
          rule.field === columnSortField ? { ...rule, direction: "DESC" } : rule
        );
      } else {
        nextRules = prev.filter((rule) => rule.field !== columnSortField);
      }
      return nextRules;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = "";
      }
      return next;
    });
  }, []);

  const handleAlignColumns = useCallback(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const reservedActionsWidth = showRowActions ? ACTIONS_COLUMN_MAX_WIDTH_PX : 0;
    const dataColsMeta = renderedColumnDefs.map((col) => {
      const k = col.key;
      const def = columnDefsByKey.get(k);
      const cap = columnCaption(def) || k;
      const w = Math.max(MIN_COLUMN_WIDTH, Math.min(360, cap.length * 9 + 40));
      return { key: k, width: w };
    });
    if (dataColsMeta.length === 0) {
      setColumnWidths((prev) => {
        if (!showRowActions) {
          return prev;
        }
        return { ...prev, [ACTIONS_COLUMN_KEY]: reservedActionsWidth };
      });
      return;
    }
    const targetTotalWidth = wrapper.clientWidth - reservedActionsWidth;
    if (targetTotalWidth <= 0) {
      return;
    }
    const scaled = fitListColumnsToTargetWidth(dataColsMeta, targetTotalWidth, MIN_COLUMN_WIDTH);
    if (!scaled) {
      return;
    }
    setColumnWidths((prev) => {
      const next = { ...prev };
      for (const row of scaled) {
        next[row.key] = row.width;
      }
      if (showRowActions) {
        next[ACTIONS_COLUMN_KEY] = reservedActionsWidth;
      } else {
        delete next[ACTIONS_COLUMN_KEY];
      }
      return next;
    });
    if (wrapper instanceof HTMLElement) {
      wrapper.scrollLeft = 0;
    }
  }, [showRowActions, renderedColumnDefs, columnDefsByKey]);

  const handleDeleteRow = useCallback(
    (row) => {
      if (typeof onDeleteRecord === "function") {
        onDeleteRecord(row);
        return;
      }
      showSystemSuccessToast("Удаление записи справочника пока не реализовано.");
    },
    [onDeleteRecord, showSystemSuccessToast]
  );

  const handleOpenColumnSettings = useCallback(() => {
    setSettingsPanelBounds(calculateSettingsPanelBounds());
    setIsColumnSettingsOpen(true);
  }, [calculateSettingsPanelBounds]);

  const handleApplyColumnSettings = (draft) => {
    setColumnSettings(draft.map((item) => ({ ...item })));
    setIsColumnSettingsOpen(false);
  };

  const startRecordFormListTransition = useCallback(() => {
    recordListSnapshotRef.current = { items: [...items] };
    if (recordListTransitionTimeoutRef.current) {
      window.clearTimeout(recordListTransitionTimeoutRef.current);
      recordListTransitionTimeoutRef.current = 0;
    }
    setRecordListTransitioning(true);
    recordListTransitionTimeoutRef.current = window.setTimeout(() => {
      setRecordListTransitioning(false);
      recordListSnapshotRef.current = null;
      recordListTransitionTimeoutRef.current = 0;
    }, REPORT_CARD_LIST_TRANSITION_MS);
  }, [items]);

  const closeRecordForm = useCallback(
    (opts) => {
      if (opts?.revertToView && recordFormMode === "edit") {
        setRecordFormMode("view");
        return;
      }
      if (!opts?.afterSave) {
        startRecordFormListTransition();
      }
      setRecordFormMode(null);
      setEditRow(null);
    },
    [recordFormMode, startRecordFormListTransition]
  );

  const handleOpenRecordView = useCallback(
    (row, rowIndexInView) => {
      if (typeof onEditRecord === "function") {
        onEditRecord(row);
        return;
      }
      let idx =
        typeof rowIndexInView === "number" && Number.isFinite(rowIndexInView) ? Math.floor(rowIndexInView) : -1;
      if (idx < 0) {
        idx = items.findIndex((r) => referenceBookDataRowSameRecord(r, row));
      }
      setSelectedRowKey(getRowStableKey(row, idx >= 0 ? idx : 0));
      setRecordFormMode("view");
      setEditRow(row);
    },
    [onEditRecord, items]
  );

  const handleEnterEditFromView = useCallback(() => {
    /* Иначе между mousedown и mouseup тулбар меняется и mouseup попадает на «Сохранить» — ложный submit */
    window.setTimeout(() => {
      setRecordFormMode("edit");
    }, 0);
  }, []);

  const handleAfterEditSave = useCallback(async () => {
    await fetchPage();
    setRecordFormMode("view");
  }, [fetchPage]);

  useEffect(() => {
    return () => {
      if (recordListTransitionTimeoutRef.current) {
        window.clearTimeout(recordListTransitionTimeoutRef.current);
      }
    };
  }, []);

  const displayedItems = useMemo(() => {
    if (recordListTransitioning && Array.isArray(recordListSnapshotRef.current?.items)) {
      return recordListSnapshotRef.current.items;
    }
    return items;
  }, [recordListTransitioning, items]);

  const editRowStableId = editRow?.id ?? editRow?.Id;
  useEffect(() => {
    if (recordFormMode !== "view" || editRowStableId == null) {
      return;
    }
    const idStr = String(editRowStableId).trim();
    if (!idStr) {
      return;
    }
    const found = items.find((r) => String(r?.id ?? r?.Id ?? "").trim() === idStr);
    if (!found) {
      return;
    }
    setEditRow((prev) => {
      if (!prev || String(prev.id ?? prev.Id ?? "").trim() !== idStr) {
        return prev;
      }
      return found;
    });
  }, [items, recordFormMode, editRowStableId]);

  const handleOpenAdd = useCallback(() => {
    if (typeof onAddRecord === "function") {
      onAddRecord();
      return;
    }
    setRecordFormMode("add");
    setEditRow(null);
  }, [onAddRecord]);

  const exportExcelFile = useCallback(async () => {
    const id = String(referenceBookUrlSuffix ?? "").trim();
    if (!id) {
      throw new Error("Не удалось определить справочник");
    }
    const limit = Math.min(100000, Math.max(total || 0, 1));
    const response = await fetch(`${listApiUrl}/${encodeURIComponent(id)}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit,
        offset: 1,
        sorts: sortRules.map((rule) => ({ field: rule.field, direction: rule.direction })),
        filters: debouncedFilters
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Ошибка ${response.status}`);
    }
    const cols = mergeColumnsFieldValuesFromProperties(
      Array.isArray(data.columns) ? data.columns : [],
      data.referenceBook ?? data.reference_book
    );
    const rows = Array.isArray(data.items) ? data.items : [];
    const XLSX = await loadXlsxModule();
    const keys = cols.map((c) => columnFieldKey(c)).filter(Boolean);
    const header = cols.map((c) => columnCaption(c) || columnFieldKey(c));
    const aoa = [
      header,
      ...rows.map((r) =>
        keys.map((k) => {
          const c = cols.find((col) => columnFieldKey(col) === k);
          return formatCellValue(r[k], c?.fieldType, c);
        })
      )
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "data");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const code = String(referenceBook?.code ?? "export").replace(/[^\w.-]+/g, "_");
    return { blob, fileName: `reference-book-${code}.xlsx` };
  }, [referenceBookUrlSuffix, listApiUrl, total, referenceBook, sortRules, debouncedFilters]);

  useEffect(() => {
    registerReferenceBookDataHeaderHandlers({
      clearFilters: handleClearFilters,
      alignColumns: handleAlignColumns,
      openAdd: handleOpenAdd,
      openColumnSettings: handleOpenColumnSettings,
      exportFile: exportExcelFile
    });
    return () =>
      registerReferenceBookDataHeaderHandlers({
        clearFilters: () => {},
        alignColumns: () => {},
        openAdd: () => {},
        openColumnSettings: () => {},
        exportFile: async () => {
          throw new Error("Страница не активна");
        }
      });
  }, [handleClearFilters, handleAlignColumns, handleOpenAdd, handleOpenColumnSettings, exportExcelFile]);

  useLayoutEffect(() => {
    if (!isColumnSettingsOpen) {
      return undefined;
    }
    const update = () => setSettingsPanelBounds(calculateSettingsPanelBounds());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isColumnSettingsOpen, calculateSettingsPanelBounds]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const visiblePaginationItems = useMemo(() => {
    const pages = new Set([1, totalPages]);
    for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
      if (page >= 1 && page <= totalPages) {
        pages.add(page);
      }
    }

    const sortedPages = Array.from(pages).sort((a, b) => a - b);
    const items = [];
    for (let index = 0; index < sortedPages.length; index += 1) {
      const page = sortedPages[index];
      if (index > 0) {
        const prev = sortedPages[index - 1];
        if (page - prev > 1) {
          items.push(`ellipsis-${prev}-${page}`);
        }
      }
      items.push(page);
    }
    return items;
  }, [currentPage, totalPages]);

  const goToPage = () => {
    const rawValue = pageJumpInputRef.current ? String(pageJumpInputRef.current.value ?? "").trim() : "";
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      if (pageJumpInputRef.current) {
        pageJumpInputRef.current.value = String(currentPage);
      }
      return;
    }

    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    setCurrentPage(clamped);
    if (pageJumpInputRef.current) {
      pageJumpInputRef.current.value = String(clamped);
    }
  };

  useEffect(() => {
    if (pageJumpInputRef.current) {
      pageJumpInputRef.current.value = String(currentPage);
    }
  }, [currentPage]);

  const handleResizeStart = (fieldKey, event) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const isActions = fieldKey === ACTIONS_COLUMN_KEY;
    const startWidth =
      Number(columnWidths[fieldKey]) ||
      (isActions ? ACTIONS_COLUMN_MAX_WIDTH_PX : 200);
    const minResize = isActions ? MIN_ACTIONS_COLUMN_WIDTH_PX : MIN_COLUMN_WIDTH;
    const onMove = (e) => {
      const delta = e.clientX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [fieldKey]: Math.max(minResize, startWidth + delta)
      }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const renderedColumns = useMemo(() => {
    return tableColumnDefs.map((col) => {
      const w =
        Number(columnWidths[col.key]) || (col.isActions ? ACTIONS_COLUMN_MAX_WIDTH_PX : 200);
      return { ...col, width: w };
    });
  }, [tableColumnDefs, columnWidths]);

  const [scaledWidths, setScaledWidths] = useState(null);
  useEffect(() => {
    const wrap = tableWrapperRef.current;
    if (!(wrap instanceof HTMLElement)) {
      return undefined;
    }
    const measure = () => {
      const width = wrap.clientWidth;
      if (width <= 0) {
        setScaledWidths(null);
        return;
      }

      const dataCols = renderedColumns.filter((c) => !c.isActions);

      if (showRowActions) {
        const fixedActions = Math.min(
          ACTIONS_COLUMN_MAX_WIDTH_PX,
          Math.max(
            MIN_ACTIONS_COLUMN_WIDTH_PX,
            Number(columnWidths[ACTIONS_COLUMN_KEY]) || ACTIONS_COLUMN_MAX_WIDTH_PX
          )
        );
        if (dataCols.length === 0) {
          setScaledWidths([{ key: ACTIONS_COLUMN_KEY, width: Math.min(fixedActions, width) }]);
          return;
        }
        const targetData = width - fixedActions;
        if (targetData <= 0) {
          setScaledWidths(null);
          return;
        }
        const scaled = fitListColumnsToTargetWidth(
          dataCols.map((c) => ({ key: c.key, width: c.width })),
          targetData,
          MIN_COLUMN_WIDTH
        );
        if (!scaled) {
          setScaledWidths(null);
          return;
        }
        const byKey = new Map(scaled.map((row) => [row.key, row.width]));
        const merged = renderedColumns.map((col) =>
          col.isActions
            ? { key: col.key, width: fixedActions }
            : { key: col.key, width: byKey.get(col.key) ?? col.width }
        );
        setScaledWidths(merged);
        return;
      }

      const scaled = fitListColumnsToTargetWidth(
        renderedColumns.map((c) => ({ key: c.key, width: c.width })),
        width,
        MIN_COLUMN_WIDTH
      );
      setScaledWidths(scaled);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [renderedColumns, showRowActions, columnWidths]);

  const widthByKey = useMemo(() => {
    const map = {};
    if (scaledWidths) {
      for (const row of scaledWidths) {
        map[row.key] = row.width;
      }
    }
    return map;
  }, [scaledWidths]);

  /** Сумма ширин колонок — как `tableWidthPx` у списка справочников (таблица не width:100% + min-width) */
  const tableWidthPx = useMemo(() => {
    return renderedColumns.reduce(
      (sum, col) => sum + (widthByKey[col.key] ?? col.width ?? MIN_COLUMN_WIDTH),
      0
    );
  }, [renderedColumns, widthByKey]);

  const colSpan = Math.max(1, renderedColumns.length);

  return (
    <>
      <div
        className={`list-content-layout reference-books-page reference-book-data-page report-settings-layout${
          recordFormMode != null ? " split-view" : ""
        }`}
        ref={mainBlockRef}
      >
        <div className="list-content-main reference-books-data-main">
          {loadError ? <div className="reference-books-fetch-error">{loadError}</div> : null}

          <div className="table-wrapper" ref={tableWrapperRef}>
          <table
            className="employee-grid reference-book-data-grid"
            style={
              tableWidthPx > 0
                ? {
                    width: `${tableWidthPx}px`,
                    minWidth: `${tableWidthPx}px`,
                    maxWidth: `${tableWidthPx}px`
                  }
                : undefined
            }
          >
            <colgroup>
              {renderedColumns.map((col) => {
                const w = widthByKey[col.key] ?? col.width ?? MIN_COLUMN_WIDTH;
                return (
                  <col
                    key={`rb-data-col-${col.key}`}
                    style={{
                      width: `${w}px`,
                      minWidth: `${w}px`,
                      maxWidth: `${w}px`
                    }}
                  />
                );
              })}
            </colgroup>
            <thead>
              <tr>
                {renderedColumns.map((col) => {
                  if (col.isActions) {
                    return (
                      <th
                        key={col.key}
                        className="relations-list-actions-header reference-books-list-actions-header"
                        aria-label="Действия"
                      >
                        <span
                          className="column-resize-handle"
                          role="presentation"
                          onMouseDown={(e) => handleResizeStart(col.key, e)}
                        />
                      </th>
                    );
                  }
                  const direction = getSortDirectionForField(col.key);
                  const sortOrder = getSortOrderForField(col.key);
                  const sortIcon = direction === "ASC" ? "▲" : direction === "DESC" ? "▼" : null;
                  return (
                    <th key={col.key}>
                      <div className="column-header-inner">
                        <button
                          type="button"
                          className={`column-sort-button${direction ? " active" : ""}`}
                          onClick={() => handleSortClick(col.key)}
                        >
                          <span>{col.title}</span>
                          {sortIcon ? (
                            <span className="sort-icon-group">
                              <span className="sort-icon">{sortIcon}</span>
                              {sortOrder != null && <span className="sort-order-index">{sortOrder}</span>}
                            </span>
                          ) : null}
                        </button>
                        <span
                          className="column-resize-handle"
                          role="presentation"
                          onMouseDown={(e) => handleResizeStart(col.key, e)}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
              <tr className="filter-row">
                {renderedColumns.map((col) => {
                  if (col.isActions) {
                    return <th key={`f-${col.key}`} />;
                  }
                  const isBooleanFilter =
                    String(col.fieldType ?? col.field_type ?? "").toLowerCase() === "boolean";
                  const filterVal = filters[col.key] ?? "";
                  const showClear = String(filterVal).trim() !== "";
                  return (
                    <th key={`f-${col.key}`}>
                      <div className="column-filter-input-wrapper">
                        {isBooleanFilter ? (
                          <select
                            value={filterVal}
                            onChange={(event) => handleChangeFilter(col.key, event.target.value)}
                            className="column-filter-input"
                            aria-label={`Фильтр: ${col.title}`}
                          >
                            <option value="">Все</option>
                            <option value="ДА">ДА</option>
                            <option value="НЕТ">НЕТ</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="column-filter-input"
                            value={filterVal}
                            onChange={(event) => handleChangeFilter(col.key, event.target.value)}
                            aria-label={`Фильтр: ${col.title}`}
                          />
                        )}
                        {showClear && (
                          <button
                            type="button"
                            className="column-filter-clear-button"
                            aria-label="Очистить фильтр"
                            onClick={() => handleChangeFilter(col.key, "")}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={colSpan}>Загрузка...</td>
                </tr>
              )}
              {!loading && columns.length === 0 && (
                <tr>
                  <td colSpan={colSpan}>Нет колонок (проверьте структуру справочника в карточке).</td>
                </tr>
              )}
              {!loading && columns.length > 0 && renderedColumnDefs.length === 0 && !showRowActions && (
                <tr>
                  <td colSpan={colSpan}>Все столбцы скрыты — откройте «Настройка» и включите колонки.</td>
                </tr>
              )}
              {!loading &&
                columns.length > 0 &&
                renderedColumns.length > 0 &&
                items.length === 0 && (
                  <tr>
                    <td colSpan={colSpan}>
                      {hasActiveFilters ? "Нет записей по фильтру" : "Нет записей"}
                    </td>
                  </tr>
                )}
              {!loading &&
                columns.length > 0 &&
                renderedColumns.length > 0 &&
                items.length > 0 &&
                displayedItems.map((row, idx) => {
                  const rowKey = getRowStableKey(row, idx);
                  const isRowSelected =
                    rowKey === selectedRowKey ||
                    ((recordFormMode === "edit" || recordFormMode === "view") &&
                      editRow != null &&
                      referenceBookDataRowSameRecord(row, editRow));
                  return (
                    <tr
                      key={rowKey}
                      tabIndex={-1}
                      aria-selected={isRowSelected}
                      className={isRowSelected ? "selected-row" : ""}
                      onClick={() => handleOpenRecordView(row, idx)}
                    >
                      {renderedColumns.map((col) => {
                        const displayText = formatCellValue(row[col.key], col.fieldType, col);
                        const linkTipRaw = referenceBookRowFieldAux(row, col.key, LINK_TIP_SUFFIX);
                        const hasLinkCustomTooltip =
                          hasFieldLinkColumn(col) &&
                          linkTipRaw != null &&
                          String(linkTipRaw).trim() !== "";
                        const tooltipText =
                          hasLinkCustomTooltip ? String(linkTipRaw).trim() : displayText;
                        const fieldLinkHref = resolveFieldLinkHref(col, row);
                        const rawLinkFk =
                          referenceBookRowFieldAux(row, col.key, LINK_RAW_SUFFIX) ?? row[col.key];
                        const showFieldLink =
                          Boolean(fieldLinkHref) &&
                          fieldLinkHref !== "#" &&
                          (String(displayText ?? "").trim() !== "" ||
                            (normalizeFieldShowLinkValue(col.fieldShowLink) === "Карточка" &&
                              rawLinkFk != null &&
                              String(rawLinkFk).trim() !== ""));
                        return (
                          <td
                            key={col.key}
                            onMouseEnter={
                              isMainGridCellTooltipEnabled && typeof handleCellMouseEnter === "function"
                                ? (event) =>
                                    handleCellMouseEnter(
                                      event,
                                      displayText,
                                      hasLinkCustomTooltip ? tooltipText : null,
                                      false
                                    )
                                : undefined
                            }
                            onMouseMove={
                              isMainGridCellTooltipEnabled && typeof updateCellTooltipPosition === "function"
                                ? updateCellTooltipPosition
                                : undefined
                            }
                            onMouseLeave={
                              isMainGridCellTooltipEnabled && typeof handleCellMouseLeave === "function"
                                ? handleCellMouseLeave
                                : undefined
                            }
                          >
                            {showFieldLink ? (
                              <a
                                className="entity-card-hover-link employee-name-link"
                                href={fieldLinkHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                                onMouseEnter={
                                  isMainGridCellTooltipEnabled && typeof handleCellMouseEnter === "function"
                                    ? (event) => {
                                        const td = event.currentTarget.closest("td");
                                        if (!td) {
                                          return;
                                        }
                                        handleCellMouseEnter(
                                          event,
                                          displayText,
                                          hasLinkCustomTooltip ? tooltipText : null,
                                          false,
                                          td
                                        );
                                      }
                                    : undefined
                                }
                              >
                                {displayText}
                              </a>
                            ) : (
                              displayText
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>

        <ReferenceBookRecordFormPanel
          isOpen={recordFormMode != null}
          panelMode={recordFormMode === "add" ? "add" : recordFormMode === "edit" ? "edit" : "view"}
          editRow={editRow}
          onClose={closeRecordForm}
          onRequestEdit={handleEnterEditFromView}
          onAfterEditSave={handleAfterEditSave}
          onDeleteRecord={handleDeleteRow}
          canEditRecords={editRecords}
          listApiUrl={listApiUrl}
          referenceBookUrlSuffix={referenceBookUrlSuffix}
          fields={insertFormFields}
          formatFieldReadonlyValue={(col) =>
            formatCellValue(editRow?.[columnFieldKey(col)], col.fieldType, col)
          }
          onSaved={fetchPage}
          showSystemErrorToast={showSystemErrorToast}
          showSystemSuccessToast={showSystemSuccessToast}
        />
      </div>

      <section className="bottom-controls-panel" ref={bottomControlsRef}>
        <div className="grid-controls">
          <div className="pagination-controls">
            <button
              type="button"
              className="pager-button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={loading || currentPage <= 1}
              aria-label="Предыдущая страница"
              data-tooltip="Предыдущая страница"
            >
              <IconChevronLeft aria-hidden />
            </button>
            {visiblePaginationItems.map((item, index) =>
              typeof item === "string" && item.startsWith("ellipsis-") ? (
                <span key={`ellipsis-${index}`} className="pager-ellipsis" aria-hidden="true">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`pager-button${item === currentPage ? " active" : ""}`}
                  onClick={() => setCurrentPage(item)}
                  disabled={loading}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              className="pager-button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={loading || currentPage >= totalPages}
              aria-label="Следующая страница"
              data-tooltip="Следующая страница"
            >
              <IconChevronRight aria-hidden />
            </button>
          </div>
          <label className="page-jump-control">
            <span>Перейти на страницу:</span>
            <input
              ref={pageJumpInputRef}
              type="number"
              min={1}
              max={totalPages}
              defaultValue={currentPage}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  goToPage();
                }
              }}
              disabled={loading}
            />
            <button type="button" className="page-jump-button" onClick={goToPage} disabled={loading}>
              <IconArrowRight aria-hidden />
              <span>Перейти</span>
            </button>
          </label>
          <span className="selected-count-label">Отобрано - {total} записей</span>
          <div className="grid-controls-right">
            <label className="page-size-control">
              <span>Записей на странице:</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                disabled={loading}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <TableColumnSettingsPanel
        isOpen={isColumnSettingsOpen}
        data-tooltip="Настройка столбцов"
        bounds={settingsPanelBounds}
        isDarkTheme={isDarkThemeEnabled}
        columns={settingsColumnsForPanel}
        settings={columnSettings}
        onApply={handleApplyColumnSettings}
        onClose={() => setIsColumnSettingsOpen(false)}
        onReset={() => {
          setColumnSettings((prev) => prev.map((item) => ({ ...item, visible: true, pin: "none" })));
        }}
      />

    </>
  );
}
