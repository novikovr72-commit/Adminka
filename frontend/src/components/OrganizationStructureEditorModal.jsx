import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { IconCheck, IconClose } from "./AppIcons";

/**
 * Локальный state полей — без обновления корневого App при каждом вводе (иначе лаги).
 * Сброс значений при открытии через key на стороне родителя.
 */
export default function OrganizationStructureEditorModal({
  mode,
  initialName,
  initialCode,
  initialKcehNumber,
  initialParentOrganUnitId,
  parentOptions,
  saving,
  onClose,
  onSave
}) {
  const [name, setName] = useState(() => String(initialName ?? ""));
  const [code, setCode] = useState(() => String(initialCode ?? ""));
  const [kcehNumber, setKcehNumber] = useState(() => String(initialKcehNumber ?? ""));

  const resolvedInitialParent = useMemo(() => {
    const init = String(initialParentOrganUnitId ?? "").trim();
    const opts = Array.isArray(parentOptions) ? parentOptions : [];
    if (init && opts.some((o) => o.value === init)) {
      return init;
    }
    return opts[0]?.value ?? "";
  }, [initialParentOrganUnitId, parentOptions]);

  const [parentOrganUnitId, setParentOrganUnitId] = useState(resolvedInitialParent);
  const [parentMenuOpen, setParentMenuOpen] = useState(false);
  const parentComboboxRef = useRef(null);
  const parentListId = useId();

  const handleSubmit = useCallback(() => {
    void onSave({ name, code, kcehNumber, parentOrganUnitId });
  }, [name, code, kcehNumber, parentOrganUnitId, onSave]);

  const title =
    mode === "add" ? "Новое подразделение" : "Редактирование подразделения";
  const ariaLabel = mode === "add" ? "Новое подразделение" : "Редактирование подразделения";

  const opts = Array.isArray(parentOptions) ? parentOptions : [];
  const selectedParentLabel =
    opts.find((o) => o.value === parentOrganUnitId)?.label ?? "—";

  useEffect(() => {
    if (!parentMenuOpen) {
      return;
    }
    const onPointerDown = (event) => {
      const el = parentComboboxRef.current;
      if (el && !el.contains(event.target)) {
        setParentMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setParentMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [parentMenuOpen]);

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal organization-structure-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <h3 className="organization-structure-editor-modal-title">{title}</h3>
        <div className="organization-structure-editor-modal-fields">
          <div className="organization-structure-editor-field">
            <span className="employee-card-field-label" id={`${parentListId}-label`}>
              Родительская структура *
            </span>
            <div
              ref={parentComboboxRef}
              className="organization-structure-parent-combobox"
            >
              <button
                type="button"
                className="organization-structure-parent-combobox-trigger"
                disabled={saving || opts.length === 0}
                aria-haspopup="listbox"
                aria-expanded={parentMenuOpen}
                aria-controls={parentListId}
                aria-labelledby={`${parentListId}-label`}
                onClick={() => {
                  if (!saving && opts.length > 0) {
                    setParentMenuOpen((open) => !open);
                  }
                }}
              >
                <span className="organization-structure-parent-combobox-trigger-text">
                  {opts.length === 0 ? "Нет доступных вариантов" : selectedParentLabel}
                </span>
                <span className="organization-structure-parent-combobox-chevron" aria-hidden>
                  ▼
                </span>
              </button>
              {parentMenuOpen && opts.length > 0 ? (
                <div
                  id={parentListId}
                  className="organization-structure-parent-combobox-panel"
                  role="listbox"
                  aria-label="Выбор родительской структуры"
                >
                  {opts.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={opt.value === parentOrganUnitId}
                      className={`organization-structure-parent-combobox-option${
                        opt.value === parentOrganUnitId ? " is-selected" : ""
                      }`}
                      onClick={() => {
                        setParentOrganUnitId(opt.value);
                        setParentMenuOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <label className="organization-structure-editor-field">
            <span className="employee-card-field-label">Наименование *</span>
            <input
              type="text"
              className="employee-card-field-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              disabled={saving}
            />
          </label>
          <label className="organization-structure-editor-field">
            <span className="employee-card-field-label">Код подразделения</span>
            <input
              type="text"
              className="employee-card-field-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              disabled={saving}
            />
          </label>
          <label className="organization-structure-editor-field">
            <span className="employee-card-field-label">Номер цеха</span>
            <input
              type="text"
              className="employee-card-field-input"
              value={kcehNumber}
              onChange={(event) => setKcehNumber(event.target.value)}
              autoComplete="off"
              disabled={saving}
            />
          </label>
        </div>
        <div className="confirm-actions">
          <button
            type="button"
            className="modal-close-button"
            onClick={handleSubmit}
            disabled={saving || opts.length === 0}
          >
            <IconCheck aria-hidden />
            <span>{saving ? "Сохранение..." : "Сохранить"}</span>
          </button>
          <button
            type="button"
            className="modal-close-button secondary"
            onClick={onClose}
            disabled={saving}
          >
            <IconClose aria-hidden />
            <span>Отмена</span>
          </button>
        </div>
      </div>
    </div>
  );
}
