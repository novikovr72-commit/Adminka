import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sanitizeTableNameInput } from "../referenceBookProperties";

/** Выше нижних панелей и карточек (см. excel-export / administration) */
const Z_MENU = 2147483646;
const MARGIN = 12;
/** ~высота одной строки в списке (padding + текст) */
const ROW_PX = 32;
const MAX_VISIBLE_ROWS = 10;
const MAX_MENU_HEIGHT_PX = ROW_PX * MAX_VISIBLE_ROWS;
const MIN_DOWN_BEFORE_FLIP_UP = 100;

function getPortalContainer() {
  if (typeof document === "undefined") {
    return null;
  }
  /* body: иначе #rb-modal-root (z-index ниже нижних панелей в #root) обрезает слой */
  return document.body;
}

/** Портал в body не наследует .content-area — var(--main-bg) не задан, фон «прозрачный», текст чёрный с body */
function readThemeSurfaceStyles() {
  if (typeof document === "undefined") {
    return {};
  }
  const root = document.querySelector(".content-area.dark") || document.querySelector(".content-area");
  if (!root) {
    return {
      backgroundColor: "#ffffff",
      color: "#001729",
      border: "1px solid rgba(193, 198, 200, 0.3)",
      boxShadow: "0 8px 20px rgba(0, 0, 0, 0.15)"
    };
  }
  const cs = getComputedStyle(root);
  const bg = cs.getPropertyValue("--modal-bg").trim();
  const fg = cs.getPropertyValue("--modal-text").trim();
  const bd = cs.getPropertyValue("--modal-border").trim();
  return {
    backgroundColor: bg || "#ffffff",
    color: fg || "#001729",
    border: `1px solid ${bd || "rgba(193, 198, 200, 0.3)"}`,
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.15)"
  };
}

/**
 * Текстовое поле имени таблицы; при фокусе — список таблиц из БД (фильтр по вводу).
 */
