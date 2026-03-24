import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconClose, IconPencil, IconTrash } from "./AppIcons";
import ReferenceBookLinkFieldCombobox from "./ReferenceBookLinkFieldCombobox";
import {
  normalizeFieldLinkListTypeFromApi,
  normalizeFieldLinkShowFieldsFromApi,
  normalizeFieldLinkShowListsFromApi
} from "../referenceBookProperties";
import {
  buildFormStateFromRow,
  buildInitialFormState,
  buildReferenceRowValuesForLink,
  columnCaption,
  columnFieldKey,
  formFieldValuesEqual,
  hasFieldLinkMeta,
  parseFieldLinkFiltrReferencedFieldNames,
  readReferenceBookRowLinkRaw,
  resolveReferenceBookRecordRowId,
  serializeForApi
} from "../referenceBookRecordFormCore";

/**
 * Поле с кнопкой сброса (×). Обёртка всегда при allowClear — иначе при появлении первого символа менялась разметка и инпут ломал ввод.
 */
function RecordFieldWithClear({ allowClear, disabled, hasValue, onClear, children }) {
  if (!allowClear) {
    return children;
  }
  const showButton = hasValue && !disabled;
  return (
    <div className="column-filter-input-wrapper reference-book-record-field-clear-wrap">
      {children}
      {showButton ? (
        <button
          type="button"
          className="column-filter-clear-button"
          aria-label="Очистить поле"
          data-tooltip="Очистить"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function fieldHasTextualValue(val) {
  if (val === null || val === undefined) {
    return false;
  }
  return String(val).trim() !== "";
}

/**
 * Боковая панель записи справочника: просмотр по клику на строку, правка по кнопке; новая запись — отдельный поток.
 */
export default function ReferenceBookRecordFormPanel({
  isOpen,
  panelMode = "add",
  editRow = null,
  onClose,
  onRequestEdit,
  onAfterEditSave,
  onDeleteRecord,
  canEditRecords = true,
  formatFieldReadonlyValue,
  listApiUrl,
  referenceBookUrlSuffix,
  fields,
  onSaved,
  showSystemErrorToast,
  showSystemSuccessToast
}) {
  const [form, setForm] = useState(() => ({}));
  const [saving, setSaving] = useState(false);

  const orderedFields = useMemo(() => (Array.isArray(fields) ? fields : []), [fields]);
  /** Без смены набора имён полей форму не сбрасываем — иначе при новом [] fields каждый рендер теряется выбор в комбобоксах. */
  const fieldsStructureKey = useMemo(
    () => orderedFields.map((c) => columnFieldKey(c)).filter(Boolean).join("|"),
    [orderedFields]
  );
  const editRowId = editRow?.id ?? editRow?.Id;
  const loadLinkOptionsCacheRef = useRef(new Map());
  const formRef = useRef(form);
  formRef.current = form;
  const orderedFieldsRef = useRef(orderedFields);
  orderedFieldsRef.current = orderedFields;

  /** Подпись поля связи как в просмотре (Показ), чтобы в редактировании не мигал ключ и не подменялась строка из «Списка» link-options. */
  const linkFieldSnapshots = useMemo(() => {
    if (panelMode !== "edit" || editRow == null) {
      return new Map();
    }
    const m = new Map();
    for (const col of orderedFields) {
      if (!hasFieldLinkMeta(col)) {
        continue;
      }
      const k = columnFieldKey(col);
      const raw = readReferenceBookRowLinkRaw(editRow, k);
      if (raw == null || raw === "") {
        continue;
      }
      const showValue =
        typeof formatFieldReadonlyValue === "function"
          ? String(formatFieldReadonlyValue(col) ?? "").trim()
          : "";
      m.set(k, {
        linkValue: raw,
        showValue: showValue || String(raw)
      });
    }
    return m;
  }, [panelMode, editRow, orderedFields, formatFieldReadonlyValue]);

  /** Имя поля (lower) → поля связи, которые нужно очистить при изменении этого поля (плейсхолдеры в fieldLinkFiltr). */
  const linkFieldsToClearWhenRefColumnChanges = useMemo(() => {
    const m = new Map();
    for (const col of orderedFields) {
      if (!hasFieldLinkMeta(col)) {
        continue;
      }
      const fk = columnFieldKey(col);
      if (!fk) {
        continue;
      }
      const filtr = String(col.fieldLinkFiltr ?? col.field_link_filtr ?? "").trim();
      for (const refName of parseFieldLinkFiltrReferencedFieldNames(filtr)) {
        const nk = refName.toLowerCase();
        if (!m.has(nk)) {
          m.set(nk, new Set());
        }
        m.get(nk).add(fk);
      }
    }
    return m;
  }, [orderedFields]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (panelMode === "add") {
      setForm(buildInitialFormState(orderedFields));
    } else if ((panelMode === "view" || panelMode === "edit") && editRow != null) {
      setForm(buildFormStateFromRow(editRow, orderedFields));
    } else {
      setForm(buildInitialFormState(orderedFields));
    }
    loadLinkOptionsCacheRef.current = new Map();
  }, [isOpen, panelMode, editRowId, fieldsStructureKey]);

  const getLoadLinkOptions = useCallback(
    (col) => {
      const k = columnFieldKey(col);
      const cache = loadLinkOptionsCacheRef.current;
      if (cache.has(k)) {
        return cache.get(k);
      }
      const id = String(referenceBookUrlSuffix ?? "").trim();
      const loader = async ({ search = "", offset = 0 } = {}) => {
        if (!id) {
          return { items: [], hasMore: false };
        }
        try {
          const off = Math.max(0, Math.floor(Number(offset)) || 0);
          const searchTrim = String(search ?? "").trim();
          const payload = {
            fieldLinkTable: col.fieldLinkTable ?? col.field_link_table,
            fieldLinkField: col.fieldLinkField ?? col.field_link_field,
            fieldLinkShowFields: normalizeFieldLinkShowFieldsFromApi(col),
            fieldLinkShowLists: normalizeFieldLinkShowListsFromApi(col),
            limit: 100,
            offset: off,
            referenceRowValues: buildReferenceRowValuesForLink(formRef.current, orderedFieldsRef.current)
          };
          if (searchTrim) {
            payload.search = searchTrim;
          }
          const response = await fetch(`${listApiUrl}/${encodeURIComponent(id)}/link-options`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) {
            throw new Error(data.error || `Ошибка ${response.status}`);
          }
          const items = Array.isArray(data.items) ? data.items : [];
          return {
            items: items.map((row) => ({
              linkValue: row.linkValue ?? row.link_value,
              showValue: row.showValue ?? row.show_value
            })),
            hasMore: data.hasMore === true
          };
        } catch (e) {
          showSystemErrorToast?.(e instanceof Error ? e.message : "Ошибка загрузки");
          return { items: [], hasMore: false };
        }
      };
      cache.set(k, loader);
      return loader;
    },
    [listApiUrl, referenceBookUrlSuffix, showSystemErrorToast, orderedFields]
  );

  const setField = useCallback(
    (key, v) => {
      setForm((prev) => {
        const col = orderedFields.find((c) => columnFieldKey(c) === key);
        const oldVal = prev[key];
        const changed = col ? !formFieldValuesEqual(col, oldVal, v) : oldVal !== v;
        if (!changed) {
          return prev;
        }
        const next = { ...prev, [key]: v };
        const toClear = linkFieldsToClearWhenRefColumnChanges.get(String(key).toLowerCase());
        if (toClear && toClear.size > 0) {
          for (const tgtKey of toClear) {
            if (tgtKey === key) {
              continue;
            }
            const tgtCol = orderedFields.find((c) => columnFieldKey(c) === tgtKey);
            if (!tgtCol || !hasFieldLinkMeta(tgtCol)) {
              continue;
            }
            next[tgtKey] = "";
          }
        }
        return next;
      });
    },
    [orderedFields, linkFieldsToClearWhenRefColumnChanges]
  );

  const validateClient = useCallback(() => {
    for (const col of orderedFields) {
      const k = columnFieldKey(col);
      if (!k) {
        continue;
      }
      if (col.fieldRequired !== true) {
        continue;
      }
      const ft = String(col.fieldType ?? "varchar").toLowerCase();
      const raw = form[k];
      if (ft === "boolean") {
        /* boolean всегда задан */
        continue;
      }
      if (ft === "numeric") {
        if (raw === "" || raw === null || raw === undefined) {
          return `Заполните поле «${columnCaption(col) || k}»`;
        }
        continue;
      }
      if (hasFieldLinkMeta(col)) {
        if (raw === "" || raw === null || raw === undefined) {
          return `Заполните поле «${columnCaption(col) || k}»`;
        }
        continue;
      }
      if (raw === "" || raw === null || raw === undefined) {
        return `Заполните поле «${columnCaption(col) || k}»`;
      }
    }
    return "";
  }, [form, orderedFields]);

  const handleHeaderClose = () => {
    if (panelMode === "edit") {
      onClose?.({ revertToView: true });
      return;
    }
    onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (panelMode === "view") {
      return;
    }
    const id = String(referenceBookUrlSuffix ?? "").trim();
    if (!id) {
      return;
    }
    const err = validateClient();
    if (err) {
      showSystemErrorToast?.(err);
      return;
    }
    setSaving(true);
    try {
      const values = {};
      for (const col of orderedFields) {
        const k = columnFieldKey(col);
        if (!k) {
          continue;
        }
        if (col.fieldEdit === false) {
          continue;
        }
        values[k] = serializeForApi(col, form[k]);
      }
      const isEdit = panelMode === "edit";
      const recordId = isEdit ? resolveReferenceBookRecordRowId(editRow) : null;
      if (isEdit && (recordId === null || recordId === undefined || String(recordId).trim() === "")) {
        throw new Error("Не удалось определить id записи");
      }
      const response = await fetch(
        `${listApiUrl}/${encodeURIComponent(id)}/records/${isEdit ? "update" : "insert"}`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEdit ? { id: recordId, values } : { values })
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Ошибка ${response.status}`);
      }
      showSystemSuccessToast?.(data.message || (isEdit ? "Запись сохранена" : "Запись добавлена"));
      if (isEdit) {
        await Promise.resolve(onAfterEditSave?.());
      } else {
        await Promise.resolve(onSaved?.());
        onClose?.({ afterSave: true });
      }
    } catch (e) {
      showSystemErrorToast?.(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelForm = () => {
    if (panelMode === "edit") {
      onClose?.({ revertToView: true });
      return;
    }
    onClose?.();
  };

  const panelTitle =
    panelMode === "add" ? "Новая запись" : panelMode === "view" ? "Просмотр записи" : "Редактирование записи";

  const mainBodyClass =
    panelMode === "view"
      ? "employee-card-panel-body reference-book-card-body reference-book-record-panel-view"
      : "employee-card-panel-body reference-book-card-body employee-card-main-tab-content-edit-mode";

  return (
    <aside
      className={`employee-card-panel report-card-panel reference-book-record-form-panel${isOpen ? " open" : ""}`}
      aria-hidden={!isOpen}
    >
      <div className="employee-card-panel-header">
        <h2>{panelTitle}</h2>
        <button
          type="button"
          className="employee-card-close-button"
          onClick={handleHeaderClose}
          aria-label="Закрыть"
          data-tooltip="Закрыть"
        >
          ×
        </button>
      </div>
      <div className={mainBodyClass}>
        <form onSubmit={handleSubmit} className="reference-book-add-record-form">
          <div className="reference-book-toolbar-above-section">
            <div className="reference-book-main-toolbar reference-book-record-card-toolbar">
              {panelMode === "view" ? (
                <>
                  {canEditRecords ? (
                    <button
                      type="button"
                      className="panel-action-button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRequestEdit?.();
                      }}
                    >
                      <IconPencil aria-hidden />
                      <span>Изменить</span>
                    </button>
                  ) : null}
                  {canEditRecords ? (
                    <button
                      type="button"
                      className="panel-action-button"
                      onClick={() => editRow != null && onDeleteRecord?.(editRow)}
                    >
                      <IconTrash aria-hidden />
                      <span>Удалить</span>
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <button type="submit" className="panel-action-button" disabled={saving}>
                    <IconCheck aria-hidden />
                    <span>{saving ? "Сохранение..." : "Сохранить"}</span>
                  </button>
                  <button
                    type="button"
                    className="panel-action-button"
                    onClick={handleCancelForm}
                    disabled={saving}
                  >
                    <IconClose aria-hidden />
                    <span>Отменить</span>
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="reference-book-setup-tab-pane reference-book-add-record-setup">
            <section className="employee-card-section reference-book-section-main">
              <div className="employee-card-params reference-book-add-record-params">
                {orderedFields.map((col) => {
                  const k = columnFieldKey(col);
                  if (!k) {
                    return null;
                  }
                  const cap = columnCaption(col) || k;
                  const ft = String(col.fieldType ?? "varchar").toLowerCase();
                  const editable = col.fieldEdit !== false;
                  const fv = Array.isArray(col.fieldValues) ? col.fieldValues : [];
                  const hasLink = hasFieldLinkMeta(col);
                  const disabled = !editable || saving;
                  const val = form[k];
                  /** Кнопка «×» для всех редактируемых полей; обязательность проверяется при сохранении */
                  const allowFieldClear = true;

                  const label = (
                    <span className="employee-card-field-label">
                      {cap}
                      {col.fieldRequired === true ? (
                        <span style={{ color: "var(--error-text, #c62828)" }}> *</span>
                      ) : null}
                      {col.uniqueValue === true ? (
                        <span className="reference-book-add-record-hint"> (уникальное)</span>
                      ) : null}
                    </span>
                  );

                  if (panelMode === "view") {
                    const display =
                      typeof formatFieldReadonlyValue === "function"
                        ? String(formatFieldReadonlyValue(col) ?? "").trim() || "—"
                        : "—";
                    return (
                      <div key={k} className="employee-card-params-row reference-book-add-record-field-row">
                        <div className="employee-card-param">
                          {label}
                          <span className="employee-card-field-value employee-card-field-value-block">{display}</span>
                        </div>
                      </div>
                    );
                  }

                  if (!editable) {
                    let display = "";
                    if (ft === "boolean") {
                      display = val ? "Да" : "Нет";
                    } else {
                      display = val ? String(val) : "—";
                    }
                    return (
                      <div key={k} className="employee-card-params-row reference-book-add-record-field-row">
                        <div className="employee-card-param">
                          {label}
                          <span className="employee-card-field-value employee-card-field-value-block">{display}</span>
                        </div>
                      </div>
                    );
                  }

                  if (hasLink) {
                    return (
                      <div key={k} className="employee-card-params-row reference-book-add-record-field-row">
                        <div className="employee-card-param">
                          {label}
                          <ReferenceBookLinkFieldCombobox
                            value={val}
                            disabled={disabled}
                            onChange={(v) => setField(k, v)}
                            loadOptions={getLoadLinkOptions(col)}
                            linkListType={normalizeFieldLinkListTypeFromApi(col)}
                            initialLinkSnapshot={linkFieldSnapshots.get(k) ?? null}
                            placeholder="Выберите значение"
                            inputVariant="cardField"
                            allowClear
                          />
                        </div>
                      </div>
                    );
                  }

                  if (ft === "varchar" && fv.length > 0) {
                    const staticOptions = fv.map((row) => ({
                      linkValue: String(row.fieldValueString ?? ""),
                      showValue: String(row.fieldValueShow ?? row.fieldValueString ?? "")
                    }));
                    return (
                      <div key={k} className="employee-card-params-row reference-book-add-record-field-row">
                        <div className="employee-card-param">
                          {label}
                          <ReferenceBookLinkFieldCombobox
                            value={val === null || val === undefined ? "" : String(val)}
                            disabled={disabled}
                            onChange={(v) => setField(k, v == null ? "" : v)}
                            options={staticOptions}
                            linkListType="full"
                            placeholder={col.fieldRequired === true ? "Выберите значение" : "Выберите или оставьте пустым"}
                            inputVariant="cardField"
                            allowClear
                          />
                        </div>
                      </div>
                    );
                  }

                  if (ft === "boolean") {
                    return (
                      <div key={k} className="employee-card-params-row reference-book-add-record-field-row">
                        <div className="employee-card-param">
                          {label}
                          <RecordFieldWithClear
                            allowClear={allowFieldClear}
                            disabled={disabled}
                            /* И «Да», и «Нет» — выбранное значение; «×» сбрасывает в «Нет» (как и раньше по onClear). */
                            hasValue
                            onClear={() => setField(k, false)}
                          >
                            <select
                              className="employee-card-field-input employee-card-field-select"
                              disabled={disabled}
                              value={val === true ? "true" : "false"}
                              onChange={(e) => setField(k, e.target.value === "true")}
                            >
                              <option value="false">Нет</option>
                              <option value="true">Да</option>
                            </select>
                          </RecordFieldWithClear>
                        </div>
                      </div>
                    );
                  }

                  if (ft === "numeric") {
                    return (
                      <div key={k} className="employee-card-params-row reference-book-add-record-field-row">
                        <div className="employee-card-param">
                          {label}
                          <RecordFieldWithClear
                            allowClear={allowFieldClear}
                            disabled={disabled}
                            hasValue={fieldHasTextualValue(val)}
                            onClear={() => setField(k, "")}
                          >
                            <input
                              type="text"
                              inputMode="decimal"
                              className="employee-card-field-input"
                              disabled={disabled}
                              value={val === null || val === undefined ? "" : String(val)}
                              onChange={(e) => setField(k, e.target.value)}
                            />
                          </RecordFieldWithClear>
                        </div>
                      </div>
                    );
                  }

                  if (ft === "date") {
                    return (
                      <div key={k} className="employee-card-params-row reference-book-add-record-field-row">
                        <div className="employee-card-param">
                          {label}
                          <RecordFieldWithClear
                            allowClear={allowFieldClear}
                            disabled={disabled}
                            hasValue={Boolean(val && String(val).trim())}
                            onClear={() => setField(k, "")}
                          >
                            <input
                              type="date"
                              className="employee-card-field-input"
                              disabled={disabled}
                              value={val ? String(val).slice(0, 10) : ""}
                              onChange={(e) => setField(k, e.target.value)}
                            />
                          </RecordFieldWithClear>
                        </div>
                      </div>
                    );
                  }

                  if (ft === "datetime") {
                    return (
                      <div key={k} className="employee-card-params-row reference-book-add-record-field-row">
                        <div className="employee-card-param">
                          {label}
                          <RecordFieldWithClear
                            allowClear={allowFieldClear}
                            disabled={disabled}
                            hasValue={Boolean(val && String(val).trim())}
                            onClear={() => setField(k, "")}
                          >
                            <input
                              type="datetime-local"
                              className="employee-card-field-input"
                              disabled={disabled}
                              value={val ? String(val).slice(0, 16) : ""}
                              onChange={(e) => setField(k, e.target.value)}
                            />
                          </RecordFieldWithClear>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={k} className="employee-card-params-row reference-book-add-record-field-row">
                      <div className="employee-card-param">
                        {label}
                        <RecordFieldWithClear
                          allowClear={allowFieldClear}
                          disabled={disabled}
                          hasValue={fieldHasTextualValue(val)}
                          onClear={() => setField(k, "")}
                        >
                          <input
                            type="text"
                            className="employee-card-field-input"
                            disabled={disabled}
                            value={val === null || val === undefined ? "" : String(val)}
                            onChange={(e) => setField(k, e.target.value)}
                          />
                        </RecordFieldWithClear>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </form>
      </div>
    </aside>
  );
}
