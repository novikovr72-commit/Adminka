import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sanitizeFieldNameInput } from "../referenceBookProperties";

const Z_MENU = 2147483646;
const MARGIN = 12;
const ROW_PX = 32;
const MAX_VISIBLE_ROWS = 10;
const MAX_MENU_HEIGHT_PX = ROW_PX * MAX_VISIBLE_ROWS;
const MIN_DOWN_BEFORE_FLIP_UP = 100;

function getPortalContainer() {
  if (typeof document === "undefined") {
    return null;
  }
  return document.body;
}

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
 * Выбор столбца БД: тот же UI, что {@link ReferenceBookLinkTableCombobox} (портал, фильтр).
 * Список загружается по GET columnsApiUrl?table=...
 * {@code relations} — как в таблице полей; {@code cardField} — как {@code employee-card-field-input} на карточке.
 */
export default function ReferenceBookDbColumnCombobox({
  value,
  disabled,
  onChange,
  tableName,
  columnsApiUrl,
  showSystemErrorToast = () => {},
  placeholder = "столбец",
  listAriaLabel = "Столбцы таблицы",
  disabledHint = "Сначала укажите таблицу",
  /** Подсказка, когда поле disabled при уже выбранной таблице (например, блокировка из‑за fieldValues). */
  secondaryDisabledHint = "",
  inputVariant = "relations"
}) {
  const listId = useId();
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState(String(value ?? ""));
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);

  const trimmedTable = String(tableName ?? "").trim();

  useEffect(() => {
    if (!menuOpen) {
      setFilter(String(value ?? ""));
    }
  }, [value, menuOpen]);

  useEffect(() => {
    if (!trimmedTable) {
      setColumns([]);
      return undefined;
    }
    const base = String(columnsApiUrl ?? "").trim();
    if (!base) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const url = `${base}?table=${encodeURIComponent(trimmedTable)}`;
    void fetch(url)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || `Ошибка ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setColumns(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) {
          showSystemErrorToast("Не удалось загрузить столбцы таблицы");
          setColumns([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trimmedTable, columnsApiUrl, showSystemErrorToast]);

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

  const handleFocus = () => {
    setFilter(String(value ?? ""));
    setMenuOpen(true);
  };

  const handleChange = (event) => {
    const sanitized = sanitizeFieldNameInput(event.target.value);
    setFilter(sanitized);
    onChange?.(sanitized);
    if (!menuOpen) {
      setMenuOpen(true);
    }
  };

  const filtered = useMemo(() => {
    const q = String(filter ?? "")
      .trim()
      .toLowerCase();
    return (Array.isArray(columns) ? columns : []).filter((c) => {
      const s = String(c ?? "");
      if (!q) {
        return true;
      }
      return s.toLowerCase().includes(q);
    });
  }, [columns, filter]);

  const portalTarget = getPortalContainer();

  const pick = (name) => {
    const s = String(name ?? "");
    setFilter(s);
    onChange?.(s);
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

  const blocked = disabled || !trimmedTable;
  const secondaryHint = String(secondaryDisabledHint ?? "").trim();

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
          disabled={blocked}
          placeholder={trimmedTable ? placeholder : disabledHint}
          spellCheck={false}
          autoComplete="off"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? listId : undefined}
          aria-autocomplete="list"
          data-tooltip={
            disabled && secondaryHint && trimmedTable
              ? secondaryHint
              : blocked && !trimmedTable
                ? disabledHint
                : undefined
          }
          onFocus={handleFocus}
          onChange={handleChange}
        />
        {String(displayValue).trim() && !blocked ? (
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
        {menuOpen && portalTarget && menuStyle && !blocked
          ? createPortal(
              <div
                ref={menuRef}
                id={listId}
                className={`relation-combobox-menu relation-combobox-menu-portal reference-book-link-table-combobox-menu${
                  openUpward ? " relation-combobox-menu-upward" : ""
                }`}
                style={menuStyle}
                role="listbox"
                aria-label={listAriaLabel}
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
