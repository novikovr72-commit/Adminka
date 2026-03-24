import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconCheck,
  IconClose,
  IconDownload,
  IconFileJson,
  IconListBulleted,
  IconMinus,
  IconPencil,
  IconPlus,
  IconSliders,
  IconTrash,
  IconUpload
} from "./AppIcons";
import {
  REFERENCE_BOOK_FIELD_TABLE_COLUMNS,
  REFERENCE_BOOK_FIELD_TABLE_MIN_WIDTH,
  REFERENCE_BOOK_FIELD_TABLE_STORAGE_KEY,
  getDefaultReferenceBookFieldColumnWidths,
  parseStoredReferenceBookFieldColumnWidths
} from "../referenceBookFieldTableColumns";
import {
  REFERENCE_BOOK_FIELD_CART_TYPE_OPTIONS,
  REFERENCE_BOOK_FIELD_SHOW_LINK_OPTIONS,
  REFERENCE_BOOK_FIELD_TYPES,
  REFERENCE_BOOK_LINK_BLOCKED_BY_FIELD_VALUES_HINT,
  buildReferenceBookPropertiesPayload,
  buildReferenceBookRulesPayload,
  createEmptyFieldLinkListRow,
  createEmptyFieldLinkShowRow,
  createEmptyFieldLinkTooltipRow,
  fieldHasFieldValuesBlockingLink,
  normalizeFieldCartTypeValue,
  normalizeFieldLinkListTypeFromApi,
  normalizeFieldShowLinkValue,
  referenceUrlSuffixFromTableName,
  sanitizeFieldNameInput,
  sanitizeTableNameInput
} from "../referenceBookProperties";
import ReferenceBookDbColumnCombobox from "./ReferenceBookDbColumnCombobox";
import ReferenceBookLinkTableCombobox from "./ReferenceBookLinkTableCombobox";

const REFERENCE_BOOK_CARD_TAB_MAIN = "main";
const REFERENCE_BOOK_CARD_TAB_STRUCTURE = "structure";
const REFERENCE_BOOK_CARD_TAB_RULES = "rules";

const REFERENCE_BOOK_STRUCTURE_PANE_FIELDS = "fields";
const REFERENCE_BOOK_STRUCTURE_PANE_JSON = "json";

const REFERENCE_BOOK_RULES_PANE_FIELDS = "fields";
const REFERENCE_BOOK_RULES_PANE_JSON = "json";

const ReportTemplateJsonEditorPanel = lazy(() => import("./ReportTemplateJsonEditorPanel"));

const REFERENCE_BOOK_JSON_ZOOM_STORAGE_KEY = "reference-books.json-preview-zoom.v1";

function parseStoredReferenceBookJsonZoom() {
  try {
    const raw = window.localStorage.getItem(REFERENCE_BOOK_JSON_ZOOM_STORAGE_KEY);
    if (!raw) {
      return 1;
    }
    const n = Number.parseFloat(String(raw).trim());
    if (!Number.isFinite(n) || n < 0.7 || n > 1.6) {
      return 1;
    }
    return Number(n.toFixed(2));
  } catch {
    return 1;
  }
}

