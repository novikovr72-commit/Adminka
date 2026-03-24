import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronRight } from "./AppIcons";

const Z_MENU = 2147483646;
const MARGIN = 12;
const ROW_PX = 32;
/** Одновременно видимых строк в списке (всего до limit на бэкенде) */
const MAX_VISIBLE_ROWS = 12;
const MAX_MENU_HEIGHT_PX = ROW_PX * MAX_VISIBLE_ROWS;
/** Ниже этого запаса по высоте под полем не переключаемся на «меню вверх», пока снизу реально хватает места под список */
const MIN_DOWN_BEFORE_FLIP_UP = 100;
const SEARCH_DEBOUNCE_MS = 200;

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

function OptionWithOverflowTooltip({ label, children }) {
  const spanRef = useRef(null);
  const [showTip, setShowTip] = useState(false);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 });
  const [portalEl] = useState(() =>
    typeof document !== "undefined" ? document.createElement("div") : null
  );

  useEffect(() => {
    if (!showTip || !portalEl || typeof document === "undefined") {
      return undefined;
    }
    document.body.appendChild(portalEl);
    return () => {
      if (portalEl.parentNode) {
        portalEl.parentNode.removeChild(portalEl);
      }
    };
  }, [showTip, portalEl]);

  const updatePosition = useCallback(() => {
    const el = spanRef.current;
    if (!el) {
      return;
    }
    const r = el.getBoundingClientRect();
    setTipPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 320 - 8) });
  }, []);

  const handleEnter = () => {
    const el = spanRef.current;
    if (!el) {
      return;
    }
    const overflow = el.scrollWidth > el.clientWidth + 1;
    if (overflow) {
      updatePosition();
      setShowTip(true);
    }
  };

  const handleLeave = () => setShowTip(false);

  return (
    <>
      <span
        ref={spanRef}
        className="reference-book-combobox-option-label"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children ?? label}
      </span>
      {showTip && portalEl
        ? createPortal(
            <div
              className="reference-book-combobox-tooltip"
              style={{
                position: "fixed",
                zIndex: Z_MENU + 1,
                top: tipPos.top,
                left: tipPos.left,
                maxWidth: 320,
                padding: "6px 8px",
                borderRadius: 4,
                fontSize: 12,
                lineHeight: 1.35,
                whiteSpace: "normal",
                wordBreak: "break-word",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                background: "var(--modal-bg, #fff)",
                color: "var(--modal-text, #001729)",
                border: "1px solid var(--modal-border, rgba(193,198,200,0.5))"
              }}
              role="tooltip"
            >
              {label}
            </div>,
            portalEl
          )
        : null}
    </>
  );
}

function normalizeRemoteLoadResult(raw) {
  if (Array.isArray(raw)) {
    return { items: raw, hasMore: false };
  }
  if (raw && typeof raw === "object") {
    const items = Array.isArray(raw.items) ? raw.items : [];
    return { items, hasMore: raw.hasMore === true };
  }
  return { items: [], hasMore: false };
}

function dedupeLinkRows(prev, next) {
  const seen = new Set(prev.map((o) => String(o?.linkValue ?? "")));
  const out = [...prev];
  for (const o of next) {
    const k = String(o?.linkValue ?? "");
    if (!seen.has(k)) {
      seen.add(k);
      out.push(o);
    }
  }
  return out;
}

/**
 * Выбор пары (значение поля связи, подпись).
 * Статика: options — { linkValue, showValue }.
 * Удалённо: loadOptions({ search, offset }) — до 100 строк; fieldLinkListType full — при открытии без текста полный список; match — только по тексту, hasMore + скролл.
 */
