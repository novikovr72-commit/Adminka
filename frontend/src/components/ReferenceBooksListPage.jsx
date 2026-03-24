import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowRight,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconSettings
} from "./AppIcons";
import ReferenceBookCardPanel from "./ReferenceBookCardPanel";
import TableColumnSettingsPanel from "./TableColumnSettingsPanel";
import { registerReferenceBooksHeaderHandlers } from "../referenceBooksHeaderHandlers";
import {
  buildReferenceBookDraftFromItem,
  buildReferenceBookPropertiesPayload,
  buildReferenceBookRulesPayload,
  createEmptyLinkTableRow,
  createEmptyReferenceBookDraft,
  createEmptyReferenceBookField,
  createEmptyReferenceBookRuleFieldRow,
  createEmptyReferenceBookRuleRow,
  createEmptySynonymKeyFieldRow,
  mergeReferenceBookPropertiesIntoDraft,
  normalizeFieldShowLinkValue,
  normalizeRulesFromApi,
  validateReferenceBookFieldsDraftClient,
  validateReferenceBookMainDraftClient,
  validateReferenceBookRulesDraftClient
} from "../referenceBookProperties";
import { MIN_COLUMN_WIDTH, fitListColumnsToTargetWidth } from "../listColumnFit";

const REFERENCE_BOOKS_FILTERS_STORAGE_KEY = "reference-books.filters.v1";
const REFERENCE_BOOKS_SORT_STORAGE_KEY = "reference-books.sort-rules.v1";
const REFERENCE_BOOKS_WIDTHS_STORAGE_KEY = "reference-books.column-widths.v1";
const REFERENCE_BOOKS_COLUMN_SETTINGS_STORAGE_KEY = "reference-books.list-column-settings.v1";

const COLUMNS = [
  { key: "code", title: "Код", sortField: "code" },
  { key: "name", title: "Наименование справочника", sortField: "name" },
  { key: "procedureCode", title: "Процедура обработки", sortField: "procedureCode" },
  { key: "referenceUrl", title: "Суффикс URL", sortField: "referenceUrl" },
  { key: "tableName", title: "Таблица", sortField: "tableName" },
  { key: "addRecords", title: "Добавление", sortField: "addRecords" },
  { key: "editRecords", title: "Редактирование", sortField: "editRecords" }
];

const ALLOWED_SORT_FIELDS = new Set(COLUMNS.map((column) => column.sortField));
const COLUMN_KEYS_ORDER = COLUMNS.map((c) => c.key);
const COLUMN_KEYS_SET = new Set(COLUMN_KEYS_ORDER);

function defaultColumnSetting(key) {
  return { key, visible: true, pin: "none" };
}

/** Порядок колонок из массива настроек; в конец добавляются недостающие ключи (как в COLUMNS). */
function normalizeColumnSettingsOrder(storedOrPrev) {
  const raw = Array.isArray(storedOrPrev) ? storedOrPrev : [];
  const prevByKey = new Map(
    raw.filter((p) => p && typeof p.key === "string" && COLUMN_KEYS_SET.has(p.key)).map((p) => [p.key, p])
  );
  const result = [];
  const seen = new Set();
  for (const p of raw) {
    if (!p || !COLUMN_KEYS_SET.has(p.key) || seen.has(p.key)) {
      continue;
    }
    seen.add(p.key);
    result.push({ ...defaultColumnSetting(p.key), ...p, key: p.key });
  }
  for (const k of COLUMN_KEYS_ORDER) {
    if (!seen.has(k)) {
      const old = prevByKey.get(k);
      result.push(old ? { ...defaultColumnSetting(k), ...old, key: k } : defaultColumnSetting(k));
    }
  }
  return result;
}

function sanitizeReferenceBookSortRules(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (rule) =>
        rule &&
        typeof rule === "object" &&
        ALLOWED_SORT_FIELDS.has(rule.field) &&
        (rule.direction === "ASC" || rule.direction === "DESC")
    )
    .map((rule) => ({ field: rule.field, direction: rule.direction }));
}

const DEFAULT_WIDTHS = {
  code: 160,
  name: 320,
  procedureCode: 220,
  referenceUrl: 200,
  tableName: 200,
  addRecords: 120,
  editRecords: 130,
  /** Одна иконка «Выбрать» — без резерва под вторую кнопку */
  actions: 52
};

const INITIAL_FILTERS = {
  code: "",
  name: "",
  procedureCode: "",
  referenceUrl: "",
  tableName: "",
  addRecords: "",
  editRecords: ""
};

function formatListCellDisplay(columnKey, row) {
  switch (columnKey) {
    case "code":
      return row.code ?? "-";
    case "name":
      return row.name ?? "-";
    case "procedureCode":
      return row.procedureCode ?? "-";
    case "referenceUrl":
      return row.referenceUrl ?? "-";
    case "tableName":
      return row.tableName ?? "-";
    case "addRecords":
      return row.addRecords === true ? "Да" : row.addRecords === false ? "Нет" : "-";
    case "editRecords":
      return row.editRecords === true ? "Да" : row.editRecords === false ? "Нет" : "-";
    default:
      return "-";
  }
}

function parseStoredJson(key, fallback) {
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

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text;
}

/** Текст ответа Spring/HTML → понятное сообщение, без сырого Internal Server Error */
function formatListLoadError(status, rawMessage) {
  const msg = String(rawMessage ?? "").trim();
  if (!msg || /internal server error/i.test(msg)) {
    return status === 500 || status === 502 || status === 503
      ? "Не удалось загрузить список: ошибка сервера. Проверьте, что таблица reference_books создана и бэкенд доступен."
      : "Не удалось загрузить список.";
  }
  return msg.length > 320 ? `${msg.slice(0, 320)}…` : msg;
}

function extractReferenceBookPropertiesFromUploadedJson(parsed) {
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  if (
    parsed.properties &&
    typeof parsed.properties === "object" &&
    !Array.isArray(parsed.properties)
  ) {
    return parsed.properties;
  }
  if ("tableName" in parsed || Array.isArray(parsed.fields)) {
    return parsed;
  }
  return null;
}