function sanitizeReferenceBookDownloadFileName(raw) {
  const s = String(raw ?? "").trim().replace(/[\\/:*?"<>|]+/g, "_");
  return s || "reference";
}

function TableReadonlyValue({ children, title: titleProp, "data-tooltip": dataTooltipProp }) {
  const tip = titleProp ?? dataTooltipProp;
  return (
    <span
      className="employee-card-field-value employee-card-field-value-block reference-book-table-cell-readonly"
      {...(tip ? { "data-tooltip": tip } : {})}
    >
      {children}
    </span>
  );
}

/** Текст для режима просмотра: непустые имена столбцов через запятую. */
function linkFieldReadonlyText(arr, getName) {
  const names = (Array.isArray(arr) ? arr : [])
    .map((r) => String(getName(r) ?? "").trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "—";
}

/** Текстовое поле как в «Связях сотрудника»: .employee-card-relations-filter-input + × в .column-filter-input-wrapper */
function RelationsFilterTextField({
  value,
  onChange,
  placeholder,
  title: titleAttr,
  "data-tooltip": dataTooltipAttr,
  spellCheck,
  inputMode,
  type
}) {
  const v = value ?? "";
  const showClear = String(v).trim() !== "";
  const inputTip = titleAttr ?? dataTooltipAttr;
  return (
    <div className="column-filter-input-wrapper">
      <input
        type={type ?? "text"}
        className="employee-card-relations-filter-input reference-book-field-table-input"
        value={v}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-tooltip={inputTip}
        spellCheck={spellCheck}
        inputMode={inputMode}
      />
      {showClear ? (
        <button
          type="button"
          className="column-filter-clear-button"
          aria-label="Очистить поле"
          onClick={() => onChange("")}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function ReferenceBookCardPanel({
  item,
  isNewRecord = false,
  isOpen,
  isEditMode,
  isSaving,
  draft,
  onClose,
  onStartEdit,
  onCancelEdit,
  onChangeDraft,
  onSaveMain,
  onSaveProperties,
  mergeFieldsFromJsonAndSave,
  showSystemErrorToast,
  onCancelStructureFieldsEdit,
  onChangeField,
  onAddField,
  onRemoveField,
  onAddFieldValue,
  onRemoveFieldValue,
  onChangeFieldValue,
  onReferenceBookJsonFileChange,
  referenceBooksDbTablesApiUrl,
  referenceBooksDbTableColumnsApiUrl = "",
  onAddLinkTableRow,
  onChangeLinkTableName,
  onRemoveLinkTableRow,
  onAddSynonymRow,
  onRemoveSynonymRow,
  onChangeSynonymKeyField,
  onDeleteReferenceBook,
  onReorderFields,
  onSaveRules,
  onCancelRulesEdit,
  onAddRule,
  onRemoveRule,
  onChangeRuleType,
  onAddRuleField,
  onRemoveRuleField,
  onChangeRuleFieldTableName,
  mergeRulesFromJsonAndSave,
  onReferenceBookRulesJsonFileChange
}) {
  const toast = typeof showSystemErrorToast === "function" ? showSystemErrorToast : () => {};

  const [fieldColumnWidths, setFieldColumnWidths] = useState(parseStoredReferenceBookFieldColumnWidths);
  const fieldColumnWidthsRef = useRef(fieldColumnWidths);

  useEffect(() => {
    fieldColumnWidthsRef.current = fieldColumnWidths;
  }, [fieldColumnWidths]);

  useEffect(() => {
    try {
      window.localStorage.setItem(REFERENCE_BOOK_FIELD_TABLE_STORAGE_KEY, JSON.stringify(fieldColumnWidths));
    } catch {
      /* quota */
    }
  }, [fieldColumnWidths]);

  const fieldTableResizeRef = useRef(null);

  const [cardTab, setCardTab] = useState(REFERENCE_BOOK_CARD_TAB_MAIN);
  const [structurePaneMode, setStructurePaneMode] = useState(REFERENCE_BOOK_STRUCTURE_PANE_FIELDS);
  const [structureFieldsEditMode, setStructureFieldsEditMode] = useState(false);
  const [rulesEditMode, setRulesEditMode] = useState(false);
  const [rulesPaneMode, setRulesPaneMode] = useState(REFERENCE_BOOK_RULES_PANE_FIELDS);
  const [rulesJsonEditMode, setRulesJsonEditMode] = useState(false);
  const [jsonEditMode, setJsonEditMode] = useState(false);
  const [referenceBookJsonZoom, setReferenceBookJsonZoom] = useState(() => parseStoredReferenceBookJsonZoom());
  const referenceBookJsonFileInputRef = useRef(null);
  const referenceBookRulesJsonFileInputRef = useRef(null);
  const reportTemplateJsonEditorPanelRef = useRef(null);
  const [dbTablesList, setDbTablesList] = useState([]);
  const [dbTablesLoading, setDbTablesLoading] = useState(false);

  useEffect(() => {
    setCardTab(REFERENCE_BOOK_CARD_TAB_MAIN);
    setStructurePaneMode(REFERENCE_BOOK_STRUCTURE_PANE_FIELDS);
    setStructureFieldsEditMode(false);
    setRulesEditMode(false);
    setRulesPaneMode(REFERENCE_BOOK_RULES_PANE_FIELDS);
    setRulesJsonEditMode(false);
    setJsonEditMode(false);
    setDbTablesList([]);
  }, [item?.id]);

  useEffect(() => {
    if (isNewRecord) {
      setCardTab(REFERENCE_BOOK_CARD_TAB_MAIN);
      setStructurePaneMode(REFERENCE_BOOK_STRUCTURE_PANE_FIELDS);
      setStructureFieldsEditMode(false);
      setRulesEditMode(false);
      setRulesPaneMode(REFERENCE_BOOK_RULES_PANE_FIELDS);
      setRulesJsonEditMode(false);
      setJsonEditMode(false);
    }
  }, [isNewRecord]);

  useEffect(() => {
    if (cardTab !== REFERENCE_BOOK_CARD_TAB_RULES) {
      setRulesPaneMode(REFERENCE_BOOK_RULES_PANE_FIELDS);
      setRulesJsonEditMode(false);
    }
  }, [cardTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(REFERENCE_BOOK_JSON_ZOOM_STORAGE_KEY, String(referenceBookJsonZoom));
    } catch {
      /* quota */
    }
  }, [referenceBookJsonZoom]);

  const handleReferenceBookJsonZoomDecrease = useCallback(() => {
    setReferenceBookJsonZoom((prev) => Math.max(0.7, Number((prev - 0.1).toFixed(2))));
  }, []);

  const handleReferenceBookJsonZoomIncrease = useCallback(() => {
    setReferenceBookJsonZoom((prev) => Math.min(1.6, Number((prev + 0.1).toFixed(2))));
  }, []);

  const handleReferenceBookUploadJsonClick = useCallback(() => {
    if (isSaving) {
      return;
    }
    const input = referenceBookJsonFileInputRef.current;
    if (input) {
      input.value = "";
      input.click();
    }
  }, [isSaving]);

  const propertiesJsonPretty = useMemo(() => {
    if (!draft || typeof draft !== "object") {
      return "{\n}\n";
    }
    try {
      const payload = buildReferenceBookPropertiesPayload(draft);
      return `${JSON.stringify(payload, null, 2)}\n`;
    } catch {
      return "{\n}\n";
    }
  }, [draft]);

  const committedJsonText = useMemo(() => propertiesJsonPretty.trimEnd(), [propertiesJsonPretty]);

  const rulesJsonPretty = useMemo(() => {
    try {
      const payload = buildReferenceBookRulesPayload(draft) ?? [];
      return `${JSON.stringify(payload, null, 2)}\n`;
    } catch {
      return "[\n]\n";
    }
  }, [draft]);

  const rulesCommittedJsonText = useMemo(() => rulesJsonPretty.trimEnd(), [rulesJsonPretty]);

  const handleDownloadReferenceBookJson = useCallback(() => {
    const baseName = sanitizeReferenceBookDownloadFileName(draft?.name ?? item?.name);
    const blob = new Blob([propertiesJsonPretty], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.json`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  }, [draft?.name, item?.name, propertiesJsonPretty]);

  const handleDownloadRulesJson = useCallback(() => {
    const baseName = sanitizeReferenceBookDownloadFileName(draft?.name ?? item?.name);
    const blob = new Blob([rulesJsonPretty], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}-rules.json`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  }, [draft?.name, item?.name, rulesJsonPretty]);

  const handleOpenRulesJsonPane = useCallback(() => {
    setRulesPaneMode(REFERENCE_BOOK_RULES_PANE_JSON);
    setRulesJsonEditMode(false);
  }, []);

  const handleBackToRulesFields = useCallback(() => {
    setRulesPaneMode(REFERENCE_BOOK_RULES_PANE_FIELDS);
    setRulesJsonEditMode(false);
  }, []);

  const handleToggleRulesJsonEdit = useCallback(() => {
    setRulesJsonEditMode(true);
  }, []);

  const handleCancelRulesJsonEdit = useCallback(() => {
    setRulesJsonEditMode(false);
  }, []);

  const handleReferenceBookRulesJsonUploadClick = useCallback(() => {
    if (isSaving) {
      return;
    }
    const input = referenceBookRulesJsonFileInputRef.current;
    if (input) {
      input.value = "";
      input.click();
    }
  }, [isSaving]);

  const handleSaveRulesJsonEditor = useCallback(async () => {
    const raw = reportTemplateJsonEditorPanelRef.current?.getValue?.();
    let parsed;
    try {
      parsed = JSON.parse(String(raw ?? ""));
    } catch (e) {
      toast(e instanceof Error ? `JSON: ${e.message}` : "JSON: ошибка разбора");
      return;
    }
    if (!Array.isArray(parsed)) {
      toast("Ожидается JSON-массив правил");
      return;
    }
    const ok = await mergeRulesFromJsonAndSave?.(parsed);
    if (ok !== false) {
      setRulesJsonEditMode(false);
    }
  }, [mergeRulesFromJsonAndSave, toast]);

  const handleSaveStructureFields = useCallback(async () => {
    const ok = await onSaveProperties?.(draft);
    if (ok !== false) {
      setStructureFieldsEditMode(false);
    }
  }, [onSaveProperties, draft]);

  const handleCancelStructureFields = useCallback(() => {
    onCancelStructureFieldsEdit?.();
    setStructureFieldsEditMode(false);
  }, [onCancelStructureFieldsEdit]);

  const handleToggleJsonEdit = useCallback(() => {
    setJsonEditMode(true);
  }, []);

  const handleCancelJsonEdit = useCallback(() => {
    setJsonEditMode(false);
  }, []);

  const handleSaveJsonEditor = useCallback(async () => {
    const raw = reportTemplateJsonEditorPanelRef.current?.getValue?.();
    let parsed;
    try {
      parsed = JSON.parse(String(raw ?? ""));
    } catch (e) {
      toast(e instanceof Error ? `JSON: ${e.message}` : "JSON: ошибка разбора");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray(parsed.fields)) {
      toast('Ожидается объект вида { "fields": [ ... ] }');
      return;
    }
    const ok = await mergeFieldsFromJsonAndSave?.(parsed);
    if (ok !== false) {
      setJsonEditMode(false);
    }
  }, [mergeFieldsFromJsonAndSave, toast]);

  const handleEnsureDbTablesLoaded = useCallback(async () => {
    if (dbTablesLoading) {
      return;
    }
    if (dbTablesList.length > 0) {
      return;
    }
    const url = String(referenceBooksDbTablesApiUrl ?? "").trim();
    if (!url) {
      toast("Не задан URL списка таблиц БД");
      return;
    }
    setDbTablesLoading(true);
    try {
      const response = await fetch(url);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Ошибка ${response.status}`);
      }
      setDbTablesList(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось загрузить список таблиц");
    } finally {
      setDbTablesLoading(false);
    }
  }, [dbTablesList.length, dbTablesLoading, referenceBooksDbTablesApiUrl, toast]);

  const handleFieldTableResizeStart = useCallback((fieldKey, event) => {
    event.preventDefault();
    event.stopPropagation();
    const defaults = getDefaultReferenceBookFieldColumnWidths();
    const startWidth = Math.round(
      Number(fieldColumnWidthsRef.current[fieldKey] ?? defaults[fieldKey]) || defaults[fieldKey]
    );
    fieldTableResizeRef.current = {
      fieldKey,
      startX: event.clientX,
      startWidth
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent) => {
      if (!fieldTableResizeRef.current) {
        return;
      }
      const delta = moveEvent.clientX - fieldTableResizeRef.current.startX;
      const key = fieldTableResizeRef.current.fieldKey;
      const nextWidth = Math.max(
        REFERENCE_BOOK_FIELD_TABLE_MIN_WIDTH,
        fieldTableResizeRef.current.startWidth + delta
      );
      setFieldColumnWidths((prev) => ({ ...prev, [key]: nextWidth }));
    };

    const handleMouseUp = () => {
      fieldTableResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  const title = useMemo(() => {
    if (isNewRecord) {
      const code = String(draft?.code ?? "").trim();
      const name = String(draft?.name ?? "").trim();
      if (code && name) {
        return `${code} — ${name}`;
      }
      return code || name || "Новый справочник";
    }
    const code = String(item?.code ?? "").trim();
    const name = String(item?.name ?? "").trim();
    if (code && name) {
      return `${code} — ${name}`;
    }
    return code || name || "Справочник";
  }, [draft?.code, draft?.name, isNewRecord, item]);

  const visibleFieldTableColumns = useMemo(() => REFERENCE_BOOK_FIELD_TABLE_COLUMNS, []);

  const fieldsTableTotalWidthPx = useMemo(() => {
    return visibleFieldTableColumns.reduce((sum, col) => {
      const w = Number(fieldColumnWidths[col.key] ?? col.defaultWidth);
      return sum + (Number.isFinite(w) ? w : col.defaultWidth);
    }, 0);
  }, [visibleFieldTableColumns, fieldColumnWidths]);

  const isStructureEditing = structureFieldsEditMode || jsonEditMode;
  const rulesEditable = isNewRecord || rulesEditMode;
  const isRulesPanelEditing =
    cardTab === REFERENCE_BOOK_CARD_TAB_RULES &&
    ((rulesPaneMode === REFERENCE_BOOK_RULES_PANE_FIELDS && rulesEditable) ||
      (rulesPaneMode === REFERENCE_BOOK_RULES_PANE_JSON && rulesJsonEditMode));
  const panelBodyEditClass =
    isEditMode || isStructureEditing || isRulesPanelEditing ? " employee-card-main-tab-content-edit-mode" : "";

  const handleTabMain = useCallback(() => {
    setCardTab(REFERENCE_BOOK_CARD_TAB_MAIN);
  }, []);

  const handleTabStructure = useCallback(() => {
    setCardTab(REFERENCE_BOOK_CARD_TAB_STRUCTURE);
  }, []);

  const handleTabRules = useCallback(() => {
    setCardTab(REFERENCE_BOOK_CARD_TAB_RULES);
  }, []);

  const handleCancelRulesEdit = useCallback(() => {
    onCancelRulesEdit?.();
    setRulesEditMode(false);
  }, [onCancelRulesEdit]);

  const handleSaveRulesClick = useCallback(async () => {
    const ok = await onSaveRules?.();
    if (ok !== false) {
      setRulesEditMode(false);
    }
  }, [onSaveRules]);

  const handleOpenStructureJsonPane = useCallback(() => {
    setStructurePaneMode(REFERENCE_BOOK_STRUCTURE_PANE_JSON);
    setJsonEditMode(false);
  }, []);

  const handleBackToStructureFields = useCallback(() => {
    setStructurePaneMode(REFERENCE_BOOK_STRUCTURE_PANE_FIELDS);
    setJsonEditMode(false);
  }, []);

  const fieldsTableScrollRef = useRef(null);
  const referenceBookFieldsDragSourceRef = useRef(null);
  const referenceBookFieldsDragImageRef = useRef(null);
  const referenceBookFieldsDragAutoScrollStateRef = useRef({
    rafId: 0,
    wrapper: null,
    direction: 0,
    speed: 0
  });
  const draftFieldsRef = useRef([]);
  const structureFieldsEditModeRef = useRef(false);
  const onReorderFieldsRef = useRef(onReorderFields);

  useEffect(() => {
    draftFieldsRef.current = Array.isArray(draft?.fields) ? draft.fields : [];
  }, [draft?.fields]);

  useEffect(() => {
    structureFieldsEditModeRef.current = structureFieldsEditMode;
  }, [structureFieldsEditMode]);

  useEffect(() => {
    onReorderFieldsRef.current = onReorderFields;
  }, [onReorderFields]);

  const [fieldDragSourceIndex, setFieldDragSourceIndex] = useState(null);
  const [fieldDragOverIndex, setFieldDragOverIndex] = useState(null);

  const stopReferenceBookFieldDragAutoScroll = useCallback(() => {
    const state = referenceBookFieldsDragAutoScrollStateRef.current;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    state.rafId = 0;
    state.wrapper = null;
    state.direction = 0;
    state.speed = 0;
  }, []);

  const getDragClientYForReferenceBookFields = useCallback((event) => {
    const directClientY = Number(event?.clientY);
    if (Number.isFinite(directClientY)) {
      return directClientY;
    }
    const nativeClientY = Number(event?.nativeEvent?.clientY);
    if (Number.isFinite(nativeClientY)) {
      return nativeClientY;
    }
    const pageY = Number(event?.pageY ?? event?.nativeEvent?.pageY);
    if (Number.isFinite(pageY)) {
      return pageY - window.scrollY;
    }
    return null;
  }, []);

  const resolveReferenceBookFieldScrollContainer = useCallback(() => {
    const wrapper = fieldsTableScrollRef.current;
    if (!(wrapper instanceof HTMLElement)) {
      return null;
    }
    if (wrapper.scrollHeight > wrapper.clientHeight + 1) {
      return wrapper;
    }
    let node = wrapper.parentElement;
    while (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      const overflowY = String(style.overflowY ?? "").toLowerCase();
      const isScrollableOverflow =
        overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      if (isScrollableOverflow && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentElement;
    }
    return wrapper;
  }, []);

  const updateReferenceBookFieldDragAutoScroll = useCallback(
    (clientY) => {
      if (!Number.isFinite(clientY)) {
        return;
      }
      const scrollContainer = resolveReferenceBookFieldScrollContainer();
      if (!(scrollContainer instanceof HTMLElement)) {
        return;
      }
      const bounds = scrollContainer.getBoundingClientRect();
      const edgeThresholdPx = 136;
      const outsideBoostDistancePx = 320;
      let direction = 0;
      let speed = 0;
      if (clientY < bounds.top + edgeThresholdPx) {
        direction = -1;
        const outsideDistance = Math.max(0, bounds.top - clientY);
        if (outsideDistance > 0) {
          const outsideRatio = Math.min(1, outsideDistance / outsideBoostDistancePx);
          speed = Math.ceil(480 + outsideRatio * 1150);
        } else {
          const insideRatio = Math.min(
            1,
            Math.max(0, (bounds.top + edgeThresholdPx - clientY) / edgeThresholdPx)
          );
          speed = Math.ceil(170 + insideRatio * 560);
        }
      } else if (clientY > bounds.bottom - edgeThresholdPx) {
        direction = 1;
        const outsideDistance = Math.max(0, clientY - bounds.bottom);
        if (outsideDistance > 0) {
          const outsideRatio = Math.min(1, outsideDistance / outsideBoostDistancePx);
          speed = Math.ceil(480 + outsideRatio * 1150);
        } else {
          const insideRatio = Math.min(
            1,
            Math.max(0, (clientY - (bounds.bottom - edgeThresholdPx)) / edgeThresholdPx)
          );
          speed = Math.ceil(170 + insideRatio * 560);
        }
      }
      speed = Math.min(1750, Math.max(0, speed));
      const state = referenceBookFieldsDragAutoScrollStateRef.current;
      state.wrapper = scrollContainer;
      state.direction = direction;
      state.speed = direction && speed > 0 ? speed : 0;
      if (!state.direction || state.speed <= 0) {
        if (state.rafId) {
          cancelAnimationFrame(state.rafId);
        }
        state.rafId = 0;
        return;
      }
      if (state.rafId) {
        return;
      }
      let lastTimestamp = 0;
      const tick = () => {
        const activeState = referenceBookFieldsDragAutoScrollStateRef.current;
        if (!activeState.rafId || !(activeState.wrapper instanceof HTMLElement)) {
          activeState.rafId = 0;
          return;
        }
        if (activeState.direction && activeState.speed > 0) {
          const now = performance.now();
          if (!lastTimestamp) {
            lastTimestamp = now;
          }
          const deltaMs = Math.min(40, Math.max(8, now - lastTimestamp));
          lastTimestamp = now;
          activeState.wrapper.scrollTop +=
            activeState.direction * (activeState.speed * deltaMs) / 1000;
        } else {
          activeState.rafId = 0;
          return;
        }
        activeState.rafId = requestAnimationFrame(tick);
      };
      state.rafId = requestAnimationFrame(tick);
    },
    [resolveReferenceBookFieldScrollContainer]
  );

  const handleReferenceBookFieldDrag = useCallback(
    (event) => {
      if (
        referenceBookFieldsDragSourceRef.current === null ||
        referenceBookFieldsDragSourceRef.current === undefined
      ) {
        return;
      }
      const clientY = getDragClientYForReferenceBookFields(event);
      if (Number.isFinite(clientY)) {
        updateReferenceBookFieldDragAutoScroll(clientY);
      }
    },
    [getDragClientYForReferenceBookFields, updateReferenceBookFieldDragAutoScroll]
  );

  const handleReferenceBookFieldsWrapperDragOver = useCallback(
    (event) => {
      if (!structureFieldsEditModeRef.current || typeof onReorderFieldsRef.current !== "function") {
        return;
      }
      if (
        referenceBookFieldsDragSourceRef.current === null ||
        referenceBookFieldsDragSourceRef.current === undefined
      ) {
        return;
      }
      const clientY = getDragClientYForReferenceBookFields(event);
      if (Number.isFinite(clientY)) {
        updateReferenceBookFieldDragAutoScroll(clientY);
      }
    },
    [getDragClientYForReferenceBookFields, updateReferenceBookFieldDragAutoScroll]
  );

  const handleReferenceBookFieldDragOver = useCallback(
    (targetIndex, event) => {
      if (!structureFieldsEditModeRef.current || typeof onReorderFieldsRef.current !== "function") {
        return;
      }
      const sourceIndex = referenceBookFieldsDragSourceRef.current;
      if (sourceIndex === null || sourceIndex === undefined || sourceIndex === targetIndex) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setFieldDragOverIndex(targetIndex);
      const clientY = getDragClientYForReferenceBookFields(event);
      if (Number.isFinite(clientY)) {
        updateReferenceBookFieldDragAutoScroll(clientY);
      }
    },
    [getDragClientYForReferenceBookFields, updateReferenceBookFieldDragAutoScroll]
  );

  const handleReferenceBookFieldDragStart = useCallback(
    (sourceIndex, fieldLabel, event) => {
      if (!structureFieldsEditModeRef.current || typeof onReorderFieldsRef.current !== "function") {
        return;
      }
      const list = draftFieldsRef.current;
      if (!Array.isArray(list) || list.length <= 1) {
        return;
      }
      referenceBookFieldsDragSourceRef.current = sourceIndex;
      setFieldDragSourceIndex(sourceIndex);
      const dragLabelNode = document.createElement("div");
      dragLabelNode.className = "report-template-field-drag-preview";
      dragLabelNode.textContent = String(fieldLabel ?? "").trim() || "Поле";
      document.body.appendChild(dragLabelNode);
      referenceBookFieldsDragImageRef.current = dragLabelNode;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(sourceIndex));
      try {
        event.dataTransfer.setDragImage(dragLabelNode, 16, 16);
      } catch {
        /* Safari / старые движки */
      }
    },
    []
  );

  const handleReferenceBookFieldDrop = useCallback(
    (targetIndex, event) => {
      if (!structureFieldsEditModeRef.current || typeof onReorderFieldsRef.current !== "function") {
        return;
      }
      event.preventDefault();
      stopReferenceBookFieldDragAutoScroll();
      const sourceIndex = referenceBookFieldsDragSourceRef.current;
      referenceBookFieldsDragSourceRef.current = null;
      if (sourceIndex === null || sourceIndex === undefined || sourceIndex === targetIndex) {
        setFieldDragSourceIndex(null);
        setFieldDragOverIndex(null);
        const dragImageNode = referenceBookFieldsDragImageRef.current;
        if (dragImageNode?.parentNode) {
          dragImageNode.parentNode.removeChild(dragImageNode);
        }
        referenceBookFieldsDragImageRef.current = null;
        return;
      }
      const list = draftFieldsRef.current;
      if (!Array.isArray(list) || list.length <= 1) {
        setFieldDragSourceIndex(null);
        setFieldDragOverIndex(null);
        return;
      }
      onReorderFieldsRef.current(sourceIndex, targetIndex);
      setFieldDragSourceIndex(null);
      setFieldDragOverIndex(null);
      const dragImageNode = referenceBookFieldsDragImageRef.current;
      if (dragImageNode?.parentNode) {
        dragImageNode.parentNode.removeChild(dragImageNode);
      }
      referenceBookFieldsDragImageRef.current = null;
    },
    [stopReferenceBookFieldDragAutoScroll]
  );

  const handleReferenceBookFieldDragEnd = useCallback(() => {
    stopReferenceBookFieldDragAutoScroll();
    referenceBookFieldsDragSourceRef.current = null;
    setFieldDragSourceIndex(null);
    setFieldDragOverIndex(null);
    const dragImageNode = referenceBookFieldsDragImageRef.current;
    if (dragImageNode?.parentNode) {
      dragImageNode.parentNode.removeChild(dragImageNode);
    }
    referenceBookFieldsDragImageRef.current = null;
  }, [stopReferenceBookFieldDragAutoScroll]);

  useEffect(
    () => () => {
      stopReferenceBookFieldDragAutoScroll();
    },
    [stopReferenceBookFieldDragAutoScroll]
  );

  useEffect(() => {
    const handleWindowDragOver = (event) => {
      if (
        referenceBookFieldsDragSourceRef.current === null ||
        referenceBookFieldsDragSourceRef.current === undefined
      ) {
        return;
      }
      const clientY = getDragClientYForReferenceBookFields(event);
      if (!Number.isFinite(clientY)) {
        return;
      }
      updateReferenceBookFieldDragAutoScroll(clientY);
    };
    const handleWindowDrag = (event) => {
      if (
        referenceBookFieldsDragSourceRef.current === null ||
        referenceBookFieldsDragSourceRef.current === undefined
      ) {
        return;
      }
      const clientY = getDragClientYForReferenceBookFields(event);
      if (!Number.isFinite(clientY)) {
        return;
      }
      updateReferenceBookFieldDragAutoScroll(clientY);
    };
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drag", handleWindowDrag);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drag", handleWindowDrag);
    };
  }, [getDragClientYForReferenceBookFields, updateReferenceBookFieldDragAutoScroll]);

  if (!isOpen || !draft || (!item && !isNewRecord)) {
    return null;
  }

  const fields = Array.isArray(draft.fields) ? draft.fields : [];
  const mainTableNameForFields = String(draft?.tableName ?? "").trim();

  const renderFieldsTable = (isFieldEditMode) => (
    <div
      ref={fieldsTableScrollRef}
      className="employee-card-positions-table-wrapper reference-book-fields-table-wrapper"
      onDragOver={handleReferenceBookFieldsWrapperDragOver}
    >
      <table
        className={`employee-card-positions-table reference-book-fields-table${
          isFieldEditMode ? " reference-book-fields-table--relations-style" : ""
        }`}
        style={{
          width: `${fieldsTableTotalWidthPx}px`,
          minWidth: `${fieldsTableTotalWidthPx}px`,
          maxWidth: `${fieldsTableTotalWidthPx}px`
        }}
      >
        <colgroup>
          {visibleFieldTableColumns.map((col) => {
            const w = Math.round(Number(fieldColumnWidths[col.key] ?? col.defaultWidth) || col.defaultWidth);
            return (
              <col
                key={`rb-ft-col-${col.key}`}
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
            {visibleFieldTableColumns.map((col) => (
              <th
                key={`rb-ft-th-${col.key}`}
                className={
                  col.key === "actions"
                    ? "reference-book-fields-actions-header reference-book-fields-actions-col"
                    : ""
                }
              >
                {col.title ? (
                  <div className="column-sort-button">
                    <span data-tooltip={col.hint ? String(col.hint) : undefined}>{col.title}</span>
                  </div>
                ) : null}
                <span
                  className="column-resize-handle"
                  onMouseDown={(e) => handleFieldTableResizeStart(col.key, e)}
                  role="presentation"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.length === 0 ? (
            <tr>
              <td colSpan={visibleFieldTableColumns.length} className="reference-book-fields-empty-cell">
                {isFieldEditMode ? "Нет полей — нажмите «Добавить поле»" : "Поля не заданы"}
              </td>
            </tr>
          ) : (
            fields.map((field, index) => {
              const showReadonlyText = linkFieldReadonlyText(field.fieldLinkShowFields, (r) => r?.fieldLinkShowField);
              const listReadonlyText = linkFieldReadonlyText(field.fieldLinkShowLists, (r) => r?.fieldLinkShowList);
              const tipReadonlyText = linkFieldReadonlyText(field.fieldLinkShowTooltips, (r) => r?.fieldLinkShowTooltip);
              const linkBlockedByFieldValues = fieldHasFieldValuesBlockingLink(field);
              const linkFieldCombosDisabled =
                isSaving ||
                linkBlockedByFieldValues ||
                !String(field.fieldLinkTable ?? "").trim();
              return (
              <tr
                key={field.fieldClientKey || `rb-field-${index}`}
                className={[
                  fieldDragSourceIndex === index ? "reference-book-field-row--dragging" : "",
                  fieldDragOverIndex === index && fieldDragSourceIndex !== index
                    ? "reference-book-field-row--drag-over"
                    : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                onDragOver={(e) => handleReferenceBookFieldDragOver(index, e)}
                onDrop={(e) => handleReferenceBookFieldDrop(index, e)}
              >
                <td className="reference-book-field-order-cell">
                  <div className="reference-book-field-order-inner">
                    {isFieldEditMode && typeof onReorderFields === "function" && fields.length > 1 ? (
                      <span
                        className="report-template-row-drag-handle"
                        draggable
                        onDragStart={(e) =>
                          handleReferenceBookFieldDragStart(
                            index,
                            field.fieldName ?? field.fieldCaption ?? "",
                            e
                          )
                        }
                        onDrag={handleReferenceBookFieldDrag}
                        onDragEnd={handleReferenceBookFieldDragEnd}
                        data-tooltip="Перетащить строку"
                        aria-label="Перетащить строку"
                      >
                        ⋮⋮
                      </span>
                    ) : null}
                    <span className="reference-book-field-order-number">{index + 1}</span>
                  </div>
                </td>
                <td>
                  {isFieldEditMode ? (
                    mainTableNameForFields ? (
                      <ReferenceBookDbColumnCombobox
                        value={field.fieldName ?? ""}
                        onChange={(v) => onChangeField(index, { fieldName: sanitizeFieldNameInput(v) })}
                        tableName={mainTableNameForFields}
                        disabled={isSaving}
                        columnsApiUrl={referenceBooksDbTableColumnsApiUrl}
                        showSystemErrorToast={toast}
                        placeholder="столбец таблицы"
                        listAriaLabel="Столбцы основной таблицы справочника"
                        disabledHint="Укажите имя таблицы справочника на вкладке «Основные параметры»"
                      />
                    ) : (
                      <RelationsFilterTextField
                        value={field.fieldName}
                        onChange={(v) => onChangeField(index, { fieldName: sanitizeFieldNameInput(v) })}
                        placeholder="латиница, _"
                        data-tooltip="Только латиница, цифры и _; сначала задайте таблицу справочника для выбора из списка"
                        spellCheck={false}
                      />
                    )
                  ) : (
                    <TableReadonlyValue>{field.fieldName || "—"}</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    <RelationsFilterTextField
                      value={field.fieldCaption}
                      onChange={(v) => onChangeField(index, { fieldCaption: v })}
                    />
                  ) : (
                    <TableReadonlyValue>{field.fieldCaption || "—"}</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    <select
                      className="employee-card-relations-filter-input employee-card-field-select reference-book-field-table-input"
                      value={field.fieldType}
                      onChange={(e) => onChangeField(index, { fieldType: e.target.value })}
                    >
                      {REFERENCE_BOOK_FIELD_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TableReadonlyValue>{field.fieldType || "—"}</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    <select
                      className="employee-card-relations-filter-input employee-card-field-select reference-book-field-table-input"
                      value={field.fieldRequired ? "true" : "false"}
                      onChange={(e) => onChangeField(index, { fieldRequired: e.target.value === "true" })}
                    >
                      <option value="false">НЕТ</option>
                      <option value="true">ДА</option>
                    </select>
                  ) : (
                    <TableReadonlyValue>{field.fieldRequired ? "ДА" : "НЕТ"}</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {field.fieldType === "varchar" ? (
                    isFieldEditMode ? (
                      <RelationsFilterTextField
                        value={field.fieldDefaultValueString}
                        onChange={(v) => onChangeField(index, { fieldDefaultValueString: v })}
                      />
                    ) : (
                      <TableReadonlyValue>{field.fieldDefaultValueString || "—"}</TableReadonlyValue>
                    )
                  ) : (
                    <TableReadonlyValue>—</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {field.fieldType === "numeric" ? (
                    isFieldEditMode ? (
                      <RelationsFilterTextField
                        type="text"
                        inputMode="decimal"
                        value={field.fieldDefaultValueNumeric}
                        onChange={(v) => onChangeField(index, { fieldDefaultValueNumeric: v })}
                      />
                    ) : (
                      <TableReadonlyValue>{field.fieldDefaultValueNumeric || "—"}</TableReadonlyValue>
                    )
                  ) : (
                    <TableReadonlyValue>—</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {field.fieldType === "boolean" ? (
                    isFieldEditMode ? (
                      <select
                        className="employee-card-relations-filter-input employee-card-field-select reference-book-field-table-input"
                        value={field.fieldDefaultValueBoolean ? "true" : "false"}
                        onChange={(e) =>
                          onChangeField(index, {
                            fieldDefaultValueBoolean: e.target.value === "true"
                          })
                        }
                      >
                        <option value="false">false</option>
                        <option value="true">true</option>
                      </select>
                    ) : (
                      <TableReadonlyValue>{field.fieldDefaultValueBoolean ? "true" : "false"}</TableReadonlyValue>
                    )
                  ) : (
                    <TableReadonlyValue>—</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    <select
                      className="employee-card-relations-filter-input employee-card-field-select reference-book-field-table-input"
                      value={field.fieldShow ? "true" : "false"}
                      onChange={(e) => onChangeField(index, { fieldShow: e.target.value === "true" })}
                    >
                      <option value="true">ДА</option>
                      <option value="false">НЕТ</option>
                    </select>
                  ) : (
                    <TableReadonlyValue>{field.fieldShow ? "ДА" : "НЕТ"}</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    <select
                      className="employee-card-relations-filter-input employee-card-field-select reference-book-field-table-input"
                      value={field.fieldEdit ? "true" : "false"}
                      onChange={(e) => onChangeField(index, { fieldEdit: e.target.value === "true" })}
                    >
                      <option value="true">ДА</option>
                      <option value="false">НЕТ</option>
                    </select>
                  ) : (
                    <TableReadonlyValue>{field.fieldEdit ? "ДА" : "НЕТ"}</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    <select
                      className="employee-card-relations-filter-input employee-card-field-select reference-book-field-table-input"
                      value={field.uniqueValue ? "true" : "false"}
                      onChange={(e) => onChangeField(index, { uniqueValue: e.target.value === "true" })}
                    >
                      <option value="false">НЕТ</option>
                      <option value="true">ДА</option>
                    </select>
                  ) : (
                    <TableReadonlyValue>{field.uniqueValue ? "ДА" : "НЕТ"}</TableReadonlyValue>
                  )}
                </td>
                <td className="reference-book-field-values-cell">
                  {field.fieldType === "varchar" ? (
                    <div className="reference-book-field-values-stack">
                      {(Array.isArray(field.fieldValues) ? field.fieldValues : []).map((vr, vi) => (
                        <div key={`fv-str-${index}-${vi}`} className="reference-book-field-value-inline">
                          {isFieldEditMode ? (
                            <>
                              <RelationsFilterTextField
                                value={vr.fieldValueString}
                                onChange={(v) => onChangeFieldValue(index, vi, v, "fieldValueString")}
                                placeholder="Хранение (БД)"
                              />
                              <button
                                type="button"
                                className="employee-card-position-action-button"
                                onClick={() => onRemoveFieldValue(index, vi)}
                                aria-label="Удалить значение"
                                data-tooltip="Удалить"
                              >
                                <IconTrash aria-hidden />
                              </button>
                            </>
                          ) : (
                            <TableReadonlyValue>{vr.fieldValueString || "—"}</TableReadonlyValue>
                          )}
                        </div>
                      ))}
                      {isFieldEditMode ? (
                        <button
                          type="button"
                          className="panel-action-button reference-book-add-value-inline"
                          onClick={() => onAddFieldValue(index)}
                        >
                          <IconPlus aria-hidden />
                          <span>Значение</span>
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <TableReadonlyValue>—</TableReadonlyValue>
                  )}
                </td>
                <td className="reference-book-field-values-cell">
                  {field.fieldType === "varchar" ? (
                    <div className="reference-book-field-values-stack">
                      {(Array.isArray(field.fieldValues) ? field.fieldValues : []).map((vr, vi) => (
                        <div key={`fv-show-${index}-${vi}`} className="reference-book-field-value-inline">
                          {isFieldEditMode ? (
                            <RelationsFilterTextField
                              value={vr.fieldValueShow ?? ""}
                              onChange={(v) => onChangeFieldValue(index, vi, v, "fieldValueShow")}
                              placeholder="Отображение"
                            />
                          ) : (
                            <TableReadonlyValue>{vr.fieldValueShow || vr.fieldValueString || "—"}</TableReadonlyValue>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <TableReadonlyValue>—</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    <ReferenceBookLinkTableCombobox
                      value={field.fieldLinkTable ?? ""}
                      disabled={isSaving || linkBlockedByFieldValues}
                      disabledHint={
                        linkBlockedByFieldValues ? REFERENCE_BOOK_LINK_BLOCKED_BY_FIELD_VALUES_HINT : ""
                      }
                        onChange={(v) => {
                          const next = sanitizeTableNameInput(String(v ?? ""));
                          const prev = sanitizeTableNameInput(String(field.fieldLinkTable ?? ""));
                          if (next === prev) {
                            return;
                          }
                          onChangeField(index, {
                            fieldLinkTable: next,
                            fieldLinkField: "",
                            fieldLinkShowFields: [createEmptyFieldLinkShowRow(1)],
                            fieldLinkShowLists: [createEmptyFieldLinkListRow(1)],
                            fieldLinkShowTooltips: [createEmptyFieldLinkTooltipRow(1)],
                            fieldLinkFiltr: ""
                            /* fieldLinkListType не трогаем — иначе «Совпадение» сбрасывается при смене/коммите таблицы */
                          });
                        }}
                      tables={dbTablesList}
                      loading={dbTablesLoading}
                      onEnsureTablesLoaded={handleEnsureDbTablesLoaded}
                    />
                  ) : (
                    <TableReadonlyValue>{field.fieldLinkTable || "—"}</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    <ReferenceBookDbColumnCombobox
                      value={field.fieldLinkField ?? ""}
                      onChange={(v) => onChangeField(index, { fieldLinkField: sanitizeFieldNameInput(v) })}
                      tableName={field.fieldLinkTable ?? ""}
                      disabled={linkFieldCombosDisabled}
                      secondaryDisabledHint={
                        linkBlockedByFieldValues ? REFERENCE_BOOK_LINK_BLOCKED_BY_FIELD_VALUES_HINT : ""
                      }
                      columnsApiUrl={referenceBooksDbTableColumnsApiUrl}
                      showSystemErrorToast={toast}
                      placeholder="столбец"
                      listAriaLabel="Столбцы таблицы связи"
                      disabledHint="Сначала укажите таблицу связи"
                    />
                  ) : (
                    <TableReadonlyValue>{field.fieldLinkField || "—"}</TableReadonlyValue>
                  )}
                </td>
                <td className="reference-book-field-values-cell reference-book-field-link-show-cell">
                  {isFieldEditMode ? (
                    <div className="reference-book-field-values-stack">
                      {(() => {
                        const showList =
                          Array.isArray(field.fieldLinkShowFields) && field.fieldLinkShowFields.length > 0
                            ? field.fieldLinkShowFields
                            : [createEmptyFieldLinkShowRow(1)];
                        return showList.map((vr, vi) => (
                          <div key={`rb-lnk-show-${index}-${vi}`} className="reference-book-field-value-inline">
                            <ReferenceBookDbColumnCombobox
                              value={vr.fieldLinkShowField ?? ""}
                              onChange={(v) => {
                                const base =
                                  Array.isArray(field.fieldLinkShowFields) && field.fieldLinkShowFields.length > 0
                                    ? [...field.fieldLinkShowFields]
                                    : [createEmptyFieldLinkShowRow(1)];
                                base[vi] = {
                                  fieldLinkShowField: sanitizeFieldNameInput(v),
                                  orderPos: vi + 1
                                };
                                onChangeField(index, {
                                  fieldLinkShowFields: base.map((r, i) => ({
                                    ...r,
                                    orderPos: i + 1
                                  }))
                                });
                              }}
                              tableName={field.fieldLinkTable ?? ""}
                              disabled={linkFieldCombosDisabled}
                              secondaryDisabledHint={
                                linkBlockedByFieldValues ? REFERENCE_BOOK_LINK_BLOCKED_BY_FIELD_VALUES_HINT : ""
                              }
                              columnsApiUrl={referenceBooksDbTableColumnsApiUrl}
                              showSystemErrorToast={toast}
                              placeholder="столбец"
                              listAriaLabel="Столбец отображения связи"
                              disabledHint="Сначала укажите таблицу связи"
                            />
                            {showList.length > 1 ? (
                              <button
                                type="button"
                                className="employee-card-position-action-button"
                                data-tooltip="Удалить"
                                aria-label="Удалить поле показа"
                                disabled={isSaving || linkBlockedByFieldValues}
                                onClick={() => {
                                  const base =
                                    Array.isArray(field.fieldLinkShowFields) &&
                                    field.fieldLinkShowFields.length > 0
                                      ? [...field.fieldLinkShowFields]
                                      : [createEmptyFieldLinkShowRow(1)];
                                  let next = base.filter((_, i) => i !== vi);
                                  if (next.length === 0) {
                                    next = [createEmptyFieldLinkShowRow(1)];
                                  }
                                  onChangeField(index, {
                                    fieldLinkShowFields: next.map((r, i) => ({
                                      ...r,
                                      orderPos: i + 1
                                    }))
                                  });
                                }}
                              >
                                <IconTrash aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        ));
                      })()}
                      <button
                        type="button"
                        className="panel-action-button reference-book-add-value-inline"
                        disabled={linkFieldCombosDisabled}
                        onClick={() => {
                          const base = Array.isArray(field.fieldLinkShowFields)
                            ? [...field.fieldLinkShowFields]
                            : [createEmptyFieldLinkShowRow(1)];
                          base.push(createEmptyFieldLinkShowRow(base.length + 1));
                          onChangeField(index, {
                            fieldLinkShowFields: base.map((r, i) => ({
                              ...r,
                              orderPos: i + 1
                            }))
                          });
                        }}
                      >
                        <IconPlus aria-hidden />
                        <span>Показ</span>
                      </button>
                    </div>
                  ) : (
                    <TableReadonlyValue>{showReadonlyText}</TableReadonlyValue>
                  )}
                </td>
                <td className="reference-book-field-values-cell reference-book-field-link-list-cell">
                  {isFieldEditMode ? (
                    <div className="reference-book-field-values-stack">
                      {(() => {
                        const listRows =
                          Array.isArray(field.fieldLinkShowLists) && field.fieldLinkShowLists.length > 0
                            ? field.fieldLinkShowLists
                            : [createEmptyFieldLinkListRow(1)];
                        return listRows.map((vr, vi) => (
                          <div key={`rb-lnk-list-${index}-${vi}`} className="reference-book-field-value-inline">
                            <ReferenceBookDbColumnCombobox
                              value={vr.fieldLinkShowList ?? ""}
                              onChange={(v) => {
                                const base =
                                  Array.isArray(field.fieldLinkShowLists) && field.fieldLinkShowLists.length > 0
                                    ? [...field.fieldLinkShowLists]
                                    : [createEmptyFieldLinkListRow(1)];
                                base[vi] = {
                                  fieldLinkShowList: sanitizeFieldNameInput(v),
                                  orderPos: vi + 1
                                };
                                onChangeField(index, {
                                  fieldLinkShowLists: base.map((r, i) => ({
                                    ...r,
                                    orderPos: i + 1
                                  }))
                                });
                              }}
                              tableName={field.fieldLinkTable ?? ""}
                              disabled={linkFieldCombosDisabled}
                              secondaryDisabledHint={
                                linkBlockedByFieldValues ? REFERENCE_BOOK_LINK_BLOCKED_BY_FIELD_VALUES_HINT : ""
                              }
                              columnsApiUrl={referenceBooksDbTableColumnsApiUrl}
                              showSystemErrorToast={toast}
                              placeholder="столбец"
                              listAriaLabel="Столбец списка связи"
                              disabledHint="Сначала укажите таблицу связи"
                            />
                            {listRows.length > 1 ? (
                              <button
                                type="button"
                                className="employee-card-position-action-button"
                                data-tooltip="Удалить"
                                aria-label="Удалить поле списка"
                                disabled={isSaving || linkBlockedByFieldValues}
                                onClick={() => {
                                  const base =
                                    Array.isArray(field.fieldLinkShowLists) &&
                                    field.fieldLinkShowLists.length > 0
                                      ? [...field.fieldLinkShowLists]
                                      : [createEmptyFieldLinkListRow(1)];
                                  let next = base.filter((_, i) => i !== vi);
                                  if (next.length === 0) {
                                    next = [createEmptyFieldLinkListRow(1)];
                                  }
                                  onChangeField(index, {
                                    fieldLinkShowLists: next.map((r, i) => ({
                                      ...r,
                                      orderPos: i + 1
                                    }))
                                  });
                                }}
                              >
                                <IconTrash aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        ));
                      })()}
                      <button
                        type="button"
                        className="panel-action-button reference-book-add-value-inline"
                        disabled={linkFieldCombosDisabled}
                        onClick={() => {
                          const base = Array.isArray(field.fieldLinkShowLists)
                            ? [...field.fieldLinkShowLists]
                            : [createEmptyFieldLinkListRow(1)];
                          base.push(createEmptyFieldLinkListRow(base.length + 1));
                          onChangeField(index, {
                            fieldLinkShowLists: base.map((r, i) => ({
                              ...r,
                              orderPos: i + 1
                            }))
                          });
                        }}
                      >
                        <IconPlus aria-hidden />
                        <span>Список</span>
                      </button>
                    </div>
                  ) : (
                    <TableReadonlyValue>{listReadonlyText}</TableReadonlyValue>
                  )}
                </td>
                <td className="reference-book-field-link-list-type-cell">
                  {isFieldEditMode ? (
                    <select
                      className="employee-card-relations-filter-input employee-card-field-select reference-book-field-table-input"
                      value={normalizeFieldLinkListTypeFromApi(field)}
                      disabled={linkFieldCombosDisabled}
                      data-tooltip={
                        linkBlockedByFieldValues
                          ? REFERENCE_BOOK_LINK_BLOCKED_BY_FIELD_VALUES_HINT
                          : "Как формируется выпадающий список при выборе значения связи"
                      }
                      onChange={(e) => onChangeField(index, { fieldLinkListType: e.target.value })}
                    >
                      <option value="full">Полный</option>
                      <option value="match">Совпадение</option>
                    </select>
                  ) : (
                    <TableReadonlyValue>
                      {normalizeFieldLinkListTypeFromApi(field) === "match" ? "Совпадение" : "Полный"}
                    </TableReadonlyValue>
                  )}
                </td>
                <td className="reference-book-field-values-cell reference-book-field-link-tooltip-cell">
                  {isFieldEditMode ? (
                    <div className="reference-book-field-values-stack">
                      {(() => {
                        const tipList =
                          Array.isArray(field.fieldLinkShowTooltips) && field.fieldLinkShowTooltips.length > 0
                            ? field.fieldLinkShowTooltips
                            : [createEmptyFieldLinkTooltipRow(1)];
                        return tipList.map((vr, vi) => (
                          <div key={`rb-lnk-tip-${index}-${vi}`} className="reference-book-field-value-inline">
                            <ReferenceBookDbColumnCombobox
                              value={vr.fieldLinkShowTooltip ?? ""}
                              onChange={(v) => {
                                const base =
                                  Array.isArray(field.fieldLinkShowTooltips) &&
                                  field.fieldLinkShowTooltips.length > 0
                                    ? [...field.fieldLinkShowTooltips]
                                    : [createEmptyFieldLinkTooltipRow(1)];
                                base[vi] = {
                                  fieldLinkShowTooltip: sanitizeFieldNameInput(v),
                                  orderPos: vi + 1
                                };
                                onChangeField(index, {
                                  fieldLinkShowTooltips: base.map((r, i) => ({
                                    ...r,
                                    orderPos: i + 1
                                  }))
                                });
                              }}
                              tableName={field.fieldLinkTable ?? ""}
                              disabled={linkFieldCombosDisabled}
                              secondaryDisabledHint={
                                linkBlockedByFieldValues ? REFERENCE_BOOK_LINK_BLOCKED_BY_FIELD_VALUES_HINT : ""
                              }
                              columnsApiUrl={referenceBooksDbTableColumnsApiUrl}
                              showSystemErrorToast={toast}
                              placeholder="столбец"
                              listAriaLabel="Столбец тултипа связи"
                              disabledHint="Сначала укажите таблицу связи"
                            />
                            {tipList.length > 1 ? (
                              <button
                                type="button"
                                className="employee-card-position-action-button"
                                data-tooltip="Удалить"
                                aria-label="Удалить поле тултипа"
                                disabled={isSaving || linkBlockedByFieldValues}
                                onClick={() => {
                                  const base =
                                    Array.isArray(field.fieldLinkShowTooltips) &&
                                    field.fieldLinkShowTooltips.length > 0
                                      ? [...field.fieldLinkShowTooltips]
                                      : [createEmptyFieldLinkTooltipRow(1)];
                                  let next = base.filter((_, i) => i !== vi);
                                  if (next.length === 0) {
                                    next = [createEmptyFieldLinkTooltipRow(1)];
                                  }
                                  onChangeField(index, {
                                    fieldLinkShowTooltips: next.map((r, i) => ({
                                      ...r,
                                      orderPos: i + 1
                                    }))
                                  });
                                }}
                              >
                                <IconTrash aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        ));
                      })()}
                      <button
                        type="button"
                        className="panel-action-button reference-book-add-value-inline"
                        disabled={linkFieldCombosDisabled}
                        onClick={() => {
                          const base = Array.isArray(field.fieldLinkShowTooltips)
                            ? [...field.fieldLinkShowTooltips]
                            : [createEmptyFieldLinkTooltipRow(1)];
                          base.push(createEmptyFieldLinkTooltipRow(base.length + 1));
                          onChangeField(index, {
                            fieldLinkShowTooltips: base.map((r, i) => ({
                              ...r,
                              orderPos: i + 1
                            }))
                          });
                        }}
                      >
                        <IconPlus aria-hidden />
                        <span>Тултип</span>
                      </button>
                    </div>
                  ) : (
                    <TableReadonlyValue>{tipReadonlyText}</TableReadonlyValue>
                  )}
                </td>
                <td className="reference-book-field-values-cell reference-book-field-link-filtr-cell">
                  {isFieldEditMode ? (
                    <textarea
                      className="employee-card-relations-filter-input reference-book-field-table-input reference-book-field-link-filtr-textarea"
                      rows={2}
                      value={field.fieldLinkFiltr ?? ""}
                      disabled={linkFieldCombosDisabled}
                      data-tooltip={
                        linkBlockedByFieldValues
                          ? REFERENCE_BOOK_LINK_BLOCKED_BY_FIELD_VALUES_HINT
                          : "Фрагмент SQL для WHERE по таблице связи. Значение поля этой записи: [имя_поля], напр. object_type = [object_type]"
                      }
                      onChange={(e) => onChangeField(index, { fieldLinkFiltr: e.target.value })}
                      placeholder="object_type = [object_type]"
                      spellCheck={false}
                    />
                  ) : (
                    <TableReadonlyValue>{field.fieldLinkFiltr || "—"}</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    <select
                      className="employee-card-relations-filter-input employee-card-field-select reference-book-field-table-input"
                      value={normalizeFieldShowLinkValue(field.fieldShowLink)}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChangeField(index, {
                          fieldShowLink: v,
                          fieldCartType:
                            v === "Карточка" ? normalizeFieldCartTypeValue(field.fieldCartType, "Карточка") : ""
                        });
                      }}
                    >
                      {REFERENCE_BOOK_FIELD_SHOW_LINK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TableReadonlyValue>{normalizeFieldShowLinkValue(field.fieldShowLink)}</TableReadonlyValue>
                  )}
                </td>
                <td>
                  {isFieldEditMode ? (
                    normalizeFieldShowLinkValue(field.fieldShowLink) === "Карточка" ? (
                      <select
                        className="employee-card-relations-filter-input employee-card-field-select reference-book-field-table-input"
                        value={normalizeFieldCartTypeValue(field.fieldCartType, field.fieldShowLink)}
                        disabled={isSaving}
                        data-tooltip="Тип карточки"
                        onChange={(e) => onChangeField(index, { fieldCartType: e.target.value })}
                      >
                        {REFERENCE_BOOK_FIELD_CART_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <TableReadonlyValue data-tooltip="Доступно только при гиперссылке «Карточка»">
                        —
                      </TableReadonlyValue>
                    )
                  ) : (
                    <TableReadonlyValue>
                      {normalizeFieldShowLinkValue(field.fieldShowLink) === "Карточка"
                        ? normalizeFieldCartTypeValue(field.fieldCartType, field.fieldShowLink)
                        : "—"}
                    </TableReadonlyValue>
                  )}
                </td>
                <td className="reference-book-fields-actions-cell">
                  <button
                    type="button"
                    className="employee-card-position-action-button"
                    data-tooltip={isFieldEditMode ? "Удалить поле" : "Доступно в режиме «Изменить»"}
                    aria-label="Удалить поле"
                    disabled={!isFieldEditMode}
                    onClick={() => {
                      if (isFieldEditMode) {
                        onRemoveField(index);
                      }
                    }}
                  >
                    <IconTrash aria-hidden />
                  </button>
                </td>
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <aside
      className={`employee-card-panel report-card-panel${isOpen ? " open" : ""}`}
      aria-hidden={!isOpen}
    >
      <div className="employee-card-panel-header">
        <h2>Справочник</h2>
        <div className="employee-card-full-name employee-card-full-name-header">{title}</div>
        <button
          type="button"
          className="employee-card-close-button"
          onClick={onClose}
          aria-label="Закрыть карточку справочника"
          data-tooltip="Закрыть"
        >
          ×
        </button>
      </div>
      <div
        className={`employee-card-panel-body reference-book-card-body${panelBodyEditClass}`}
      >
        <div
          className="employee-card-tabs employee-card-tabs-report-style"
          role="tablist"
          aria-label="Вкладки карточки справочника"
        >
          <button
            type="button"
            role="tab"
            id="reference-book-tab-main"
            aria-selected={cardTab === REFERENCE_BOOK_CARD_TAB_MAIN}
            aria-controls="reference-book-tabpanel-main"
            className={`employee-card-tab${cardTab === REFERENCE_BOOK_CARD_TAB_MAIN ? " active" : ""}`}
            onClick={handleTabMain}
          >
            <IconSliders aria-hidden />
            <span>Основные параметры</span>
          </button>
          {!isNewRecord ? (
            <button
              type="button"
              role="tab"
              id="reference-book-tab-structure"
              aria-selected={cardTab === REFERENCE_BOOK_CARD_TAB_STRUCTURE}
              aria-controls="reference-book-tabpanel-structure"
              className={`employee-card-tab${cardTab === REFERENCE_BOOK_CARD_TAB_STRUCTURE ? " active" : ""}`}
              onClick={handleTabStructure}
            >
              <IconFileJson aria-hidden />
              <span>Структура справочника</span>
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            id="reference-book-tab-rules"
            aria-selected={cardTab === REFERENCE_BOOK_CARD_TAB_RULES}
            aria-controls="reference-book-tabpanel-rules"
            className={`employee-card-tab${cardTab === REFERENCE_BOOK_CARD_TAB_RULES ? " active" : ""}`}
            onClick={handleTabRules}
          >
            <IconListBulleted aria-hidden />
            <span>Правила</span>
          </button>
        </div>

        {cardTab === REFERENCE_BOOK_CARD_TAB_MAIN ? (
          <div className="reference-book-toolbar-above-section">
            <div className="reference-book-main-toolbar">
              {isEditMode ? (
                <>
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={() => void onSaveMain?.()}
                    disabled={isSaving}
                  >
                    <IconCheck aria-hidden />
                    <span>{isSaving ? "Сохранение..." : "Сохранить"}</span>
                  </button>
                  <button type="button" className="panel-action-button" onClick={onCancelEdit} disabled={isSaving}>
                    <IconClose aria-hidden />
                    <span>Отменить</span>
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="panel-action-button" onClick={onStartEdit}>
                    <IconPencil aria-hidden />
                    <span>Изменить</span>
                  </button>
                  {!isNewRecord && item?.id && typeof onDeleteReferenceBook === "function" ? (
                    <button
                      type="button"
                      className="panel-action-button"
                      onClick={() => void onDeleteReferenceBook()}
                      disabled={isSaving}
                      aria-label="Удалить справочник"
                      data-tooltip="Удалить справочник"
                    >
                      <IconTrash aria-hidden />
                      <span>Удалить</span>
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}

        {cardTab === REFERENCE_BOOK_CARD_TAB_MAIN ? (
          <div
            className="reference-book-setup-tab-pane"
            id="reference-book-tabpanel-main"
            role="tabpanel"
            aria-labelledby="reference-book-tab-main"
          >
            <section className="employee-card-section reference-book-section-main">
              <h3>Основные параметры</h3>
              <div className="employee-card-params">
                <div className="employee-card-params-row reference-book-main-row-2cols">
                  <div className="employee-card-param">
                    <span className="employee-card-field-label">Код</span>
                    {isEditMode ? (
                      <input
                        className="employee-card-field-input"
                        value={draft.code}
                        onChange={(e) => onChangeDraft({ code: e.target.value })}
                      />
                    ) : (
                      <span className="employee-card-field-value employee-card-field-value-block">
                        {draft.code || "—"}
                      </span>
                    )}
                  </div>
                  <div className="employee-card-param">
                    <span className="employee-card-field-label">Название</span>
                    {isEditMode ? (
                      <input
                        className="employee-card-field-input"
                        value={draft.name}
                        onChange={(e) => onChangeDraft({ name: e.target.value })}
                      />
                    ) : (
                      <span className="employee-card-field-value employee-card-field-value-block">
                        {draft.name || "—"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="employee-card-params-row reference-book-main-row-2cols">
                  <div className="employee-card-param">
                    <span className="employee-card-field-label">Имя таблицы справочника</span>
                    {isEditMode ? (
                      <ReferenceBookLinkTableCombobox
                        value={draft.tableName ?? ""}
                        disabled={isSaving}
                        onChange={(v) =>
                          onChangeDraft({
                            tableName: v,
                            referenceUrl: referenceUrlSuffixFromTableName(v)
                          })
                        }
                        tables={dbTablesList}
                        loading={dbTablesLoading}
                        onEnsureTablesLoaded={handleEnsureDbTablesLoaded}
                        placeholder="схема.таблица или таблица"
                        inputVariant="cardField"
                      />
                    ) : (
                      <span className="employee-card-field-value employee-card-field-value-block">
                        {draft.tableName || "—"}
                      </span>
                    )}
                  </div>
                  <div className="employee-card-param reference-book-param-reference-url">
                    <span className="employee-card-field-label">Суффикс URL</span>
                    {isEditMode ? (
                      <input
                        className="employee-card-field-input reference-book-reference-url-readonly"
                        readOnly
                        data-tooltip="Формируется автоматически из имени таблицы: схема_таблица"
                        value={draft.referenceUrl}
                      />
                    ) : (
                      <span className="employee-card-field-value employee-card-field-value-block">
                        {draft.referenceUrl || "—"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="employee-card-params-row reference-book-main-row-3cols">
                  <div className="employee-card-param">
                    <span className="employee-card-field-label">Процедура обработки</span>
                    {isEditMode ? (
                      <>
                        <input
                          className="employee-card-field-input"
                          value={draft.procedureCode}
                          onChange={(e) => onChangeDraft({ procedureCode: e.target.value })}
                        />
                        <div className="reference-book-procedure-code-hint">
                          Пусто — стандартный просмотр данных в админке. Непустое значение — имя процедуры для отдельной
                          реализации; стандартный режим тогда недоступен.
                        </div>
                      </>
                    ) : (
                      <span className="employee-card-field-value employee-card-field-value-block">
                        {draft.procedureCode || "—"}
                      </span>
                    )}
                  </div>
                  <div className="employee-card-param">
                    <span className="employee-card-field-label">Добавление записей</span>
                    {isEditMode ? (
                      <select
                        className="employee-card-field-input employee-card-field-select"
                        value={draft.addRecords ? "true" : "false"}
                        onChange={(e) => onChangeDraft({ addRecords: e.target.value === "true" })}
                      >
                        <option value="true">ДА</option>
                        <option value="false">НЕТ</option>
                      </select>
                    ) : (
                      <span className="employee-card-field-value employee-card-field-value-block">
                        {draft.addRecords ? "ДА" : "НЕТ"}
                      </span>
                    )}
                  </div>
                  <div className="employee-card-param">
                    <span className="employee-card-field-label">Изменение записей</span>
                    {isEditMode ? (
                      <select
                        className="employee-card-field-input employee-card-field-select"
                        value={draft.editRecords ? "true" : "false"}
                        onChange={(e) => onChangeDraft({ editRecords: e.target.value === "true" })}
                      >
                        <option value="true">ДА</option>
                        <option value="false">НЕТ</option>
                      </select>
                    ) : (
                      <span className="employee-card-field-value employee-card-field-value-block">
                        {draft.editRecords ? "ДА" : "НЕТ"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {cardTab === REFERENCE_BOOK_CARD_TAB_STRUCTURE && !isNewRecord ? (
          <div
            className="reference-book-structure-tab-pane"
            id="reference-book-tabpanel-structure"
            role="tabpanel"
            aria-labelledby="reference-book-tab-structure"
          >
            {structurePaneMode === REFERENCE_BOOK_STRUCTURE_PANE_FIELDS ? (
              <>
                <div className="reference-book-structure-fields-toolbar">
                  <div className="reference-book-structure-fields-toolbar-left">
                    {structureFieldsEditMode ? (
                      <>
                        <button
                          type="button"
                          className="panel-action-button"
                          onClick={() => void handleSaveStructureFields()}
                          disabled={isSaving}
                        >
                          <IconCheck aria-hidden />
                          <span>{isSaving ? "Сохранение..." : "Сохранить"}</span>
                        </button>
                        <button
                          type="button"
                          className="panel-action-button"
                          onClick={handleCancelStructureFields}
                          disabled={isSaving}
                        >
                          <IconClose aria-hidden />
                          <span>Отменить</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="panel-action-button"
                          onClick={() => setStructureFieldsEditMode(true)}
                          disabled={isSaving}
                        >
                          <IconPencil aria-hidden />
                          <span>Изменить</span>
                        </button>
                        <button
                          type="button"
                          className="panel-action-button"
                          onClick={handleOpenStructureJsonPane}
                          disabled={isSaving}
                        >
                          <IconFileJson aria-hidden />
                          <span>Просмотр json</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <section className="employee-card-section reference-book-section-fields reference-book-structure-fields-main">
                  <div className="employee-card-subordination-header reference-book-fields-section-header">
                    <h3>Параметры полей</h3>
                    <div className="employee-card-relations-header-actions reference-book-fields-header-actions-slot">
                      {structureFieldsEditMode ? (
                        <button type="button" className="panel-action-button" onClick={onAddField}>
                          <IconPlus aria-hidden />
                          <span>Добавить поле</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {renderFieldsTable(structureFieldsEditMode)}
                </section>

                <div className="reference-book-structure-bottom-row">
                <section className="employee-card-section reference-book-section-fields reference-book-structure-extra-block reference-book-structure-extra-col">
                  <div className="employee-card-subordination-header reference-book-fields-section-header">
                    <h3>Связанные таблицы</h3>
                    <div className="employee-card-relations-header-actions reference-book-fields-header-actions-slot">
                      {structureFieldsEditMode ? (
                        <button
                          type="button"
                          className="panel-action-button"
                          onClick={() => onAddLinkTableRow?.()}
                          disabled={isSaving}
                        >
                          <IconPlus aria-hidden />
                          <span>Добавить</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="reference-book-simple-table-wrap">
                    <table
                      className={`employee-card-positions-table reference-book-simple-table${
                        structureFieldsEditMode ? " reference-book-simple-table--relations-style" : ""
                      }`}
                    >
                      <thead>
                        <tr>
                          <th>Таблица</th>
                          <th className="reference-book-simple-table-actions-col" aria-label="Действия" />
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(draft?.linkTables) ? draft.linkTables : []).length === 0 ? (
                          <tr>
                            <td colSpan={2} className="reference-book-fields-empty-cell">
                              Нет записей
                            </td>
                          </tr>
                        ) : (
                          (Array.isArray(draft?.linkTables) ? draft.linkTables : []).map((row, idx) => (
                            <tr key={`rb-link-${idx}`}>
                              <td>
                                {structureFieldsEditMode ? (
                                  <ReferenceBookLinkTableCombobox
                                    value={row.linkTableName ?? ""}
                                    disabled={isSaving}
                                    onChange={(v) => onChangeLinkTableName?.(idx, v)}
                                    tables={dbTablesList}
                                    loading={dbTablesLoading}
                                    onEnsureTablesLoaded={handleEnsureDbTablesLoaded}
                                  />
                                ) : (
                                  <TableReadonlyValue>{row.linkTableName || "—"}</TableReadonlyValue>
                                )}
                              </td>
                              <td className="reference-book-simple-table-actions-cell">
                                <button
                                  type="button"
                                  className="employee-card-position-action-button"
                                  data-tooltip={structureFieldsEditMode ? "Удалить" : "Доступно в режиме «Изменить»"}
                                  aria-label="Удалить строку"
                                  disabled={!structureFieldsEditMode || isSaving}
                                  onClick={() => {
                                    if (structureFieldsEditMode) {
                                      onRemoveLinkTableRow?.(idx);
                                    }
                                  }}
                                >
                                  <IconTrash aria-hidden />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="employee-card-section reference-book-section-fields reference-book-structure-extra-block reference-book-structure-extra-col">
                  <div className="employee-card-subordination-header reference-book-fields-section-header">
                    <h3>Синонимы ключевого поля</h3>
                    <div className="employee-card-relations-header-actions reference-book-fields-header-actions-slot">
                      {structureFieldsEditMode ? (
                        <button
                          type="button"
                          className="panel-action-button"
                          onClick={() => onAddSynonymRow?.()}
                          disabled={isSaving}
                        >
                          <IconPlus aria-hidden />
                          <span>Добавить</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="reference-book-simple-table-wrap">
                    <table
                      className={`employee-card-positions-table reference-book-simple-table${
                        structureFieldsEditMode ? " reference-book-simple-table--relations-style" : ""
                      }`}
                    >
                      <thead>
                        <tr>
                          <th>Синоним</th>
                          <th className="reference-book-simple-table-actions-col" aria-label="Действия" />
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(draft?.synonymKeyFields) ? draft.synonymKeyFields : []).length === 0 ? (
                          <tr>
                            <td colSpan={2} className="reference-book-fields-empty-cell">
                              Нет записей
                            </td>
                          </tr>
                        ) : (
                          (Array.isArray(draft?.synonymKeyFields) ? draft.synonymKeyFields : []).map((row, idx) => (
                            <tr key={`rb-syn-${idx}`}>
                              <td>
                                {structureFieldsEditMode ? (
                                  <RelationsFilterTextField
                                    value={row.synonymKeyField ?? ""}
                                    onChange={(v) => onChangeSynonymKeyField?.(idx, v)}
                                    placeholder="латиница, цифры, _"
                                    spellCheck={false}
                                  />
                                ) : (
                                  <TableReadonlyValue>{row.synonymKeyField || "—"}</TableReadonlyValue>
                                )}
                              </td>
                              <td className="reference-book-simple-table-actions-cell">
                                <button
                                  type="button"
                                  className="employee-card-position-action-button"
                                  data-tooltip={structureFieldsEditMode ? "Удалить" : "Доступно в режиме «Изменить»"}
                                  aria-label="Удалить строку"
                                  disabled={!structureFieldsEditMode || isSaving}
                                  onClick={() => {
                                    if (structureFieldsEditMode) {
                                      onRemoveSynonymRow?.(idx);
                                    }
                                  }}
                                >
                                  <IconTrash aria-hidden />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
                </div>

              </>
            ) : (
              <div className="reference-book-json-tab-pane reference-book-json-tab-pane--stretch">
                {jsonEditMode ? (
                  <div className="reference-book-structure-toolbar">
                    <div className="reference-book-structure-toolbar-left">
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={() => void handleSaveJsonEditor()}
                        disabled={isSaving}
                      >
                        <IconCheck aria-hidden />
                        <span>{isSaving ? "Сохранение..." : "Сохранить"}</span>
                      </button>
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleCancelJsonEdit}
                        disabled={isSaving}
                      >
                        <IconClose aria-hidden />
                        <span>Отменить</span>
                      </button>
                    </div>
                    <div className="reference-book-json-zoom-buttons" aria-label="Масштаб текста JSON">
                      <button
                        type="button"
                        className="panel-action-button report-card-sql-zoom-button"
                        onClick={handleReferenceBookJsonZoomDecrease}
                        aria-label="Отдалить текст JSON"
                        data-tooltip="Отдалить"
                        disabled={referenceBookJsonZoom <= 0.7}
                      >
                        <IconMinus aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="panel-action-button report-card-sql-zoom-button"
                        onClick={handleReferenceBookJsonZoomIncrease}
                        aria-label="Приблизить текст JSON"
                        data-tooltip="Приблизить"
                        disabled={referenceBookJsonZoom >= 1.6}
                      >
                        <IconPlus aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="reference-book-structure-toolbar">
                    <div className="reference-book-structure-toolbar-left">
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleBackToStructureFields}
                        disabled={isSaving}
                      >
                        <IconSliders aria-hidden />
                        <span>Настройка полей</span>
                      </button>
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleDownloadReferenceBookJson}
                        disabled={isSaving}
                      >
                        <IconDownload aria-hidden />
                        <span>Выгрузить json</span>
                      </button>
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleReferenceBookUploadJsonClick}
                        disabled={isSaving || typeof onReferenceBookJsonFileChange !== "function"}
                      >
                        <IconUpload aria-hidden />
                        <span>Загрузить json</span>
                      </button>
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleToggleJsonEdit}
                        disabled={isSaving}
                      >
                        <IconPencil aria-hidden />
                        <span>Изменить</span>
                      </button>
                    </div>
                    <div className="reference-book-json-zoom-buttons" aria-label="Масштаб текста JSON">
                      <button
                        type="button"
                        className="panel-action-button report-card-sql-zoom-button"
                        onClick={handleReferenceBookJsonZoomDecrease}
                        aria-label="Отдалить текст JSON"
                        data-tooltip="Отдалить"
                        disabled={referenceBookJsonZoom <= 0.7}
                      >
                        <IconMinus aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="panel-action-button report-card-sql-zoom-button"
                        onClick={handleReferenceBookJsonZoomIncrease}
                        aria-label="Приблизить текст JSON"
                        data-tooltip="Приблизить"
                        disabled={referenceBookJsonZoom >= 1.6}
                      >
                        <IconPlus aria-hidden />
                      </button>
                    </div>
                  </div>
                )}

                <input
                  ref={referenceBookJsonFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={onReferenceBookJsonFileChange}
                />

                <Suspense
                  fallback={
                    <div
                      className="report-template-json-panel"
                      aria-busy="true"
                      aria-label="Загрузка редактора JSON"
                    >
                      Загрузка редактора…
                    </div>
                  }
                >
                  <ReportTemplateJsonEditorPanel
                    ref={reportTemplateJsonEditorPanelRef}
                    committedText={committedJsonText}
                    isEditing={jsonEditMode}
                    zoom={referenceBookJsonZoom}
                  />
                </Suspense>
              </div>
            )}
          </div>
        ) : null}

        {cardTab === REFERENCE_BOOK_CARD_TAB_RULES ? (
          <div
            className="reference-book-rules-tab-pane reference-book-structure-tab-pane reference-book-setup-tab-pane"
            id="reference-book-tabpanel-rules"
            role="tabpanel"
            aria-labelledby="reference-book-tab-rules"
          >
            {rulesPaneMode === REFERENCE_BOOK_RULES_PANE_FIELDS ? (
              <>
                <div className="reference-book-structure-fields-toolbar">
                  <div className="reference-book-structure-fields-toolbar-left">
                    {!isNewRecord ? (
                      rulesEditMode ? (
                        <>
                          <button
                            type="button"
                            className="panel-action-button"
                            onClick={() => void handleSaveRulesClick()}
                            disabled={isSaving}
                          >
                            <IconCheck aria-hidden />
                            <span>{isSaving ? "Сохранение..." : "Сохранить"}</span>
                          </button>
                          <button
                            type="button"
                            className="panel-action-button"
                            onClick={handleCancelRulesEdit}
                            disabled={isSaving}
                          >
                            <IconClose aria-hidden />
                            <span>Отменить</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="panel-action-button"
                            onClick={() => setRulesEditMode(true)}
                            disabled={isSaving}
                          >
                            <IconPencil aria-hidden />
                            <span>Изменить</span>
                          </button>
                          <button
                            type="button"
                            className="panel-action-button"
                            onClick={handleOpenRulesJsonPane}
                            disabled={isSaving}
                          >
                            <IconFileJson aria-hidden />
                            <span>Просмотр json</span>
                          </button>
                        </>
                      )
                    ) : (
                      <p className="reference-book-rules-new-record-hint">
                        Укажите таблицу на вкладке «Основные параметры». Правила сохраняются при создании справочника
                        (кнопка «Сохранить» там же).
                      </p>
                    )}
                  </div>
                </div>

                <div className="reference-book-rules-fields-scroll">
                  <section className="employee-card-section reference-book-section-rules">
                    {(Array.isArray(draft?.rules) ? draft.rules : []).length === 0 ? (
                      <div className="reference-book-fields-empty-cell reference-book-rules-empty">Нет правил</div>
                    ) : null}

                    {(Array.isArray(draft?.rules) ? draft.rules : []).map((rule, ruleIndex) => {
                      const fieldRows = Array.isArray(rule?.fields) ? rule.fields : [];
                      const ruleKey = rule?.ruleClientKey ?? `rule-${ruleIndex}`;
                      return (
                        <div key={ruleKey} className="reference-book-rules-rule-card">
                          <div className="employee-card-subordination-header reference-book-fields-section-header reference-book-rules-rule-header">
                            <h3>Правило {ruleIndex + 1}</h3>
                            <div className="employee-card-relations-header-actions reference-book-fields-header-actions-slot">
                              {rulesEditable ? (
                                <button
                                  type="button"
                                  className="panel-action-button"
                                  onClick={() => onRemoveRule?.(ruleIndex)}
                                  disabled={isSaving}
                                  data-tooltip="Удалить правило"
                                >
                                  <IconTrash aria-hidden />
                                  <span>Удалить правило</span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <div className="employee-card-params reference-book-rules-rule-params">
                            <div className="employee-card-param">
                              <span className="employee-card-field-label">Тип правила</span>
                              {rulesEditable ? (
                                <select
                                  className="employee-card-field-input employee-card-field-select"
                                  value={rule?.rule === "uniqueness" ? "uniqueness" : "presence"}
                                  onChange={(e) => onChangeRuleType?.(ruleIndex, e.target.value)}
                                  disabled={isSaving}
                                >
                                  <option value="presence">Наличие значения (presence)</option>
                                  <option value="uniqueness">Уникальность (uniqueness)</option>
                                </select>
                              ) : (
                                <span className="employee-card-field-value employee-card-field-value-block">
                                  {rule?.rule === "uniqueness"
                                    ? "Уникальность (uniqueness)"
                                    : "Наличие значения (presence)"}
                                </span>
                              )}
                            </div>
                            <div className="reference-book-rules-fields-caption">Столбцы таблицы (tableName)</div>
                            {fieldRows.map((f, fieldIndex) => (
                              <div key={`${ruleKey}-f-${fieldIndex}`} className="employee-card-param">
                                <span className="employee-card-field-label">Столбец</span>
                                {rulesEditable ? (
                                  <div className="reference-book-rules-param-row">
                                    <ReferenceBookDbColumnCombobox
                                      value={f?.tableName ?? ""}
                                      disabled={isSaving || !String(draft?.tableName ?? "").trim()}
                                      onChange={(v) => onChangeRuleFieldTableName?.(ruleIndex, fieldIndex, v)}
                                      tableName={draft?.tableName ?? ""}
                                      columnsApiUrl={referenceBooksDbTableColumnsApiUrl}
                                      showSystemErrorToast={toast}
                                      placeholder="столбец"
                                      listAriaLabel={`Столбцы для правила ${ruleIndex + 1}`}
                                      inputVariant="cardField"
                                    />
                                    <button
                                      type="button"
                                      className="employee-card-position-action-button reference-book-rules-remove-field-btn"
                                      data-tooltip={
                                        fieldRows.length <= 2
                                          ? "В правиле должно быть не менее двух столбцов"
                                          : "Удалить столбец"
                                      }
                                      aria-label="Удалить столбец"
                                      disabled={!rulesEditable || isSaving || fieldRows.length <= 2}
                                      onClick={() => {
                                        if (fieldRows.length > 2) {
                                          onRemoveRuleField?.(ruleIndex, fieldIndex);
                                        }
                                      }}
                                    >
                                      <IconMinus aria-hidden />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {String(f?.tableName ?? "").trim() || "—"}
                                  </span>
                                )}
                              </div>
                            ))}
                            {rulesEditable ? (
                              <div className="reference-book-rules-add-field-wrap">
                                <button
                                  type="button"
                                  className="panel-action-button"
                                  onClick={() => onAddRuleField?.(ruleIndex)}
                                  disabled={isSaving || !String(draft?.tableName ?? "").trim()}
                                >
                                  <IconPlus aria-hidden />
                                  <span>Добавить столбец</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}

                    {rulesEditable ? (
                      <div className="reference-book-rules-add-rule-wrap">
                        <button type="button" className="panel-action-button" onClick={() => onAddRule?.()} disabled={isSaving}>
                          <IconPlus aria-hidden />
                          <span>Добавить правило</span>
                        </button>
                      </div>
                    ) : null}
                  </section>
                </div>
              </>
            ) : (
              <div className="reference-book-json-tab-pane reference-book-json-tab-pane--stretch">
                {rulesJsonEditMode ? (
                  <div className="reference-book-structure-toolbar">
                    <div className="reference-book-structure-toolbar-left">
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={() => void handleSaveRulesJsonEditor()}
                        disabled={isSaving}
                      >
                        <IconCheck aria-hidden />
                        <span>{isSaving ? "Сохранение..." : "Сохранить"}</span>
                      </button>
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleCancelRulesJsonEdit}
                        disabled={isSaving}
                      >
                        <IconClose aria-hidden />
                        <span>Отменить</span>
                      </button>
                    </div>
                    <div className="reference-book-json-zoom-buttons" aria-label="Масштаб текста JSON">
                      <button
                        type="button"
                        className="panel-action-button report-card-sql-zoom-button"
                        onClick={handleReferenceBookJsonZoomDecrease}
                        aria-label="Отдалить текст JSON"
                        data-tooltip="Отдалить"
                        disabled={referenceBookJsonZoom <= 0.7}
                      >
                        <IconMinus aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="panel-action-button report-card-sql-zoom-button"
                        onClick={handleReferenceBookJsonZoomIncrease}
                        aria-label="Приблизить текст JSON"
                        data-tooltip="Приблизить"
                        disabled={referenceBookJsonZoom >= 1.6}
                      >
                        <IconPlus aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="reference-book-structure-toolbar">
                    <div className="reference-book-structure-toolbar-left">
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleBackToRulesFields}
                        disabled={isSaving}
                      >
                        <IconListBulleted aria-hidden />
                        <span>Настройка правил</span>
                      </button>
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleDownloadRulesJson}
                        disabled={isSaving}
                      >
                        <IconDownload aria-hidden />
                        <span>Выгрузить json</span>
                      </button>
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleReferenceBookRulesJsonUploadClick}
                        disabled={isSaving || typeof onReferenceBookRulesJsonFileChange !== "function"}
                      >
                        <IconUpload aria-hidden />
                        <span>Загрузить json</span>
                      </button>
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleToggleRulesJsonEdit}
                        disabled={isSaving}
                      >
                        <IconPencil aria-hidden />
                        <span>Изменить</span>
                      </button>
                    </div>
                    <div className="reference-book-json-zoom-buttons" aria-label="Масштаб текста JSON">
                      <button
                        type="button"
                        className="panel-action-button report-card-sql-zoom-button"
                        onClick={handleReferenceBookJsonZoomDecrease}
                        aria-label="Отдалить текст JSON"
                        data-tooltip="Отдалить"
                        disabled={referenceBookJsonZoom <= 0.7}
                      >
                        <IconMinus aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="panel-action-button report-card-sql-zoom-button"
                        onClick={handleReferenceBookJsonZoomIncrease}
                        aria-label="Приблизить текст JSON"
                        data-tooltip="Приблизить"
                        disabled={referenceBookJsonZoom >= 1.6}
                      >
                        <IconPlus aria-hidden />
                      </button>
                    </div>
                  </div>
                )}

                <input
                  ref={referenceBookRulesJsonFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={onReferenceBookRulesJsonFileChange}
                />

                <Suspense
                  fallback={
                    <div
                      className="report-template-json-panel"
                      aria-busy="true"
                      aria-label="Загрузка редактора JSON"
                    >
                      Загрузка редактора…
                    </div>
                  }
                >
                  <ReportTemplateJsonEditorPanel
                    ref={reportTemplateJsonEditorPanelRef}
                    committedText={rulesCommittedJsonText}
                    isEditing={rulesJsonEditMode}
                    zoom={referenceBookJsonZoom}
                  />
                </Suspense>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default memo(ReferenceBookCardPanel);