export default function ReferenceBookLinkFieldCombobox({
  value,
  disabled,
  onChange,
  options,
  loadOptions,
  loading: externalLoading,
  placeholder = "Выберите…",
  inputVariant = "relations",
  allowClear = true,
  linkListType = "full",
  /** При открытии редактирования: ключ + подпись как в просмотре (без мигания UUID и без подмены на подпись из «Списка»). */
  initialLinkSnapshot = null
}) {
  const listId = useId();
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [remoteFlat, setRemoteFlat] = useState([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [remoteHasMore, setRemoteHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Подпись для текущего value до открытия меню (remoteFlat пуст) — не сбрасывается при setRemoteFlat([]) в handleOpenMenu */
  const [resolvedRemoteOption, setResolvedRemoteOption] = useState(null);
  const remoteFlatRef = useRef([]);
  const remoteImmediateNextLoadRef = useRef(false);
  /** В режиме full: пока false — запрос списка без фильтра по тексту (полный объём до limit); после ввода — поиск по тексту. */
  const userEditedSearchRef = useRef(false);

  const isRemote = typeof loadOptions === "function";
  const staticFlat = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const flat = isRemote ? remoteFlat : staticFlat;

  useEffect(() => {
    remoteFlatRef.current = remoteFlat;
  }, [remoteFlat]);

  /* Подпись для закрытого поля: при снимке с карточки — без запроса; иначе — link-options по ключу */
  useEffect(() => {
    if (!isRemote || typeof loadOptions !== "function") {
      setResolvedRemoteOption(null);
      return undefined;
    }
    const v = value;
    if (v === null || v === undefined || v === "") {
      setResolvedRemoteOption(null);
      return undefined;
    }
    const sv = String(v);
    if (
      initialLinkSnapshot != null
      && String(initialLinkSnapshot.linkValue ?? "") === sv
    ) {
      setResolvedRemoteOption({
        linkValue: v,
        showValue: String(initialLinkSnapshot.showValue ?? "")
      });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await loadOptions({ search: sv, offset: 0 });
        const { items } = normalizeRemoteLoadResult(raw);
        const list = Array.isArray(items) ? items : [];
        const hit = list.find((o) => String(o?.linkValue ?? "") === sv) ?? null;
        if (!cancelled) {
          setResolvedRemoteOption(hit);
        }
      } catch {
        if (!cancelled) {
          setResolvedRemoteOption(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isRemote, loadOptions, value, initialLinkSnapshot]);

  const displayLabelForValue = useMemo(() => {
    const v = value;
    if (v === null || v === undefined || v === "") {
      return "";
    }
    const sv = String(v);
    const hit = staticFlat.find((o) => String(o?.linkValue ?? "") === sv);
    if (hit) {
      return String(hit.showValue ?? "");
    }
    if (isRemote) {
      if (
        initialLinkSnapshot != null
        && String(initialLinkSnapshot.linkValue ?? "") === sv
      ) {
        return String(initialLinkSnapshot.showValue ?? "").trim() || sv;
      }
      const hitR = remoteFlat.find((o) => String(o?.linkValue ?? "") === sv);
      if (hitR) {
        return String(hitR.showValue ?? "");
      }
      if (resolvedRemoteOption && String(resolvedRemoteOption?.linkValue ?? "") === sv) {
        return String(resolvedRemoteOption.showValue ?? "");
      }
      return sv;
    }
    return sv;
  }, [initialLinkSnapshot, isRemote, remoteFlat, resolvedRemoteOption, staticFlat, value]);

  /* Закрытое поле показывает displayLabelForValue (см. displayValue); отдельная синхронизация filter при menuOpen давала гонку и обнуляла выбор. */

  useEffect(() => {
    if (!isRemote || !menuOpen) {
      return undefined;
    }
    const isMatch = linkListType === "match";
    let searchForReq = "";
    if (isMatch) {
      searchForReq = String(filter ?? "").trim();
      if (!searchForReq) {
        setRemoteFlat([]);
        setRemoteHasMore(false);
        setInternalLoading(false);
        return undefined;
      }
    } else {
      searchForReq = userEditedSearchRef.current ? String(filter ?? "").trim() : "";
    }

    const immediate = remoteImmediateNextLoadRef.current;
    remoteImmediateNextLoadRef.current = false;
    const useDebounce = isMatch || (userEditedSearchRef.current && linkListType === "full");
    const delay = immediate ? 0 : useDebounce ? SEARCH_DEBOUNCE_MS : 0;

    let cancelled = false;
    const t = window.setTimeout(async () => {
      setInternalLoading(true);
      try {
        const raw = await loadOptions({ search: searchForReq, offset: 0 });
        const { items, hasMore } = normalizeRemoteLoadResult(raw);
        if (!cancelled) {
          setRemoteFlat(Array.isArray(items) ? items : []);
          setRemoteHasMore(Boolean(hasMore));
        }
      } catch {
        if (!cancelled) {
          setRemoteFlat([]);
          setRemoteHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setInternalLoading(false);
        }
      }
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [filter, isRemote, loadOptions, menuOpen, linkListType]);

  useEffect(() => {
    if (!menuOpen) {
      setRemoteHasMore(false);
      setLoadingMore(false);
    }
  }, [menuOpen]);

  const appendMore = useCallback(async () => {
    if (!remoteHasMore || loadingMore || internalLoading || !menuOpen || typeof loadOptions !== "function") {
      return;
    }
    const isMatch = linkListType === "match";
    let searchForReq = "";
    if (isMatch) {
      searchForReq = String(filter ?? "").trim();
      if (!searchForReq) {
        return;
      }
    } else {
      searchForReq = userEditedSearchRef.current ? String(filter ?? "").trim() : "";
    }
    setLoadingMore(true);
    try {
      const offset = remoteFlatRef.current.length;
      const raw = await loadOptions({ search: searchForReq, offset });
      const { items, hasMore } = normalizeRemoteLoadResult(raw);
      const next = Array.isArray(items) ? items : [];
      setRemoteFlat((prev) => dedupeLinkRows(prev, next));
      setRemoteHasMore(Boolean(hasMore));
    } catch {
      setRemoteHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [linkListType, remoteHasMore, loadingMore, internalLoading, menuOpen, filter, loadOptions]);

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

  const displayValue = menuOpen ? filter : displayLabelForValue;

  const handleOpenMenu = () => {
    if (disabled) {
      return;
    }
    if (menuOpen) {
      return;
    }
    userEditedSearchRef.current = false;
    /* Подпись в поле при открытии (и для статики fieldValues) — иначе value визуально «пропадает». Полный список: filtered ниже, пока ref false. */
    setFilter(displayLabelForValue);
    if (isRemote) {
      remoteImmediateNextLoadRef.current = true;
      setRemoteFlat([]);
      setRemoteHasMore(false);
    }
    setMenuOpen(true);
  };

  const handleFocus = () => {
    handleOpenMenu();
  };

  const handleClick = () => {
    handleOpenMenu();
  };

  const handleChange = (event) => {
    userEditedSearchRef.current = true;
    const v = event.target.value;
    setFilter(v);
    if (!menuOpen) {
      setMenuOpen(true);
    }
  };

  const filtered = useMemo(() => {
    if (isRemote) {
      return flat;
    }
    /* Статика: до первого изменения текста — весь список (режим «Полный»); после ввода — сужение по подстроке */
    if (!userEditedSearchRef.current) {
      return flat;
    }
    const q = String(filter ?? "")
      .trim()
      .toLowerCase();
    return flat.filter((o) => {
      const show = String(o?.showValue ?? "");
      const link = String(o?.linkValue ?? "");
      if (!q) {
        return true;
      }
      return show.toLowerCase().includes(q) || link.toLowerCase().includes(q);
    });
  }, [flat, filter, isRemote, menuOpen]);

  const portalTarget = getPortalContainer();

  const pick = (opt) => {
    onChange?.(opt?.linkValue);
    setResolvedRemoteOption(
      opt != null && opt.linkValue != null
        ? { linkValue: opt.linkValue, showValue: opt.showValue }
        : null
    );
    setFilter(String(opt?.showValue ?? ""));
    setMenuOpen(false);
  };

  const handleClear = () => {
    setFilter("");
    setResolvedRemoteOption(null);
    onChange?.(null);
    setMenuOpen(false);
  };

  const optionsMaxHeight =
    menuStyle && typeof menuStyle.maxHeight === "number" ? Math.max(120, menuStyle.maxHeight - 20) : 180;

  /** Полноэкранная «Загрузка» только если ещё нет строк — иначе оставляем предыдущий список (убирает мигание). */
  const showBlockingLoader = Boolean(externalLoading) || (isRemote && internalLoading && remoteFlat.length === 0);

  const showClear = allowClear && String(displayValue).trim() && !disabled;
  const showOpenList = !disabled;

  return (
    <div className="reference-book-field-input-clip">
      <div
        className={`relation-combobox reference-book-link-table-combobox${menuOpen ? " open" : ""}${
          showOpenList ? " relation-combobox--has-open" : ""
        }${showClear ? " relation-combobox--has-clear" : ""}`}
        ref={anchorRef}
      >
        <input
          type="text"
          className={
            inputVariant === "cardField"
              ? "relation-combobox-trigger employee-card-field-input reference-book-field-table-input"
              : "relation-combobox-trigger employee-card-relations-filter-input reference-book-field-table-input"
          }
          value={displayValue}
          disabled={disabled}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? listId : undefined}
          aria-autocomplete="list"
          onFocus={handleFocus}
          onClick={handleClick}
          onChange={handleChange}
        />
        {showClear ? (
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
        {showOpenList ? (
          <button
            type="button"
            className="relation-combobox-open-button"
            aria-label="Открыть список"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              if (!menuOpen) {
                handleOpenMenu();
              } else {
                setMenuOpen(false);
              }
            }}
          >
            <IconChevronRight
              aria-hidden
              style={{ display: "block", transform: "rotate(90deg)", width: 14, height: 14 }}
            />
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
                aria-label="Значения связи"
              >
                {showBlockingLoader ? (
                  <div className="relation-combobox-empty">Загрузка…</div>
                ) : filtered.length === 0 ? (
                  <div className="relation-combobox-empty">Нет совпадений</div>
                ) : (
                  <div
                    className="relation-combobox-options"
                    style={{
                      maxHeight: optionsMaxHeight
                    }}
                    onScroll={(e) => {
                      if (!remoteHasMore || loadingMore || internalLoading) {
                        return;
                      }
                      const el = e.currentTarget;
                      if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
                        void appendMore();
                      }
                    }}
                  >
                    {filtered.map((opt, idx) => {
                      const show = String(opt?.showValue ?? "");
                      return (
                        <button
                          key={`${String(opt?.linkValue)}-${idx}`}
                          type="button"
                          role="option"
                          className="relation-combobox-option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => pick(opt)}
                        >
                          <OptionWithOverflowTooltip label={show}>{show}</OptionWithOverflowTooltip>
                        </button>
                      );
                    })}
                    {loadingMore ? (
                      <div className="relation-combobox-empty relation-combobox-load-more">Загрузка…</div>
                    ) : null}
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