/** relations — как в таблице полей (связи); cardField — как обычный employee-card-field-input на карточке */
export default function ReferenceBookLinkTableCombobox({
  value,
  disabled,
  onChange,
  tables,
  loading,
  onEnsureTablesLoaded,
  placeholder = "схема.таблица или таблица",
  inputVariant = "relations",
  disabledHint = ""
}) {
  const listId = useId();
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState(String(value ?? ""));

  /** Как в подчинении: при закрытом меню подтягиваем filter из value (смена черновика и т.д.) */
  useEffect(() => {
    if (!menuOpen) {
      setFilter(String(value ?? ""));
    }
  }, [value, menuOpen]);

  const [menuStyle, setMenuStyle] = useState(null);
  const [openUpward, setOpenUpward] = useState(false);

  useLayoutEffect(() => {
    if (!menuOpen || !anchorRef.current) {
      setMenuStyle(null);
      setOpenUpward(false);
      return;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) {
        return;
      }
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceBelow = vh - r.bottom - MARGIN;
      const spaceAbove = r.top - MARGIN;
      const w = Math.min(Math.max(280, r.width), vw - MARGIN * 2);
      const left = Math.min(Math.max(MARGIN, r.left), vw - MARGIN - w);

      const maxHDown = Math.min(MAX_MENU_HEIGHT_PX, spaceBelow);
      const maxHUp = Math.min(MAX_MENU_HEIGHT_PX, spaceAbove);
      const preferUp =
        spaceAbove >= ROW_PX * 2 &&
        maxHDown < MIN_DOWN_BEFORE_FLIP_UP &&
        maxHUp > maxHDown;

      const surface = readThemeSurfaceStyles();
      let next;
      if (preferUp) {
        const maxH = Math.min(MAX_MENU_HEIGHT_PX, spaceAbove);
        next = {
          ...surface,
          position: "fixed",
          zIndex: Z_MENU,
          left,
          width: w,
          maxHeight: maxH,
          bottom: vh - r.top + 4,
          top: "auto",
          boxSizing: "border-box"
        };
      } else {
        const maxH = Math.min(MAX_MENU_HEIGHT_PX, spaceBelow);
        next = {
          ...surface,
          position: "fixed",
          zIndex: Z_MENU,
          left,
          width: w,
          maxHeight: maxH,
          top: r.bottom + 4,
          bottom: "auto",
          boxSizing: "border-box"
        };
      }
      setOpenUpward(preferUp);
      setMenuStyle(next);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const down = (event) => {
      const t = event.target;
      if (anchorRef.current?.contains(t)) {
        return;
      }
      if (menuRef.current?.contains(t)) {
        return;
      }
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [menuOpen]);

  const displayValue = menuOpen ? filter : String(value ?? "");
  const disabledTitle = String(disabledHint ?? "").trim();

  const handleFocus = () => {
    setFilter(String(value ?? ""));
    setMenuOpen(true);
    void onEnsureTablesLoaded?.();
  };

  const handleChange = (event) => {
    const sanitized = sanitizeTableNameInput(event.target.value);
    setFilter(sanitized);
    /* Не дергаем onChange на каждый символ — иначе родитель сбрасывает fieldLinkListType и прочие поля связи */
    if (!menuOpen) {
      setMenuOpen(true);
    }
  };

  const commitToParentIfChanged = () => {
    const sanitized = sanitizeTableNameInput(String(filter ?? ""));
    const prev = sanitizeTableNameInput(String(value ?? ""));
    if (sanitized !== prev) {
      onChange?.(sanitized);
    }
  };

  /** Всегда по текущей строке ввода (filter), как organNameFilter у подчинения */
  const filtered = useMemo(() => {
    const q = String(filter ?? "")
      .trim()
      .toLowerCase();
    return (Array.isArray(tables) ? tables : []).filter((t) => {
      const s = String(t ?? "");
      if (!q) {
        return true;
      }
      return s.toLowerCase().includes(q);
    });
  }, [tables, filter]);

  const portalTarget = getPortalContainer();

  const pick = (name) => {
    const s = String(name ?? "");
    setFilter(s);
    const sanitized = sanitizeTableNameInput(s);
    const prev = sanitizeTableNameInput(String(value ?? ""));
    if (sanitized !== prev) {
      onChange?.(sanitized);
    }
    setMenuOpen(false);
  };

  const handleClear = () => {
    setFilter("");
    onChange?.("");
    setMenuOpen(false);
  };

  const optionsMaxHeight =
    menuStyle && typeof menuStyle.maxHeight === "number"
      ? Math.max(120, menuStyle.maxHeight - 20)
      : 180;

  return (
    <div className="reference-book-field-input-clip">
      <div className={`relation-combobox reference-book-link-table-combobox${menuOpen ? " open" : ""}`} ref={anchorRef}>
        <input
          type="text"
          className={
            inputVariant === "cardField"
              ? "relation-combobox-trigger employee-card-field-input reference-book-field-table-input"
              : "relation-combobox-trigger employee-card-relations-filter-input reference-book-field-table-input"
          }
          value={displayValue}
          disabled={disabled}
          data-tooltip={disabled && disabledTitle ? disabledTitle : undefined}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? listId : undefined}
          aria-autocomplete="list"
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={() => {
            commitToParentIfChanged();
          }}
        />
        {String(displayValue).trim() && !disabled ? (
          <button
            type="button"
            className="relation-combobox-clear-button"
            aria-label="Очистить поле"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={handleClear}
          >
            ×
          </button>
        ) : null}
        {menuOpen && portalTarget && menuStyle
          ? createPortal(
              <div
                ref={menuRef}
                id={listId}
                className={`relation-combobox-menu relation-combobox-menu-portal reference-book-link-table-combobox-menu${
                  openUpward ? " relation-combobox-menu-upward" : ""
                }`}
                style={menuStyle}
                role="listbox"
                aria-label="Таблицы БД"
              >
                {loading ? (
                  <div className="relation-combobox-empty">Загрузка…</div>
                ) : filtered.length === 0 ? (
                  <div className="relation-combobox-empty">Нет совпадений</div>
                ) : (
                  <div
                    className="relation-combobox-options"
                    style={{
                      maxHeight: optionsMaxHeight
                    }}
                  >
                    {filtered.map((name) => (
                      <button
                        key={name}
                        type="button"
                        role="option"
                        className="relation-combobox-option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>,
              portalTarget
            )
          : null}
      </div>
    </div>
  );
}
