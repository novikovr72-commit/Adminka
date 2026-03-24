import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconClose, IconRefresh } from "./AppIcons";

export default function TableColumnSettingsPanel({
  isOpen,
  title = "Настройка столбцов",
  bounds,
  isDarkTheme = false,
  columns,
  settings,
  onApply,
  onClose,
  onReset
}) {
  const [draft, setDraft] = useState(settings);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft(settings.map((item) => ({ ...item })));
    setSearch("");
  }, [isOpen, settings]);

  const filteredDraft = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return draft;
    }

    return draft.filter((item) => {
      const column = columns.find((entry) => entry.key === item.key);
      const text = `${column?.title ?? item.key} ${item.key}`.toLowerCase();
      return text.includes(needle);
    });
  }, [columns, draft, search]);

  const moveDraftColumn = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) {
      return;
    }

    setDraft((prev) => {
      const next = [...prev];
      const fromIndex = next.findIndex((item) => item.key === fromKey);
      const toIndex = next.findIndex((item) => item.key === toKey);
      if (fromIndex === -1 || toIndex === -1) {
        return prev;
      }

      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const toggleDraftVisibility = (key) => {
    setDraft((prev) => {
      const target = prev.find((item) => item.key === key);
      if (!target) {
        return prev;
      }

      if (target.visible) {
        const visibleCount = prev.filter((item) => item.visible).length;
        if (visibleCount <= 1) {
          return prev;
        }
      }

      return prev.map((item) =>
        item.key === key
          ? {
              ...item,
              visible: !item.visible
            }
          : item
      );
    });
  };

  const toggleDraftPin = (key, side) => {
    setDraft((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              pin: item.pin === side ? "none" : side
            }
          : item
      )
    );
  };

  if (!isOpen) {
    return null;
  }

  const panelBg = isDarkTheme ? "#475363" : "#ffffff";
  const panelText = isDarkTheme ? "#f2f3f4" : "#001729";
  const panelBorder = isDarkTheme ? "#788696ff" : "#c1c6c84d";

  const themeCssVars = isDarkTheme
    ? {
        "--main-bg": "#3c4854",
        "--main-text": "#f2f3f4",
        "--modal-bg": "#475363",
        "--modal-text": "#f2f3f4",
        "--modal-border": "#788696ff",
        "--link-color": "#93ccffff"
      }
    : {
        "--main-bg": "#edeeef",
        "--main-text": "#001729",
        "--modal-bg": "#ffffff",
        "--modal-text": "#001729",
        "--modal-border": "#c1c6c84d",
        "--link-color": "#2a8cff"
      };

  const panel = (
    <div
      className={`column-settings-panel${isDarkTheme ? " column-settings-panel--dark" : ""}`}
      style={{
        top: bounds.top,
        bottom: bounds.bottom,
        right: bounds.right,
        left: "auto",
        background: panelBg,
        color: panelText,
        border: `1px solid ${panelBorder}`,
        zIndex: 2147483640,
        ...themeCssVars
      }}
    >
      <div className="column-settings-header">
        <h3>{title}</h3>
        <button type="button" className="close-settings-button" onClick={onClose} aria-label="Закрыть">
          <IconClose aria-hidden />
        </button>
      </div>
      <div className="column-settings-list">
        <div className="column-settings-search">
          <input
            type="text"
            placeholder="Поиск"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {filteredDraft.map((item) => {
          const column = columns.find((entry) => entry.key === item.key);
          return (
            <div
              key={`settings-${item.key}`}
              className="column-settings-item"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", item.key);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                moveDraftColumn(event.dataTransfer.getData("text/plain"), item.key);
              }}
            >
              <span className="drag-handle" aria-hidden="true">
                ⋮⋮
              </span>
              <span className="column-settings-title">{column?.title ?? item.key}</span>
              <button
                type="button"
                className={`settings-icon-button${item.visible ? " active" : ""}`}
                onClick={() => toggleDraftVisibility(item.key)}
                data-tooltip="Видимость"
                aria-label={item.visible ? "Скрыть колонку" : "Показать колонку"}
              >
                {item.visible ? "👁" : "🚫"}
              </button>
              <button
                type="button"
                className={`settings-icon-button${item.pin === "left" ? " active" : ""}`}
                onClick={() => toggleDraftPin(item.key, "left")}
                data-tooltip="Закрепить слева"
                aria-label={item.pin === "left" ? "Открепить слева" : "Закрепить слева"}
              >
                {item.pin === "left" ? "⇤" : "←"}
              </button>
              <button
                type="button"
                className={`settings-icon-button${item.pin === "right" ? " active" : ""}`}
                onClick={() => toggleDraftPin(item.key, "right")}
                data-tooltip="Закрепить справа"
                aria-label={item.pin === "right" ? "Открепить справа" : "Закрепить справа"}
              >
                {item.pin === "right" ? "⇥" : "→"}
              </button>
            </div>
          );
        })}
      </div>
      <div className="column-settings-footer">
        <button type="button" className="settings-footer-button primary" onClick={() => onApply(draft)}>
          <IconCheck aria-hidden />
          <span>Применить</span>
        </button>
        <button type="button" className="settings-footer-button" onClick={onClose}>
          <IconClose aria-hidden />
          <span>Отменить</span>
        </button>
        <button type="button" className="settings-footer-button" onClick={onReset}>
          <IconRefresh aria-hidden />
          <span>Сброс</span>
        </button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