export default function ReferenceBooksListPage({
  listApiUrl,
  isDarkThemeEnabled,
  showSystemErrorToast = () => {},
  showSystemSuccessToast = () => {},
  onSelectReferenceBookData,
  settingsUrlSuffix = "",
  onReferenceBookSettingsNavigate
}) {
  const tableWrapperRef = useRef(null);
  const pageJumpInputRef = useRef(null);
  const columnResizeRef = useRef(null);

  const [filters, setFilters] = useState(() =>
    parseStoredJson(REFERENCE_BOOKS_FILTERS_STORAGE_KEY, INITIAL_FILTERS)
  );
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [sortRules, setSortRules] = useState(() =>
    sanitizeReferenceBookSortRules(parseStoredJson(REFERENCE_BOOKS_SORT_STORAGE_KEY, []))
  );
  const [columnWidths, setColumnWidths] = useState(() => {
    const stored = parseStoredJson(REFERENCE_BOOKS_WIDTHS_STORAGE_KEY, null);
    const merged =
      stored && typeof stored === "object" ? { ...DEFAULT_WIDTHS, ...stored } : { ...DEFAULT_WIDTHS };
    const aw = Number(merged.actions);
    /* Раньше колонка была ~104px под две кнопки — под одну иконку достаточно ~52px */
    if (!Number.isFinite(aw) || aw < 36) {
      merged.actions = DEFAULT_WIDTHS.actions;
    } else if (aw > 72) {
      merged.actions = DEFAULT_WIDTHS.actions;
    }
    return merged;
  });

  const [columnSettings, setColumnSettings] = useState(() =>
    normalizeColumnSettingsOrder(parseStoredJson(REFERENCE_BOOKS_COLUMN_SETTINGS_STORAGE_KEY, null))
  );

  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [settingsPanelBounds, setSettingsPanelBounds] = useState({ top: 0, bottom: 0, right: 0 });
  const mainBlockRef = useRef(null);
  const bottomControlsRef = useRef(null);

  const columnWidthsRef = useRef(columnWidths);
  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  /** Подсветка строки как в списке сотрудников; не сбрасывается при закрытии карточки */
  const [selectedListRowId, setSelectedListRowId] = useState(null);
  const [cellTooltip, setCellTooltip] = useState({ visible: false, text: "", x: 0, y: 0 });
  const [cardOpen, setCardOpen] = useState(false);
  const [cardEditMode, setCardEditMode] = useState(false);
  const [cardDraft, setCardDraft] = useState(null);
  const cardDraftRef = useRef(null);
  useEffect(() => {
    cardDraftRef.current = cardDraft;
  }, [cardDraft]);
  const [cardSaving, setCardSaving] = useState(false);
  const [pendingReferenceBookDelete, setPendingReferenceBookDelete] = useState(null);
  const lastAutoOpenedSettingsSuffixRef = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(filters), 320);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    window.localStorage.setItem(REFERENCE_BOOKS_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    window.localStorage.setItem(REFERENCE_BOOKS_SORT_STORAGE_KEY, JSON.stringify(sortRules));
  }, [sortRules]);

  useEffect(() => {
    window.localStorage.setItem(REFERENCE_BOOKS_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    window.localStorage.setItem(REFERENCE_BOOKS_COLUMN_SETTINGS_STORAGE_KEY, JSON.stringify(columnSettings));
  }, [columnSettings]);

  useEffect(() => {
    setColumnSettings((prev) => normalizeColumnSettingsOrder(prev));
  }, []);

  const visibleDataColumns = useMemo(() => {
    const byKey = new Map(COLUMNS.map((c) => [c.key, c]));
    const out = [];
    for (const s of columnSettings) {
      if (s.visible === false) {
        continue;
      }
      const col = byKey.get(s.key);
      if (col) {
        out.push(col);
      }
    }
    return out;
  }, [columnSettings]);

  const settingsColumnsForPanel = useMemo(
    () =>
      columnSettings.map((s) => {
        const col = COLUMNS.find((c) => c.key === s.key);
        return { key: s.key, title: col?.title ?? s.key };
      }),
    [columnSettings]
  );

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

  const handleOpenColumnSettings = useCallback(() => {
    setSettingsPanelBounds(calculateSettingsPanelBounds());
    setIsColumnSettingsOpen(true);
  }, [calculateSettingsPanelBounds]);

  const handleApplyColumnSettings = (draft) => {
    setColumnSettings(draft.map((item) => ({ ...item })));
    setIsColumnSettingsOpen(false);
  };

  useLayoutEffect(() => {
    if (!isColumnSettingsOpen) {
      return undefined;
    }
    const update = () => setSettingsPanelBounds(calculateSettingsPanelBounds());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isColumnSettingsOpen, calculateSettingsPanelBounds]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const body = {
        limit: pageSize,
        offset: currentPage,
        sorts: sortRules.map((rule) => ({ field: rule.field, direction: rule.direction }))
      };
      const code = normalizeText(debouncedFilters.code);
      const name = normalizeText(debouncedFilters.name);
      const procedureCode = normalizeText(debouncedFilters.procedureCode);
      const referenceUrl = normalizeText(debouncedFilters.referenceUrl);
      const tableName = normalizeText(debouncedFilters.tableName);
      const addRecords = normalizeText(debouncedFilters.addRecords);
      const editRecords = normalizeText(debouncedFilters.editRecords);
      if (code) {
        body.code = code;
      }
      if (name) {
        body.name = name;
      }
      if (procedureCode) {
        body.procedureCode = procedureCode;
      }
      if (referenceUrl) {
        body.referenceUrl = referenceUrl;
      }
      if (tableName) {
        body.tableName = tableName;
      }
      if (addRecords) {
        body.addRecords = addRecords;
      }
      if (editRecords) {
        body.editRecords = editRecords;
      }
      const response = await fetch(listApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const rawText = await response.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }
      if (!response.ok || data.ok === false) {
        let detail = data.error || data.message || "";
        if (!detail && rawText && !rawText.trimStart().startsWith("{")) {
          detail = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
        }
        throw new Error(formatListLoadError(response.status, detail));
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total ?? 0));
    } catch (err) {
      setItems([]);
      setTotal(0);
      const message = err instanceof Error ? err.message : "Не удалось загрузить список";
      showSystemErrorToast(message);
    } finally {
      setLoading(false);
    }
  }, [listApiUrl, pageSize, currentPage, debouncedFilters, sortRules, showSystemErrorToast]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (pageJumpInputRef.current) {
      pageJumpInputRef.current.value = String(currentPage);
    }
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const tableWidthPx = useMemo(() => {
    return (
      visibleDataColumns.reduce(
        (sum, col) => sum + (columnWidths[col.key] ?? DEFAULT_WIDTHS[col.key] ?? MIN_COLUMN_WIDTH),
        0
      ) + (columnWidths.actions ?? DEFAULT_WIDTHS.actions)
    );
  }, [columnWidths, visibleDataColumns]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setCurrentPage(1);
  }, []);

  const handleResizeStart = useCallback((field, event) => {
    event.preventDefault();
    event.stopPropagation();
    const startWidth =
      Number(columnWidthsRef.current[field] ?? DEFAULT_WIDTHS[field]) || DEFAULT_WIDTHS[field];
    columnResizeRef.current = {
      field,
      startX: event.clientX,
      startWidth
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent) => {
      if (!columnResizeRef.current) {
        return;
      }
      const delta = moveEvent.clientX - columnResizeRef.current.startX;
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, columnResizeRef.current.startWidth + delta);
      const f = columnResizeRef.current.field;
      setColumnWidths((prev) => ({
        ...prev,
        [f]: nextWidth
      }));
    };

    const handleMouseUp = () => {
      columnResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  const openCard = useCallback(
    (row) => {
      setCardEditMode(false);
      setSelectedItem(row);
      if (row?.id != null && String(row.id).trim() !== "") {
        setSelectedListRowId(String(row.id));
      }
      setCardDraft(buildReferenceBookDraftFromItem(row));
      setCardOpen(true);
      const suf = String(row?.referenceUrl ?? "").trim();
      if (typeof onReferenceBookSettingsNavigate === "function") {
        onReferenceBookSettingsNavigate(suf);
      }
      if (suf) {
        lastAutoOpenedSettingsSuffixRef.current = suf;
      }
    },
    [onReferenceBookSettingsNavigate]
  );

  const closeCard = useCallback(() => {
    setPendingReferenceBookDelete(null);
    setCardOpen(false);
    setCardEditMode(false);
    setSelectedItem(null);
    setCardDraft(null);
    lastAutoOpenedSettingsSuffixRef.current = "";
    if (typeof onReferenceBookSettingsNavigate === "function") {
      onReferenceBookSettingsNavigate("");
    }
  }, [onReferenceBookSettingsNavigate]);

  const openNewReferenceBook = useCallback(() => {
    setSelectedItem(null);
    setSelectedListRowId(null);
    setCardDraft(createEmptyReferenceBookDraft());
    setCardEditMode(true);
    setCardOpen(true);
    lastAutoOpenedSettingsSuffixRef.current = "";
    if (typeof onReferenceBookSettingsNavigate === "function") {
      onReferenceBookSettingsNavigate("");
    }
  }, [onReferenceBookSettingsNavigate]);

  const handleAlignColumns = useCallback(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const renderedColumns = visibleDataColumns.map((column) => ({
      key: column.key,
      width: Number(columnWidths[column.key]) || DEFAULT_WIDTHS[column.key]
    }));
    if (renderedColumns.length === 0) {
      return;
    }
    const reservedActionsWidth = columnWidths.actions ?? DEFAULT_WIDTHS.actions;
    const targetTotalWidth = wrapper.clientWidth - reservedActionsWidth;
    if (targetTotalWidth <= 0) {
      return;
    }
    const scaledWidths = fitListColumnsToTargetWidth(renderedColumns, targetTotalWidth);
    if (!scaledWidths) {
      return;
    }
    setColumnWidths((prev) => {
      const next = { ...prev };
      for (const column of scaledWidths) {
        next[column.key] = column.width;
      }
      return next;
    });
    if (wrapper instanceof HTMLElement) {
      wrapper.scrollLeft = 0;
    }
  }, [columnWidths, visibleDataColumns]);

  useEffect(() => {
    registerReferenceBooksHeaderHandlers({
      clearFilters,
      alignColumns: handleAlignColumns,
      openAdd: openNewReferenceBook,
      openColumnSettings: handleOpenColumnSettings
    });
    return () => {
      registerReferenceBooksHeaderHandlers({
        clearFilters: () => {},
        alignColumns: () => {},
        openAdd: () => {},
        openColumnSettings: () => {}
      });
    };
  }, [clearFilters, handleAlignColumns, openNewReferenceBook, handleOpenColumnSettings]);

  const getSortDirectionForField = (columnSortField) => {
    const match = sortRules.find((rule) => rule.field === columnSortField);
    return match ? match.direction : null;
  };

  const getSortOrderForField = (columnSortField) => {
    const sortIndex = sortRules.findIndex((rule) => rule.field === columnSortField);
    return sortIndex >= 0 ? sortIndex + 1 : null;
  };

  /** Составная сортировка: +колонка → ASC → DESC → убрать. Пустой список — на бэкенде умолчание (код ASC). */
  const handleSortClick = (columnSortField) => {
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

      return sanitizeReferenceBookSortRules(nextRules);
    });
  };

  /** Переход к таблице данных справочника (как раньше по иконке-стрелке). */
  const openReferenceBookData = useCallback(
    (row) => {
      if (String(row?.procedureCode ?? "").trim()) {
        showSystemErrorToast("Стандартный просмотр данных недоступен: задана процедура (procedureCode)");
        return;
      }
      const suf = String(row?.referenceUrl ?? "").trim();
      if (!suf) {
        showSystemErrorToast("Нет суффикса URL — в карточке сохраните суффикс URL");
        return;
      }
      if (row?.id != null && String(row.id).trim() !== "") {
        setSelectedListRowId(String(row.id));
      }
      if (typeof onSelectReferenceBookData === "function") {
        onSelectReferenceBookData(suf);
      }
    },
    [onSelectReferenceBookData, showSystemErrorToast]
  );

  const updateCellTooltipPosition = useCallback((event) => {
    setCellTooltip((prev) => ({
      ...prev,
      x: event.clientX + 12,
      y: event.clientY + 12
    }));
  }, []);

  const handleListCellMouseEnter = useCallback((event, value) => {
    const valueText = String(value ?? "").trim();
    if (!valueText || valueText === "-") {
      setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
      return;
    }
    if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) {
      setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
      return;
    }
    setCellTooltip({
      visible: true,
      text: valueText,
      x: event.clientX + 12,
      y: event.clientY + 12
    });
  }, []);

  const handleListCellMouseLeave = useCallback(() => {
    setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
  }, []);

  useEffect(() => {
    if (!selectedListRowId) {
      return;
    }
    const exists = items.some((r) => String(r?.id ?? "") === selectedListRowId);
    if (!exists) {
      setSelectedListRowId(null);
    }
  }, [items, selectedListRowId]);

  /** Открытие карточки по URL без изменения фильтров списка: как employeeId в query для сотрудника. */
  useEffect(() => {
    const s = String(settingsUrlSuffix ?? "").trim();
    if (!s) {
      lastAutoOpenedSettingsSuffixRef.current = "";
      return;
    }
    if (lastAutoOpenedSettingsSuffixRef.current === s && cardOpen) {
      return;
    }
    const rowInPage = items.find((r) => String(r?.referenceUrl ?? "").trim() === s);
    if (rowInPage) {
      lastAutoOpenedSettingsSuffixRef.current = s;
      openCard(rowInPage);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const body = {
          limit: 1,
          offset: 1,
          sorts: sortRules.map((rule) => ({ field: rule.field, direction: rule.direction })),
          referenceUrl: s
        };
        const response = await fetch(listApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const rawText = await response.text();
        let data = {};
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          data = {};
        }
        if (!response.ok || data.ok === false) {
          let detail = data.error || data.message || "";
          if (!detail && rawText && !rawText.trimStart().startsWith("{")) {
            detail = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
          }
          throw new Error(formatListLoadError(response.status, detail));
        }
        const listItem = Array.isArray(data.items) ? data.items[0] : null;
        if (cancelled) {
          return;
        }
        if (!listItem || String(listItem.referenceUrl ?? "").trim() !== s) {
          showSystemErrorToast(`Справочник с суффиксом URL «${s}» не найден`);
          return;
        }
        if (cancelled) {
          return;
        }
        if (lastAutoOpenedSettingsSuffixRef.current === s && cardOpen) {
          return;
        }
        lastAutoOpenedSettingsSuffixRef.current = s;
        openCard(listItem);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Не удалось загрузить справочник";
          showSystemErrorToast(message);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [settingsUrlSuffix, items, listApiUrl, sortRules, openCard, cardOpen, showSystemErrorToast]);

  const startCardEdit = () => {
    if (!selectedItem?.id) {
      return;
    }
    setCardDraft(buildReferenceBookDraftFromItem(selectedItem));
    setCardEditMode(true);
  };

  const cancelCardEdit = () => {
    if (!selectedItem?.id) {
      closeCard();
      return;
    }
    setCardDraft(buildReferenceBookDraftFromItem(selectedItem));
    setCardEditMode(false);
  };

  const openReferenceBookDeleteModal = useCallback(() => {
    if (!selectedItem?.id) {
      return;
    }
    const code = String(selectedItem.code ?? "").trim();
    const name = String(selectedItem.name ?? "").trim();
    const label = code && name ? `${code} — ${name}` : code || name || String(selectedItem.id);
    setPendingReferenceBookDelete({ id: selectedItem.id, label });
  }, [selectedItem]);

  const closeReferenceBookDeleteModal = useCallback(() => {
    setPendingReferenceBookDelete(null);
  }, []);

  const confirmDeleteReferenceBook = useCallback(async () => {
    const id = pendingReferenceBookDelete?.id;
    if (!id) {
      return;
    }
    setCardSaving(true);
    try {
      const response = await fetch(`${listApiUrl}/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Ошибка ${response.status}`);
      }
      showSystemSuccessToast(typeof data.message === "string" ? data.message : "Справочник удалён");
      setPendingReferenceBookDelete(null);
      closeCard();
      void fetchList();
    } catch (err) {
      showSystemErrorToast(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setCardSaving(false);
    }
  }, [
    closeCard,
    fetchList,
    listApiUrl,
    pendingReferenceBookDelete,
    showSystemErrorToast,
    showSystemSuccessToast
  ]);

  const cancelStructureFieldsEdit = useCallback(() => {
    setCardDraft((prev) => {
      if (!prev || !selectedItem) {
        return prev;
      }
      const fromItem = buildReferenceBookDraftFromItem(selectedItem);
      return {
        ...prev,
        fields: fromItem.fields,
        linkTables: fromItem.linkTables,
        synonymKeyFields: fromItem.synonymKeyFields
      };
    });
  }, [selectedItem]);

  const handleChangeCardDraft = (patch) => {
    setCardDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleChangeField = (index, patch) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const nextFields = [...(Array.isArray(prev.fields) ? prev.fields : [])];
      const merged = { ...nextFields[index], ...patch };
      if (normalizeFieldShowLinkValue(merged.fieldShowLink) !== "Карточка") {
        merged.fieldCartType = "";
      }
      nextFields[index] = merged;
      return { ...prev, fields: nextFields };
    });
  };

  const handleAddField = () => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const nextFields = [...(Array.isArray(prev.fields) ? prev.fields : []), createEmptyReferenceBookField()];
      return { ...prev, fields: nextFields };
    });
  };

  const handleRemoveField = (index) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const nextFields = (Array.isArray(prev.fields) ? prev.fields : []).filter((_, i) => i !== index);
      return { ...prev, fields: nextFields };
    });
  };

  const handleReorderFields = useCallback((fromIndex, toIndex) => {
    setCardDraft((prev) => {
      if (!prev || !Array.isArray(prev.fields)) {
        return prev;
      }
      const list = [...prev.fields];
      if (
        fromIndex < 0 ||
        fromIndex >= list.length ||
        toIndex < 0 ||
        toIndex >= list.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const [removed] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, removed);
      return { ...prev, fields: list };
    });
  }, []);

  const handleAddRule = useCallback(() => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...(Array.isArray(prev.rules) ? prev.rules : []), createEmptyReferenceBookRuleRow()];
      return { ...prev, rules: next };
    });
  }, []);

  const handleRemoveRule = useCallback((index) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = (Array.isArray(prev.rules) ? prev.rules : []).filter((_, i) => i !== index);
      return { ...prev, rules: next };
    });
  }, []);

  const handleChangeRuleType = useCallback((index, rule) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...(Array.isArray(prev.rules) ? prev.rules : [])];
      if (next[index]) {
        next[index] = { ...next[index], rule };
      }
      return { ...prev, rules: next };
    });
  }, []);

  const handleAddRuleField = useCallback((ruleIndex) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...(Array.isArray(prev.rules) ? prev.rules : [])];
      const r = next[ruleIndex];
      if (!r) {
        return prev;
      }
      const fields = [...(Array.isArray(r.fields) ? r.fields : []), createEmptyReferenceBookRuleFieldRow()];
      next[ruleIndex] = { ...r, fields };
      return { ...prev, rules: next };
    });
  }, []);

  const handleRemoveRuleField = useCallback((ruleIndex, fieldIndex) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...(Array.isArray(prev.rules) ? prev.rules : [])];
      const r = next[ruleIndex];
      if (!r) {
        return prev;
      }
      const fields = (Array.isArray(r.fields) ? r.fields : []).filter((_, i) => i !== fieldIndex);
      next[ruleIndex] = { ...r, fields };
      return { ...prev, rules: next };
    });
  }, []);

  const handleChangeRuleFieldTableName = useCallback((ruleIndex, fieldIndex, tableName) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...(Array.isArray(prev.rules) ? prev.rules : [])];
      const r = next[ruleIndex];
      if (!r) {
        return prev;
      }
      const fields = [...(Array.isArray(r.fields) ? r.fields : [])];
      if (fields[fieldIndex]) {
        fields[fieldIndex] = { ...fields[fieldIndex], tableName };
      }
      next[ruleIndex] = { ...r, fields };
      return { ...prev, rules: next };
    });
  }, []);

  const cancelRulesEdit = useCallback(() => {
    setCardDraft((prev) => {
      if (!prev || !selectedItem) {
        return prev;
      }
      const fromItem = buildReferenceBookDraftFromItem(selectedItem);
      return { ...prev, rules: fromItem.rules };
    });
  }, [selectedItem]);

  const handleAddFieldValue = (fieldIndex) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const nextFields = [...(Array.isArray(prev.fields) ? prev.fields : [])];
      const field = { ...nextFields[fieldIndex] };
      const fv = [...(Array.isArray(field.fieldValues) ? field.fieldValues : [])];
      fv.push({ fieldValueString: "", fieldValueShow: "" });
      field.fieldValues = fv;
      nextFields[fieldIndex] = field;
      return { ...prev, fields: nextFields };
    });
  };

  const handleRemoveFieldValue = (fieldIndex, valueIndex) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const nextFields = [...(Array.isArray(prev.fields) ? prev.fields : [])];
      const field = { ...nextFields[fieldIndex] };
      field.fieldValues = (Array.isArray(field.fieldValues) ? field.fieldValues : []).filter(
        (_, i) => i !== valueIndex
      );
      nextFields[fieldIndex] = field;
      return { ...prev, fields: nextFields };
    });
  };

  const handleChangeFieldValue = (fieldIndex, valueIndex, text, which = "fieldValueString") => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const nextFields = [...(Array.isArray(prev.fields) ? prev.fields : [])];
      const field = { ...nextFields[fieldIndex] };
      const fv = [...(Array.isArray(field.fieldValues) ? field.fieldValues : [])];
      const prevRow = fv[valueIndex] ?? { fieldValueString: "", fieldValueShow: "" };
      fv[valueIndex] = { ...prevRow, [which]: text };
      field.fieldValues = fv;
      nextFields[fieldIndex] = field;
      return { ...prev, fields: nextFields };
    });
  };

  const handleAddLinkTableRow = useCallback(() => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...(Array.isArray(prev.linkTables) ? prev.linkTables : [])];
      next.push(createEmptyLinkTableRow());
      return { ...prev, linkTables: next };
    });
  }, []);

  const handleChangeLinkTableName = useCallback((index, value) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...(Array.isArray(prev.linkTables) ? prev.linkTables : [])];
      if (next[index]) {
        next[index] = { ...next[index], linkTableName: value };
      }
      return { ...prev, linkTables: next };
    });
  }, []);

  const handleRemoveLinkTableRow = useCallback((index) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = (Array.isArray(prev.linkTables) ? prev.linkTables : []).filter((_, i) => i !== index);
      return { ...prev, linkTables: next };
    });
  }, []);

  const handleAddSynonymRow = useCallback(() => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [
        ...(Array.isArray(prev.synonymKeyFields) ? prev.synonymKeyFields : []),
        createEmptySynonymKeyFieldRow()
      ];
      return { ...prev, synonymKeyFields: next };
    });
  }, []);

  const handleRemoveSynonymRow = useCallback((index) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = (Array.isArray(prev.synonymKeyFields) ? prev.synonymKeyFields : []).filter(
        (_, i) => i !== index
      );
      return { ...prev, synonymKeyFields: next };
    });
  }, []);

  const handleChangeSynonymKeyField = useCallback((index, value) => {
    setCardDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...(Array.isArray(prev.synonymKeyFields) ? prev.synonymKeyFields : [])];
      next[index] = { ...next[index], synonymKeyField: value };
      return { ...prev, synonymKeyFields: next };
    });
  }, []);

  const handleReferenceBookJsonFileSelect = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !selectedItem?.id || !cardDraft) {
        return;
      }
      const fileName = String(file.name ?? "").toLowerCase();
      if (!fileName.endsWith(".json")) {
        showSystemErrorToast("Допускается загрузка только файла с расширением .json");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const rawText = String(reader.result ?? "");
        let parsed;
        try {
          parsed = JSON.parse(rawText);
        } catch (error) {
          const syntaxErrorMessage = String(error?.message ?? "").trim();
          showSystemErrorToast(
            syntaxErrorMessage
              ? `JSON содержит ошибки синтаксиса: ${syntaxErrorMessage}`
              : "JSON содержит ошибки синтаксиса"
          );
          return;
        }
        const propsRaw = extractReferenceBookPropertiesFromUploadedJson(parsed);
        if (!propsRaw) {
          showSystemErrorToast(
            "Ожидается объект с полями таблицы и полей (как в properties) или обёртка { \"properties\": { ... } }"
          );
          return;
        }
        const merged = mergeReferenceBookPropertiesIntoDraft(cardDraft, propsRaw);
        const clientErr = validateReferenceBookFieldsDraftClient(merged);
        if (clientErr) {
          showSystemErrorToast(clientErr);
          return;
        }
        void (async () => {
          setCardSaving(true);
          try {
            const properties = buildReferenceBookPropertiesPayload(merged);
            const response = await fetch(`${listApiUrl}/${encodeURIComponent(selectedItem.id)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ properties })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.ok === false) {
              throw new Error(data.error || `Ошибка ${response.status}`);
            }
            const nextItem = data.item && typeof data.item === "object" ? data.item : null;
            if (nextItem) {
              setSelectedItem(nextItem);
              setCardDraft(buildReferenceBookDraftFromItem(nextItem));
            }
            showSystemSuccessToast("JSON загружен и сохранён");
            void fetchList();
          } catch (err) {
            showSystemErrorToast(err instanceof Error ? err.message : "Ошибка сохранения");
          } finally {
            setCardSaving(false);
          }
        })();
      };
      reader.onerror = () => {
        showSystemErrorToast("Не удалось прочитать JSON-файл");
      };
      reader.readAsText(file, "utf-8");
    },
    [
      cardDraft,
      fetchList,
      listApiUrl,
      selectedItem?.id,
      showSystemErrorToast,
      showSystemSuccessToast
    ]
  );

  const saveMainCard = async () => {
    if (!cardDraft) {
      return false;
    }
    const clientErr = validateReferenceBookMainDraftClient(cardDraft);
    if (clientErr) {
      showSystemErrorToast(clientErr);
      return false;
    }

    if (!selectedItem?.id) {
      const rulesErr = validateReferenceBookRulesDraftClient(cardDraft);
      if (rulesErr) {
        showSystemErrorToast(rulesErr);
        return false;
      }
      const rulesPayload = buildReferenceBookRulesPayload(cardDraft);
      setCardSaving(true);
      try {
        const response = await fetch(createReferenceBookApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: String(cardDraft.code ?? "").trim(),
            name: String(cardDraft.name ?? "").trim(),
            procedureCode: normalizeText(cardDraft.procedureCode) || null,
            tableName: String(cardDraft.tableName ?? "").trim(),
            addRecords: Boolean(cardDraft.addRecords),
            editRecords: Boolean(cardDraft.editRecords),
            properties: buildReferenceBookPropertiesPayload(cardDraft),
            ...(rulesPayload.length > 0 ? { rules: rulesPayload } : {})
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
          throw new Error(data.error || `Ошибка ${response.status}`);
        }
        const nextItem = data.item && typeof data.item === "object" ? data.item : null;
        if (nextItem) {
          setSelectedItem(nextItem);
          setCardDraft(buildReferenceBookDraftFromItem(nextItem));
        }
        setCardEditMode(false);
        void fetchList();
        showSystemSuccessToast(typeof data.message === "string" ? data.message : "Справочник создан");
        return true;
      } catch (err) {
        showSystemErrorToast(err instanceof Error ? err.message : "Ошибка сохранения");
        return false;
      } finally {
        setCardSaving(false);
      }
    }

    setCardSaving(true);
    try {
      const response = await fetch(`${listApiUrl}/${encodeURIComponent(selectedItem.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: String(cardDraft.code ?? "").trim(),
          name: String(cardDraft.name ?? "").trim(),
          procedureCode: normalizeText(cardDraft.procedureCode) || null,
          tableName: String(cardDraft.tableName ?? "").trim(),
          addRecords: Boolean(cardDraft.addRecords),
          editRecords: Boolean(cardDraft.editRecords)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Ошибка ${response.status}`);
      }
      const nextItem = data.item && typeof data.item === "object" ? data.item : null;
      if (nextItem) {
        setSelectedItem(nextItem);
        setCardDraft(buildReferenceBookDraftFromItem(nextItem));
      }
      setCardEditMode(false);
      void fetchList();
      return true;
    } catch (err) {
      showSystemErrorToast(err instanceof Error ? err.message : "Ошибка сохранения");
      return false;
    } finally {
      setCardSaving(false);
    }
  };

  const savePropertiesCard = async (draftOverride) => {
    const d = draftOverride ?? cardDraftRef.current ?? cardDraft;
    if (!selectedItem?.id || !d) {
      return false;
    }
    const clientErr = validateReferenceBookFieldsDraftClient(d);
    if (clientErr) {
      showSystemErrorToast(clientErr);
      return false;
    }
    setCardSaving(true);
    try {
      const properties = buildReferenceBookPropertiesPayload(d);
      /* PATCH /reference-books/{id} с телом { properties } — сервер делегирует в updateProperties (путь .../properties может отсутствовать на старых сборках) */
      const response = await fetch(`${listApiUrl}/${encodeURIComponent(selectedItem.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Ошибка ${response.status}`);
      }
      const nextItem = data.item && typeof data.item === "object" ? data.item : null;
      if (nextItem) {
        setSelectedItem(nextItem);
        setCardDraft(buildReferenceBookDraftFromItem(nextItem));
      }
      void fetchList();
      return true;
    } catch (err) {
      showSystemErrorToast(err instanceof Error ? err.message : "Ошибка сохранения");
      return false;
    } finally {
      setCardSaving(false);
    }
  };

  const saveRulesCard = async (draftOverride) => {
    const d = draftOverride ?? cardDraftRef.current ?? cardDraft;
    if (!selectedItem?.id || !d) {
      return false;
    }
    const clientErr = validateReferenceBookRulesDraftClient(d);
    if (clientErr) {
      showSystemErrorToast(clientErr);
      return false;
    }
    setCardSaving(true);
    try {
      const rules = buildReferenceBookRulesPayload(d);
      const response = await fetch(`${listApiUrl}/${encodeURIComponent(selectedItem.id)}/rules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Ошибка ${response.status}`);
      }
      const nextItem = data.item && typeof data.item === "object" ? data.item : null;
      if (nextItem) {
        setSelectedItem(nextItem);
        setCardDraft(buildReferenceBookDraftFromItem(nextItem));
      }
      void fetchList();
      showSystemSuccessToast(typeof data.message === "string" ? data.message : "Правила сохранены");
      return true;
    } catch (err) {
      showSystemErrorToast(err instanceof Error ? err.message : "Ошибка сохранения");
      return false;
    } finally {
      setCardSaving(false);
    }
  };

  const mergeRulesFromJsonAndSave = async (parsed) => {
    const d = cardDraftRef.current ?? cardDraft;
    if (!d || !selectedItem?.id) {
      return false;
    }
    if (!Array.isArray(parsed)) {
      showSystemErrorToast("Ожидается JSON-массив правил");
      return false;
    }
    const merged = { ...d, rules: normalizeRulesFromApi(parsed) };
    const err = validateReferenceBookRulesDraftClient(merged);
    if (err) {
      showSystemErrorToast(err);
      return false;
    }
    return saveRulesCard(merged);
  };

  const handleReferenceBookRulesJsonFileSelect = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !selectedItem?.id || !cardDraft) {
        return;
      }
      const fileName = String(file.name ?? "").toLowerCase();
      if (!fileName.endsWith(".json")) {
        showSystemErrorToast("Допускается загрузка только файла с расширением .json");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const rawText = String(reader.result ?? "");
        let parsed;
        try {
          parsed = JSON.parse(rawText);
        } catch (error) {
          const syntaxErrorMessage = String(error?.message ?? "").trim();
          showSystemErrorToast(
            syntaxErrorMessage
              ? `JSON содержит ошибки синтаксиса: ${syntaxErrorMessage}`
              : "JSON содержит ошибки синтаксиса"
          );
          return;
        }
        if (!Array.isArray(parsed)) {
          showSystemErrorToast("Ожидается JSON-массив правил");
          return;
        }
        const merged = { ...cardDraft, rules: normalizeRulesFromApi(parsed) };
        const clientErr = validateReferenceBookRulesDraftClient(merged);
        if (clientErr) {
          showSystemErrorToast(clientErr);
          return;
        }
        void (async () => {
          setCardSaving(true);
          try {
            const rules = buildReferenceBookRulesPayload(merged);
            const response = await fetch(`${listApiUrl}/${encodeURIComponent(selectedItem.id)}/rules`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rules })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.ok === false) {
              throw new Error(data.error || `Ошибка ${response.status}`);
            }
            const nextItem = data.item && typeof data.item === "object" ? data.item : null;
            if (nextItem) {
              setSelectedItem(nextItem);
              setCardDraft(buildReferenceBookDraftFromItem(nextItem));
            }
            showSystemSuccessToast(typeof data.message === "string" ? data.message : "Правила сохранены");
            void fetchList();
          } catch (err) {
            showSystemErrorToast(err instanceof Error ? err.message : "Ошибка сохранения");
          } finally {
            setCardSaving(false);
          }
        })();
      };
      reader.onerror = () => {
        showSystemErrorToast("Не удалось прочитать JSON-файл");
      };
      reader.readAsText(file, "utf-8");
    },
    [cardDraft, fetchList, listApiUrl, selectedItem?.id, showSystemErrorToast, showSystemSuccessToast]
  );

  const mergeFieldsFromJsonAndSave = async (parsed) => {
    if (!cardDraft) {
      return false;
    }
    const merged = mergeReferenceBookPropertiesIntoDraft(cardDraft, parsed);
    const err = validateReferenceBookFieldsDraftClient(merged);
    if (err) {
      showSystemErrorToast(err);
      return false;
    }
    return savePropertiesCard(merged);
  };

  const goToPage = () => {
    const raw = pageJumpInputRef.current?.value;
    const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const next = Math.min(totalPages, Math.max(1, parsed));
    setCurrentPage(next);
  };


  const referenceBooksDbTablesApiUrl = useMemo(
    () => `${String(listApiUrl ?? "").replace(/\/$/, "")}/db-tables`,
    [listApiUrl]
  );

  const referenceBooksDbTableColumnsApiUrl = useMemo(
    () => `${String(listApiUrl ?? "").replace(/\/$/, "")}/db-table-columns`,
    [listApiUrl]
  );

  const createReferenceBookApiUrl = useMemo(
    () => `${String(listApiUrl ?? "").replace(/\/$/, "")}`.replace(/\/reference-books$/, "/reference-book"),
    [listApiUrl]
  );

  const dataColSpan = visibleDataColumns.length + 1;

  return (
    <>
      <div
        className={`list-content-layout reference-books-page report-settings-layout${cardOpen ? " split-view" : ""}${
          isDarkThemeEnabled ? " dark" : ""
        }`}
        ref={mainBlockRef}
      >
      <div className="list-content-main reference-books-left-column">
        <div className="table-wrapper" ref={tableWrapperRef} tabIndex={0}>
          <table
            className="employee-grid"
            style={{
              width: `${tableWidthPx}px`,
              minWidth: `${tableWidthPx}px`,
              maxWidth: `${tableWidthPx}px`
            }}
          >
            <colgroup>
              {visibleDataColumns.map((column) => (
                <col
                  key={`rb-col-${column.key}`}
                  style={{
                    width: `${columnWidths[column.key] ?? DEFAULT_WIDTHS[column.key]}px`,
                    minWidth: `${columnWidths[column.key] ?? DEFAULT_WIDTHS[column.key]}px`,
                    maxWidth: `${columnWidths[column.key] ?? DEFAULT_WIDTHS[column.key]}px`
                  }}
                />
              ))}
              <col
                style={{
                  width: `${columnWidths.actions ?? DEFAULT_WIDTHS.actions}px`,
                  minWidth: `${columnWidths.actions ?? DEFAULT_WIDTHS.actions}px`,
                  maxWidth: `${columnWidths.actions ?? DEFAULT_WIDTHS.actions}px`
                }}
              />
            </colgroup>
            <thead>
              <tr>
                {visibleDataColumns.map((column) => {
                  const direction = getSortDirectionForField(column.sortField);
                  const sortOrder = getSortOrderForField(column.sortField);
                  const sortIcon = direction === "ASC" ? "▲" : direction === "DESC" ? "▼" : null;
                  return (
                    <th key={column.key}>
                      <button
                        type="button"
                        className={`column-sort-button${direction ? " active" : ""}`}
                        onClick={() => handleSortClick(column.sortField)}
                      >
                        <span>{column.title}</span>
                        {sortIcon ? (
                          <span className="sort-icon-group">
                            <span className="sort-icon">{sortIcon}</span>
                            {sortOrder != null && (
                              <span className="sort-order-index">{sortOrder}</span>
                            )}
                          </span>
                        ) : null}
                      </button>
                      <span
                        className="column-resize-handle"
                        onMouseDown={(event) => handleResizeStart(column.key, event)}
                        role="presentation"
                      />
                    </th>
                  );
                })}
                <th className="relations-list-actions-header reference-books-list-actions-header">
                  <span
                    className="column-resize-handle"
                    onMouseDown={(event) => handleResizeStart("actions", event)}
                    role="presentation"
                  />
                </th>
              </tr>
              <tr className="filter-row">
                {visibleDataColumns.map((column) => (
                  <th key={`rb-filter-${column.key}`}>
                    <div className="column-filter-input-wrapper">
                      <input
                        type="text"
                        className="column-filter-input"
                        value={filters[column.key] ?? ""}
                        onChange={(event) => handleFilterChange(column.key, event.target.value)}
                        aria-label={`Фильтр: ${column.title}`}
                      />
                      {String(filters[column.key] ?? "").trim() !== "" && (
                        <button
                          type="button"
                          className="column-filter-clear-button"
                          aria-label="Очистить фильтр"
                          onClick={() => handleFilterChange(column.key, "")}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={dataColSpan}>Загрузка...</td>
                </tr>
              )}
              {!loading && visibleDataColumns.length === 0 && (
                <tr>
                  <td colSpan={dataColSpan}>
                    Все столбцы скрыты — откройте «Настройка» и включите колонки.
                  </td>
                </tr>
              )}
              {!loading && visibleDataColumns.length > 0 && items.length === 0 && (
                  <tr>
                    <td colSpan={dataColSpan}>Нет записей</td>
                  </tr>
                )}
              {!loading &&
                visibleDataColumns.length > 0 &&
                items.map((row) => {
                  const rowId = String(row.id ?? "");
                  const isSelected = rowId !== "" && rowId === String(selectedListRowId ?? "");
                  return (
                  <tr
                    key={String(row.id ?? row.code)}
                    className={isSelected ? "selected-row" : ""}
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onClick={() => openReferenceBookData(row)}
                  >
                    {visibleDataColumns.map((column) => {
                      const displayText = formatListCellDisplay(column.key, row);
                      return (
                        <td
                          key={column.key}
                          onMouseEnter={(e) => handleListCellMouseEnter(e, displayText)}
                          onMouseMove={updateCellTooltipPosition}
                          onMouseLeave={handleListCellMouseLeave}
                        >
                          {displayText}
                        </td>
                      );
                    })}
                    <td className="relations-list-actions-cell">
                      <button
                        type="button"
                        className="employee-card-position-action-button"
                        data-tooltip="Карточка справочника"
                        aria-label="Карточка справочника"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCard(row);
                        }}
                      >
                        <IconSettings aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <ReferenceBookCardPanel
        item={selectedItem}
        isNewRecord={Boolean(cardOpen && cardDraft && !selectedItem?.id)}
        isOpen={cardOpen}
        isEditMode={cardEditMode}
        isSaving={cardSaving}
        draft={cardDraft}
        onClose={closeCard}
        onStartEdit={startCardEdit}
        onCancelEdit={cancelCardEdit}
        onCancelStructureFieldsEdit={cancelStructureFieldsEdit}
        onChangeDraft={handleChangeCardDraft}
        onSaveMain={saveMainCard}
        onDeleteReferenceBook={openReferenceBookDeleteModal}
        onSaveProperties={savePropertiesCard}
        mergeFieldsFromJsonAndSave={mergeFieldsFromJsonAndSave}
        showSystemErrorToast={showSystemErrorToast}
        onChangeField={handleChangeField}
        onAddField={handleAddField}
        onRemoveField={handleRemoveField}
        onAddFieldValue={handleAddFieldValue}
        onRemoveFieldValue={handleRemoveFieldValue}
        onChangeFieldValue={handleChangeFieldValue}
        onReferenceBookJsonFileChange={handleReferenceBookJsonFileSelect}
        referenceBooksDbTablesApiUrl={referenceBooksDbTablesApiUrl}
        referenceBooksDbTableColumnsApiUrl={referenceBooksDbTableColumnsApiUrl}
        onAddLinkTableRow={handleAddLinkTableRow}
        onChangeLinkTableName={handleChangeLinkTableName}
        onRemoveLinkTableRow={handleRemoveLinkTableRow}
        onAddSynonymRow={handleAddSynonymRow}
        onRemoveSynonymRow={handleRemoveSynonymRow}
        onChangeSynonymKeyField={handleChangeSynonymKeyField}
        onReorderFields={handleReorderFields}
        onSaveRules={saveRulesCard}
        onCancelRulesEdit={cancelRulesEdit}
        onAddRule={handleAddRule}
        onRemoveRule={handleRemoveRule}
        onChangeRuleType={handleChangeRuleType}
        onAddRuleField={handleAddRuleField}
        onRemoveRuleField={handleRemoveRuleField}
        onChangeRuleFieldTableName={handleChangeRuleFieldTableName}
        mergeRulesFromJsonAndSave={mergeRulesFromJsonAndSave}
        onReferenceBookRulesJsonFileChange={handleReferenceBookRulesJsonFileSelect}
      />
    </div>

      <section className="bottom-controls-panel reference-books-bottom-controls" ref={bottomControlsRef}>
        <div className="grid-controls">
          <div className="pagination-controls">
            <button
              type="button"
              className="pager-button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={loading || currentPage <= 1}
              aria-label="Предыдущая страница"
            >
              <IconChevronLeft aria-hidden />
            </button>
            <button
              type="button"
              className={`pager-button${1 === currentPage ? " active" : ""}`}
              onClick={() => setCurrentPage(1)}
              disabled={loading}
            >
              1
            </button>
            {totalPages > 1 && (
              <button
                type="button"
                className={`pager-button${currentPage === totalPages ? " active" : ""}`}
                onClick={() => setCurrentPage(totalPages)}
                disabled={loading}
              >
                {totalPages}
              </button>
            )}
            <button
              type="button"
              className="pager-button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={loading || currentPage >= totalPages}
              aria-label="Следующая страница"
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
          <span className="selected-count-label">Отобрано — {total} записей</span>
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

      {pendingReferenceBookDelete ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Удаление справочника">
            <p className="result-message">
              Удалить справочник «{pendingReferenceBookDelete.label}»?
            </p>
            <p className="result-message">Запись будет безвозвратно удалена из базы данных.</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="modal-close-button"
                onClick={() => void confirmDeleteReferenceBook()}
                disabled={cardSaving}
              >
                <IconCheck aria-hidden />
                <span>Да</span>
              </button>
              <button
                type="button"
                className="modal-close-button secondary"
                onClick={closeReferenceBookDeleteModal}
                disabled={cardSaving}
              >
                <IconClose aria-hidden />
                <span>Нет</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
          setColumnSettings(COLUMNS.map((c) => ({ key: c.key, visible: true, pin: "none" })));
        }}
      />

      {cellTooltip.visible ? (
        <div
          className="custom-cell-tooltip"
          style={{ left: `${cellTooltip.x}px`, top: `${cellTooltip.y}px` }}
        >
          {cellTooltip.text}
        </div>
      ) : null}
    </>
  );
}
