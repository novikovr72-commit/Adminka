import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { IconClearFilter, IconClose, IconPencil, IconPlus, IconTrash } from "./AppIcons";

const STRUCTURE_EMPLOYEES_SORT_STORAGE_KEY = "organization-card.structure-employees-sort.v1";
const STRUCTURE_EMPLOYEES_COL_FRACS_STORAGE_KEY = "organization-card.structure-employees-col-fracs.v1";
const MIN_DATA_COL_PX = 80;
const ACTIONS_COL_PX = 88;
const WRAPPER_GUTTER_PX = 6;
/** Показывать тултип, если обрезка не детектируется, но строка длинная */
const STRUCTURE_EMPLOYEES_TOOLTIP_MIN_CHARS = 32;

const DEFAULT_SORT_RULES = [
  { field: "employeeFullName", direction: "ASC" },
  { field: "organUnitName", direction: "ASC" }
];

const DEFAULT_COL_FRACS = {
  subdivision: 1 / 3,
  fullName: 1 / 3,
  position: 1 / 3
};

const SORT_FIELDS = {
  organUnitName: "organUnitName",
  employeeFullName: "employeeFullName",
  employeePositionName: "employeePositionName"
};

function parseStoredSortRules() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STRUCTURE_EMPLOYEES_SORT_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((r) => ({
        field: String(r?.field ?? "").trim(),
        direction: String(r?.direction ?? "").toUpperCase() === "DESC" ? "DESC" : "ASC"
      }))
      .filter((r) =>
        [SORT_FIELDS.organUnitName, SORT_FIELDS.employeeFullName, SORT_FIELDS.employeePositionName].includes(r.field)
      );
  } catch {
    return [];
  }
}

function parseStoredColFracs() {
  if (typeof window === "undefined") {
    return { ...DEFAULT_COL_FRACS };
  }
  try {
    const raw = window.localStorage.getItem(STRUCTURE_EMPLOYEES_COL_FRACS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_COL_FRACS };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_COL_FRACS };
    }
    let subdivision = Number(parsed.subdivision);
    let fullName = Number(parsed.fullName);
    let position = Number(parsed.position);
    if (![subdivision, fullName, position].every((n) => Number.isFinite(n) && n > 0)) {
      return { ...DEFAULT_COL_FRACS };
    }
    const sum = subdivision + fullName + position;
    if (sum <= 0) {
      return { ...DEFAULT_COL_FRACS };
    }
    return {
      subdivision: subdivision / sum,
      fullName: fullName / sum,
      position: position / sum
    };
  } catch {
    return { ...DEFAULT_COL_FRACS };
  }
}

const FIELD_GETTERS = {
  organUnitName: (r) => String(r?.organUnitName ?? ""),
  employeeFullName: (r) => String(r?.employeeFullName ?? ""),
  employeePositionName: (r) => String(r?.employeePositionName ?? "")
};

const compareLinksBySortRules = (a, b, rules) => {
  const list = Array.isArray(rules) && rules.length > 0 ? rules : DEFAULT_SORT_RULES;
  for (const rule of list) {
    const get = FIELD_GETTERS[rule.field];
    if (!get) {
      continue;
    }
    const cmp = get(a).localeCompare(get(b), "ru", { sensitivity: "base", numeric: true });
    if (cmp !== 0) {
      return rule.direction === "DESC" ? -cmp : cmp;
    }
  }
  return 0;
};

const linkKey = (link) => `${link.organUnitChildId}::${link.employeeOrganId}`;

const EMPLOYEE_DND_HEADER_KEY = "__employee_dnd_header__";

/** Руководитель по всей организации (любое подразделение); при нескольких записях — сначала тот же OU, что у подчинённого */
const findParentLink = (child, links) => {
  const pid = String(child.employeeParentId ?? "").trim();
  if (!pid) {
    return null;
  }
  const childOu = String(child.organUnitChildId ?? "").trim();
  const candidates = (links ?? []).filter((r) => String(r.employeeId ?? "").trim() === pid);
  if (candidates.length === 0) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  const sameOu = candidates.find((r) => String(r.organUnitChildId ?? "").trim() === childOu);
  return sameOu ?? candidates[0];
};

/**
 * Если в графе подчинения все записи «висят» на кольце/цикле, «естественных» корней нет.
 * Берём по одному условному корню на слабую компоненту (минимальный linkKey) и не вешаем его под родителя.
 */
function pickArtificialRootKeysForForest(links) {
  if (!Array.isArray(links) || links.length === 0) {
    return new Set();
  }
  const adj = new Map();
  for (const l of links) {
    const k = linkKey(l);
    if (!adj.has(k)) {
      adj.set(k, new Set());
    }
    const p = findParentLink(l, links);
    if (p) {
      const pk = linkKey(p);
      adj.get(k).add(pk);
      if (!adj.has(pk)) {
        adj.set(pk, new Set());
      }
      adj.get(pk).add(k);
    }
  }
  const seen = new Set();
  const rootKeys = new Set();
  for (const l of links) {
    const start = linkKey(l);
    if (seen.has(start)) {
      continue;
    }
    let minK = start;
    const st = [start];
    seen.add(start);
    while (st.length) {
      const cur = st.pop();
      if (cur < minK) {
        minK = cur;
      }
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          st.push(nb);
        }
      }
    }
    rootKeys.add(minK);
  }
  return rootKeys;
}

/**
 * Строит порядок строк дерева и карту «родитель в UI» (рёбра childrenMap + DFS).
 * Сворачивание ветки должно опираться на этот родитель, а не на полную цепочку findParentLink,
 * иначе при условных корнях/циклах обход по employeeParentId может скрыть строки вне ветки или всю таблицу.
 */
const buildStructureEmployeeTreeRows = (links, sortRules) => {
  if (!Array.isArray(links) || links.length === 0) {
    return { treeRows: [], treeDisplayParentKeyByChildKey: new Map(), rowKeysWithTreeChildren: new Set() };
  }
  const cmp = (x, y) => compareLinksBySortRules(x, y, sortRules);
  const childrenMap = new Map();
  let rootLinks = [];
  for (const link of links) {
    const parent = findParentLink(link, links);
    if (!parent) {
      rootLinks.push(link);
    } else {
      const pk = linkKey(parent);
      if (!childrenMap.has(pk)) {
        childrenMap.set(pk, []);
      }
      childrenMap.get(pk).push(link);
    }
  }
  if (rootLinks.length === 0) {
    const artificialRootKeys = pickArtificialRootKeysForForest(links);
    rootLinks = links.filter((l) => artificialRootKeys.has(linkKey(l)));
    childrenMap.clear();
    for (const link of links) {
      if (artificialRootKeys.has(linkKey(link))) {
        continue;
      }
      const parent = findParentLink(link, links);
      if (!parent) {
        rootLinks.push(link);
        continue;
      }
      const pk = linkKey(parent);
      if (!childrenMap.has(pk)) {
        childrenMap.set(pk, []);
      }
      childrenMap.get(pk).push(link);
    }
  }
  rootLinks.sort(cmp);
  for (const arr of childrenMap.values()) {
    arr.sort(cmp);
  }
  const rowKeysWithTreeChildren = new Set();
  for (const [pk, arr] of childrenMap) {
    if (arr.length > 0) {
      rowKeysWithTreeChildren.add(pk);
    }
  }
  const out = [];
  const treeDisplayParentKeyByChildKey = new Map();
  const dfsSeen = new Set();
  const dfs = (link, depth, parentKey = null) => {
    const lk = linkKey(link);
    if (dfsSeen.has(lk)) {
      return;
    }
    dfsSeen.add(lk);
    if (parentKey != null) {
      treeDisplayParentKeyByChildKey.set(lk, parentKey);
    }
    out.push({ ...link, depth });
    const kids = childrenMap.get(lk) ?? [];
    for (const k of kids) {
      dfs(k, depth + 1, lk);
    }
  };
  for (const r of rootLinks) {
    dfs(r, 0);
  }
  return { treeRows: out, treeDisplayParentKeyByChildKey, rowKeysWithTreeChildren };
};

const filterLinks = (links, filters) => {
  const sub = String(filters.subdivision ?? "").trim().toLowerCase();
  const name = String(filters.fullName ?? "").trim().toLowerCase();
  const pos = String(filters.position ?? "").trim().toLowerCase();
  return links.filter((row) => {
    if (sub && !String(row.organUnitName ?? "").toLowerCase().includes(sub)) {
      return false;
    }
    if (name && !String(row.employeeFullName ?? "").toLowerCase().includes(name)) {
      return false;
    }
    if (pos && !String(row.employeePositionName ?? "").toLowerCase().includes(pos)) {
      return false;
    }
    return true;
  });
};

const INITIAL_MODAL = {
  open: false,
  mode: "add",
  employeeOrganId: "",
  employeeId: "",
  employeeFullName: "",
  organUnitId: "",
  /** Подразделение записи на момент открытия редактирования (для проверки смены OU) */
  editInitialOrganUnitId: "",
  employeePositionId: "",
  bossEmployeeId: "",
  employeeNameFilter: ""
};

const OrganizationStructureEmployeesPanel = forwardRef(function OrganizationStructureEmployeesPanel(
  {
    rootOrganUnitId,
    rootOrganUnitName,
    structureSubdivisionFilterSync,
    structureItems,
    headEmployees,
    loading,
    listEmployeesApiUrl,
    listPositionsApiUrl,
    employeePositionBaseUrl,
    onRefresh,
    onEmployeeLinkUpsert,
    onEmployeeStructureDnDActiveChange,
    updateOrganizationStructureDragAutoScroll,
    stopOrganizationStructureDragAutoScroll,
    showSystemErrorToast,
    showSystemSuccessToast,
    getEmployeeCardHref
  },
  forwardedRef
) {
  const [filters, setFilters] = useState({ subdivision: "", fullName: "", position: "" });
  const [sortRules, setSortRules] = useState(() => {
    const stored = parseStoredSortRules();
    return stored.length > 0 ? stored : [...DEFAULT_SORT_RULES];
  });
  const [colFracs, setColFracs] = useState(parseStoredColFracs);
  const [fluidWidth, setFluidWidth] = useState(360);
  const [modal, setModal] = useState(INITIAL_MODAL);
  const [saving, setSaving] = useState(false);
  const [positionOptions, setPositionOptions] = useState([]);
  const [employeePickOptions, setEmployeePickOptions] = useState([]);
  const [bossOptions, setBossOptions] = useState([]);
  const [pendingDeleteOrganId, setPendingDeleteOrganId] = useState("");
  const pickTimerRef = useRef(0);
  const latestModalRef = useRef(modal);
  latestModalRef.current = modal;
  const tableWrapRef = useRef(null);
  /** Высота первой строки thead (сортировка) — для sticky второй строки (фильтры), иначе между ними просвечивает tbody */
  const employeesTheadRow1Ref = useRef(null);
  const resizeRef = useRef(null);
  const [cellTooltip, setCellTooltip] = useState({ visible: false, text: "", x: 0, y: 0 });
  const [collapsedEmployeeTreeKeys, setCollapsedEmployeeTreeKeys] = useState(() => new Set());
  const employeePickInputId = useId();
  const organUnitComboboxListId = useId();
  const positionComboboxListId = useId();
  const bossComboboxListId = useId();
  const [organUnitMenuOpen, setOrganUnitMenuOpen] = useState(false);
  const [positionMenuOpen, setPositionMenuOpen] = useState(false);
  const [bossMenuOpen, setBossMenuOpen] = useState(false);
  const organUnitComboboxRef = useRef(null);
  const positionComboboxRef = useRef(null);
  const bossComboboxRef = useRef(null);
  const employeeDnDDragOrganIdRef = useRef("");
  const [employeeDnDDraggingKey, setEmployeeDnDDraggingKey] = useState("");
  const [employeeDnDDropTargetKey, setEmployeeDnDDropTargetKey] = useState("");
  const [selectedEmployeeTreeRowKey, setSelectedEmployeeTreeRowKey] = useState("");

  useEffect(() => {
    setCollapsedEmployeeTreeKeys(new Set());
  }, [rootOrganUnitId]);

  useEffect(() => {
    setSelectedEmployeeTreeRowKey("");
  }, [rootOrganUnitId]);

  const handleEmployeeTableRowClick = useCallback((event, row) => {
    const el = event.target;
    if (el.closest?.("a[href]")) {
      return;
    }
    if (el.closest?.("button")) {
      return;
    }
    if (el.closest?.(".organization-card-structure-tree-toggle")) {
      return;
    }
    if (el.closest?.("input, select, textarea")) {
      return;
    }
    setSelectedEmployeeTreeRowKey(linkKey(row));
  }, []);

  useEffect(() => {
    const sync = structureSubdivisionFilterSync;
    if (!sync || typeof sync.tick !== "number") {
      return;
    }
    const nextSub = String(sync.value ?? "");
    setFilters((prev) => {
      if (String(prev.subdivision ?? "") === nextSub) {
        return prev;
      }
      return { ...prev, subdivision: nextSub };
    });
  }, [structureSubdivisionFilterSync?.tick, structureSubdivisionFilterSync?.value]);

  useEffect(() => {
    if (!modal.open) {
      setOrganUnitMenuOpen(false);
      setPositionMenuOpen(false);
      setBossMenuOpen(false);
    }
  }, [modal.open]);

  useEffect(() => {
    if (!organUnitMenuOpen) {
      return;
    }
    const onPointerDown = (event) => {
      const el = organUnitComboboxRef.current;
      if (el && !el.contains(event.target)) {
        setOrganUnitMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOrganUnitMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [organUnitMenuOpen]);

  useEffect(() => {
    if (!positionMenuOpen) {
      return;
    }
    const onPointerDown = (event) => {
      const el = positionComboboxRef.current;
      if (el && !el.contains(event.target)) {
        setPositionMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setPositionMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [positionMenuOpen]);

  useEffect(() => {
    if (!bossMenuOpen) {
      return;
    }
    const onPointerDown = (event) => {
      const el = bossComboboxRef.current;
      if (el && !el.contains(event.target)) {
        setBossMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setBossMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [bossMenuOpen]);

  const setTableWrapNode = useCallback(
    (node) => {
      tableWrapRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  const placeEmployeesTableTooltip = useCallback((clientX, clientY, textLen) => {
    const pad = 10;
    const off = 12;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const approxCharsPerLine = 48;
    const lines = Math.min(14, Math.max(1, Math.ceil(Math.max(textLen, 1) / approxCharsPerLine)));
    const estH = Math.min(vh * 0.55, 16 * lines + 20);
    const estW = Math.min(420, vw - 2 * pad);
    let x = clientX + off;
    let y = clientY + off;
    if (x + estW > vw - pad) {
      x = vw - estW - pad;
    }
    if (y + estH > vh - pad) {
      y = Math.max(pad, clientY - estH - 4);
    }
    x = Math.max(pad, x);
    y = Math.max(pad, y);
    return { x, y };
  }, []);

  const updateCellTooltipPosition = useCallback(
    (event) => {
      setCellTooltip((prev) => {
        if (!prev.visible) {
          return prev;
        }
        const { x, y } = placeEmployeesTableTooltip(
          event.clientX,
          event.clientY,
          String(prev.text ?? "").length
        );
        return { ...prev, x, y };
      });
    },
    [placeEmployeesTableTooltip]
  );

  const isElementVisuallyTruncated = useCallback((el) => {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    const td = el.closest("td");
    const sw = el.scrollWidth;
    let cw = el.clientWidth;
    if (cw < 4 && td instanceof HTMLElement) {
      cw = td.clientWidth;
    }
    const sh = el.scrollHeight;
    let ch = el.clientHeight;
    if (ch < 4 && td instanceof HTMLElement) {
      ch = td.clientHeight;
    }
    if (sw > cw + 1 || sh > ch + 1) {
      return true;
    }
    const range = typeof document !== "undefined" ? document.createRange() : null;
    if (!range || el.firstChild === null) {
      return false;
    }
    try {
      range.selectNodeContents(el);
      const fullW = range.getBoundingClientRect().width;
      return fullW > cw + 1;
    } catch {
      return false;
    }
  }, []);

  const handleCellMouseEnter = useCallback(
    (event, rawValue) => {
      const valueText = String(rawValue ?? "").trim();
      if (!valueText) {
        setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
        return;
      }
      const el = event.currentTarget;
      if (!(el instanceof HTMLElement)) {
        return;
      }
      const showForLength = valueText.length >= STRUCTURE_EMPLOYEES_TOOLTIP_MIN_CHARS;
      const clientX = event.clientX;
      const clientY = event.clientY;
      const tryShow = () => {
        if (!el.isConnected) {
          return;
        }
        const truncated = isElementVisuallyTruncated(el);
        if (!truncated && !showForLength) {
          setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
          return;
        }
        const { x, y } = placeEmployeesTableTooltip(clientX, clientY, valueText.length);
        setCellTooltip({
          visible: true,
          text: valueText,
          x,
          y
        });
      };
      /* :hover в момент mouseenter и первого rAF часто ещё false — из-за этого тултип не открывался */
      requestAnimationFrame(() => {
        requestAnimationFrame(tryShow);
      });
    },
    [isElementVisuallyTruncated, placeEmployeesTableTooltip]
  );

  const handleCellMouseLeave = useCallback(() => {
    setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
  }, []);

  const orderingRules = sortRules.length > 0 ? sortRules : DEFAULT_SORT_RULES;

  useEffect(() => {
    try {
      window.localStorage.setItem(STRUCTURE_EMPLOYEES_SORT_STORAGE_KEY, JSON.stringify(sortRules));
    } catch {
      // noop
    }
  }, [sortRules]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STRUCTURE_EMPLOYEES_COL_FRACS_STORAGE_KEY, JSON.stringify(colFracs));
    } catch {
      // noop
    }
  }, [colFracs]);

  useLayoutEffect(() => {
    const el = tableWrapRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const next = Math.round(
        Math.max(MIN_DATA_COL_PX * 3, el.clientWidth - ACTIONS_COL_PX - WRAPPER_GUTTER_PX)
      );
      setFluidWidth((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const row = employeesTheadRow1Ref.current;
    const wrap = tableWrapRef.current;
    if (!row || !wrap) {
      return;
    }
    const apply = () => {
      const h = row.getBoundingClientRect().height;
      if (!Number.isFinite(h) || h <= 0) {
        return;
      }
      wrap.style.setProperty("--structure-employees-thead-row1-h", `${Math.ceil(h)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(row);
    return () => ro.disconnect();
  }, [sortRules, fluidWidth]);

  const colWidthsPx = useMemo(() => {
    const fw = Math.max(MIN_DATA_COL_PX * 3, fluidWidth);
    const { subdivision: fs, fullName: ff } = colFracs;
    /* Первая колонка данных — ФИО (fullName), вторая — подразделение (subdivision) */
    let fullPx = Math.max(MIN_DATA_COL_PX, Math.round(fw * ff));
    let subPx = Math.max(MIN_DATA_COL_PX, Math.round(fw * fs));
    let posPx = fw - fullPx - subPx;
    if (posPx < MIN_DATA_COL_PX) {
      const need = MIN_DATA_COL_PX - posPx;
      const fromFull = Math.min(need, fullPx - MIN_DATA_COL_PX);
      fullPx -= fromFull;
      posPx = fw - fullPx - subPx;
      if (posPx < MIN_DATA_COL_PX) {
        const need2 = MIN_DATA_COL_PX - posPx;
        const fromSub = Math.min(need2, subPx - MIN_DATA_COL_PX);
        subPx -= fromSub;
        posPx = fw - fullPx - subPx;
      }
    }
    return {
      subPx,
      fullPx,
      posPx: Math.max(MIN_DATA_COL_PX, posPx)
    };
  }, [fluidWidth, colFracs]);

  const handleResizeStart = useCallback(
    (boundary, event) => {
      event.preventDefault();
      event.stopPropagation();
      const wrap = tableWrapRef.current;
      if (!wrap) {
        return;
      }
      const fw = Math.max(
        MIN_DATA_COL_PX * 3,
        wrap.clientWidth - ACTIONS_COL_PX - WRAPPER_GUTTER_PX
      );
      resizeRef.current = {
        boundary,
        startX: event.clientX,
        startFracs: { ...colFracs },
        fw
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const handleMouseMove = (moveEvent) => {
        const ctx = resizeRef.current;
        if (!ctx) {
          return;
        }
        const delta = moveEvent.clientX - ctx.startX;
        const deltaFrac = delta / ctx.fw;
        const minF = MIN_DATA_COL_PX / ctx.fw;
        const s = ctx.startFracs;
        setColFracs((prev) => {
          if (ctx.boundary === "full-sub") {
            let fullName = s.fullName + deltaFrac;
            let subdivision = s.subdivision - deltaFrac;
            fullName = Math.max(minF, Math.min(fullName, s.fullName + s.subdivision - minF));
            subdivision = s.fullName + s.subdivision - fullName;
            return { subdivision, fullName, position: s.position };
          }
          if (ctx.boundary === "sub-pos") {
            let subdivision = s.subdivision + deltaFrac;
            let position = s.position - deltaFrac;
            subdivision = Math.max(minF, Math.min(subdivision, s.subdivision + s.position - minF));
            position = s.subdivision + s.position - subdivision;
            return { subdivision, fullName: s.fullName, position };
          }
          return prev;
        });
      };
      const handleMouseUp = () => {
        resizeRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [colFracs]
  );

  const getSortDirectionForField = useCallback(
    (field) => {
      const match = sortRules.find((rule) => rule.field === field);
      return match ? match.direction : null;
    },
    [sortRules]
  );

  const getSortOrderForField = useCallback(
    (field) => {
      const sortIndex = sortRules.findIndex((rule) => rule.field === field);
      return sortIndex >= 0 ? sortIndex + 1 : null;
    },
    [sortRules]
  );

  const handleSortClick = useCallback((columnSortField) => {
    setSortRules((prev) => {
      // Всегда мутируем список правил на основе prev: новое поле только добавляется / меняется / удаляется,
      // без очистки остальных (иначе «Должность» сбрасывала бы сортировку по Подразделению и ФИО).
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

  const renderSortableHeader = (title, sortField, resizeBoundary) => {
    const columnSortDirection = getSortDirectionForField(sortField);
    const columnSortOrder = getSortOrderForField(sortField);
    const sortIcon =
      columnSortDirection === "ASC" ? "▲" : columnSortDirection === "DESC" ? "▼" : null;
    return (
      <th className="organization-card-structure-employees-th" scope="col">
        <button
          type="button"
          className={`column-sort-button${columnSortDirection ? " active" : ""}`}
          onClick={() => handleSortClick(sortField)}
        >
          <span>{title}</span>
          {sortIcon ? (
            <span className="sort-icon-group">
              <span className="sort-icon">{sortIcon}</span>
              {columnSortOrder ? <span className="sort-order-index">{columnSortOrder}</span> : null}
            </span>
          ) : null}
        </button>
        {resizeBoundary ? (
          <span
            className="organization-card-structure-resize-handle"
            onMouseDown={(e) => handleResizeStart(resizeBoundary, e)}
            role="separator"
            aria-hidden="true"
          />
        ) : null}
      </th>
    );
  };

  const organUnitChoices = useMemo(() => {
    const rootId = String(rootOrganUnitId ?? "").trim();
    const rootName = String(rootOrganUnitName ?? "").trim() || "Головная организация";
    const opts = [];
    if (rootId) {
      opts.push({ id: rootId, name: rootName });
    }
    for (const item of Array.isArray(structureItems) ? structureItems : []) {
      const id = String(item?.organUnitChildId ?? "").trim();
      if (!id || id === rootId) {
        continue;
      }
      opts.push({
        id,
        name: String(item?.organUnitName ?? "").trim() || "—"
      });
    }
    return opts;
  }, [rootOrganUnitId, rootOrganUnitName, structureItems]);

  const allLinks = useMemo(() => {
    const rootId = String(rootOrganUnitId ?? "").trim();
    const rootName = String(rootOrganUnitName ?? "").trim() || "—";
    const links = [];
    for (const e of Array.isArray(headEmployees) ? headEmployees : []) {
      const organId = String(e?.employeeOrganId ?? "").trim();
      const empId = String(e?.employeeId ?? "").trim();
      if (!organId || !empId) {
        continue;
      }
      links.push({
        ...e,
        organUnitChildId: rootId,
        organUnitName: rootName
      });
    }
    for (const item of Array.isArray(structureItems) ? structureItems : []) {
      const ouId = String(item?.organUnitChildId ?? "").trim();
      const ouName = String(item?.organUnitName ?? "").trim() || "—";
      const emps = Array.isArray(item?.employees) ? item.employees : [];
      for (const e of emps) {
        const organId = String(e?.employeeOrganId ?? "").trim();
        const empId = String(e?.employeeId ?? "").trim();
        if (!organId || !empId) {
          continue;
        }
        links.push({
          ...e,
          organUnitChildId: ouId,
          organUnitName: ouName
        });
      }
    }
    return links;
  }, [headEmployees, rootOrganUnitId, rootOrganUnitName, structureItems]);

  const linkedEmployeeIdsKey = useMemo(() => {
    const ids = [];
    for (const link of allLinks) {
      const id = String(link?.employeeId ?? "").trim();
      if (id) {
        ids.push(id);
      }
    }
    ids.sort();
    return ids.join("|");
  }, [allLinks]);

  const linkedEmployeeIdsForOrg = useMemo(() => {
    if (!linkedEmployeeIdsKey) {
      return new Set();
    }
    return new Set(linkedEmployeeIdsKey.split("|"));
  }, [linkedEmployeeIdsKey]);

  const toggleEmployeeTreeRowCollapse = useCallback((rowKey) => {
    const key = String(rowKey ?? "").trim();
    if (!key) {
      return;
    }
    setCollapsedEmployeeTreeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const { visibleEmployeeTreeRows, totalFilteredTreeCount } = useMemo(() => {
    const collapsedSet = collapsedEmployeeTreeKeys;
    const filtered = filterLinks(allLinks, filters);
    const { treeRows, treeDisplayParentKeyByChildKey, rowKeysWithTreeChildren } =
      buildStructureEmployeeTreeRows(filtered, orderingRules);
    const enriched = treeRows.map((r) => {
      const rk = linkKey(r);
      return {
        ...r,
        rowKey: rk,
        hasChildren: rowKeysWithTreeChildren.has(rk)
      };
    });
    const visible = enriched.filter((row) => {
      let curKey = treeDisplayParentKeyByChildKey.get(row.rowKey);
      const seenAncestorKeys = new Set();
      while (curKey) {
        if (seenAncestorKeys.has(curKey)) {
          break;
        }
        seenAncestorKeys.add(curKey);
        if (collapsedSet.has(curKey)) {
          return false;
        }
        curKey = treeDisplayParentKeyByChildKey.get(curKey);
      }
      return true;
    });
    return { visibleEmployeeTreeRows: visible, totalFilteredTreeCount: enriched.length };
  }, [allLinks, filters, orderingRules, collapsedEmployeeTreeKeys]);

  const finishEmployeeDnDVisual = useCallback(() => {
    stopOrganizationStructureDragAutoScroll?.();
    onEmployeeStructureDnDActiveChange?.("");
    employeeDnDDragOrganIdRef.current = "";
    setEmployeeDnDDraggingKey("");
    setEmployeeDnDDropTargetKey("");
  }, [onEmployeeStructureDnDActiveChange, stopOrganizationStructureDragAutoScroll]);

  const resolveEmployeeDnDSourceRow = useCallback(
    (dataTransfer) => {
      const id = String(dataTransfer?.getData?.("text/plain") ?? "").trim();
      const fallback = String(employeeDnDDragOrganIdRef.current ?? "").trim();
      const key = id || fallback;
      if (!key) {
        return null;
      }
      return allLinks.find((l) => String(l?.employeeOrganId ?? "").trim() === key) ?? null;
    },
    [allLinks]
  );

  const persistEmployeeBossFromDnD = useCallback(
    async (sourceRow, bossEmployeeId) => {
      const employeeOrganId = String(sourceRow?.employeeOrganId ?? "").trim();
      const employeeId = String(sourceRow?.employeeId ?? "").trim();
      const organUnitId = String(sourceRow?.organUnitChildId ?? "").trim();
      if (!employeeOrganId || !employeeId || !organUnitId) {
        showSystemErrorToast("Не удалось определить запись сотрудника");
        return;
      }
      const nextBoss =
        bossEmployeeId != null && String(bossEmployeeId).trim()
          ? String(bossEmployeeId).trim()
          : "";
      const prevBoss = String(sourceRow?.employeeParentId ?? "").trim();
      if (prevBoss === nextBoss) {
        return;
      }
      const body = {
        employeeId,
        organUnitId,
        employeePositionId: String(sourceRow?.employeePositionId ?? "").trim() || null,
        bossEmployeeId: nextBoss || null
      };
      try {
        const response = await fetch(`${employeePositionBaseUrl}/${encodeURIComponent(employeeOrganId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          showSystemErrorToast(String(data?.error ?? "").trim() || "Не удалось изменить руководителя");
          return;
        }
        if (typeof onEmployeeLinkUpsert === "function") {
          onEmployeeLinkUpsert({
            employeeOrganId,
            employeeId,
            employeeFullName: String(sourceRow?.employeeFullName ?? "").trim(),
            employeeParentId: nextBoss,
            employeePositionId: String(sourceRow?.employeePositionId ?? "").trim(),
            employeePositionName: String(sourceRow?.employeePositionName ?? "").trim(),
            organUnitChildId: organUnitId,
            organUnitName: String(sourceRow?.organUnitName ?? "").trim()
          });
        }
        showSystemSuccessToast(nextBoss ? "Руководитель обновлён" : "Руководитель сброшен");
        try {
          await onRefresh?.();
        } catch {
          // noop
        }
      } catch {
        showSystemErrorToast("Ошибка сохранения");
      }
    },
    [
      employeePositionBaseUrl,
      onEmployeeLinkUpsert,
      onRefresh,
      showSystemErrorToast,
      showSystemSuccessToast
    ]
  );

  const handleEmployeeDnDTableDragOverCapture = useCallback(
    (event) => {
      if (!employeeDnDDragOrganIdRef.current) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const x = Number(event?.clientX ?? event?.nativeEvent?.clientX);
      const y = Number(event?.clientY ?? event?.nativeEvent?.clientY);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        updateOrganizationStructureDragAutoScroll?.(x, y);
      }
    },
    [updateOrganizationStructureDragAutoScroll]
  );

  const handleEmployeeStructureTheadDragOver = useCallback(
    (event) => {
      if (!employeeDnDDragOrganIdRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      setEmployeeDnDDropTargetKey((prev) => (prev === EMPLOYEE_DND_HEADER_KEY ? prev : EMPLOYEE_DND_HEADER_KEY));
      const x = Number(event?.clientX ?? event?.nativeEvent?.clientX);
      const y = Number(event?.clientY ?? event?.nativeEvent?.clientY);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        updateOrganizationStructureDragAutoScroll?.(x, y);
      }
    },
    [updateOrganizationStructureDragAutoScroll]
  );

  const handleEmployeeStructureTheadDrop = useCallback(
    (event) => {
      if (!employeeDnDDragOrganIdRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const source = resolveEmployeeDnDSourceRow(event.dataTransfer);
      finishEmployeeDnDVisual();
      if (source) {
        void persistEmployeeBossFromDnD(source, null);
      }
    },
    [finishEmployeeDnDVisual, persistEmployeeBossFromDnD, resolveEmployeeDnDSourceRow]
  );

  const handleEmployeeRowDragStart = useCallback(
    (row, event) => {
      if (
        event.target.closest?.(".organization-card-structure-tree-toggle") ||
        event.target.closest?.(".employee-card-position-action-button") ||
        event.target.closest?.("input") ||
        event.target.closest?.(".organization-card-structure-resize-handle")
      ) {
        event.preventDefault();
        return;
      }
      const organId = String(row?.employeeOrganId ?? "").trim();
      if (!organId) {
        event.preventDefault();
        return;
      }
      employeeDnDDragOrganIdRef.current = organId;
      onEmployeeStructureDnDActiveChange?.(organId);
      setEmployeeDnDDraggingKey(linkKey(row));
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", organId);
      const startX = Number(event?.clientX ?? event?.nativeEvent?.clientX);
      const startY = Number(event?.clientY ?? event?.nativeEvent?.clientY);
      if (Number.isFinite(startX) && Number.isFinite(startY)) {
        updateOrganizationStructureDragAutoScroll?.(startX, startY);
      }
    },
    [onEmployeeStructureDnDActiveChange, updateOrganizationStructureDragAutoScroll]
  );

  const handleEmployeeRowDrag = useCallback(
    (event) => {
      if (!employeeDnDDragOrganIdRef.current) {
        return;
      }
      const x = Number(event?.clientX ?? event?.nativeEvent?.clientX);
      const y = Number(event?.clientY ?? event?.nativeEvent?.clientY);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        updateOrganizationStructureDragAutoScroll?.(x, y);
      }
    },
    [updateOrganizationStructureDragAutoScroll]
  );

  const handleEmployeeRowDragEnd = useCallback(() => {
    finishEmployeeDnDVisual();
  }, [finishEmployeeDnDVisual]);

  const handleEmployeeRowDragOver = useCallback(
    (targetRow, event) => {
      if (!employeeDnDDragOrganIdRef.current) {
        return;
      }
      const srcOrgan = String(employeeDnDDragOrganIdRef.current).trim();
      const tgtOrgan = String(targetRow?.employeeOrganId ?? "").trim();
      if (!tgtOrgan || srcOrgan === tgtOrgan) {
        return;
      }
      const srcRow = allLinks.find((l) => String(l?.employeeOrganId ?? "").trim() === srcOrgan);
      const srcEmp = String(srcRow?.employeeId ?? "").trim();
      const tgtEmp = String(targetRow?.employeeId ?? "").trim();
      if (srcEmp && tgtEmp && srcEmp === tgtEmp) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const dropKey = linkKey(targetRow);
      setEmployeeDnDDropTargetKey((prev) => (prev === dropKey ? prev : dropKey));
      const x = Number(event?.clientX ?? event?.nativeEvent?.clientX);
      const y = Number(event?.clientY ?? event?.nativeEvent?.clientY);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        updateOrganizationStructureDragAutoScroll?.(x, y);
      }
    },
    [allLinks, updateOrganizationStructureDragAutoScroll]
  );

  const handleEmployeeRowDrop = useCallback(
    (targetRow, event) => {
      if (!employeeDnDDragOrganIdRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const srcOrgan = String(employeeDnDDragOrganIdRef.current).trim();
      const tgtOrgan = String(targetRow?.employeeOrganId ?? "").trim();
      if (!tgtOrgan || srcOrgan === tgtOrgan) {
        finishEmployeeDnDVisual();
        return;
      }
      const srcRow = resolveEmployeeDnDSourceRow(event.dataTransfer);
      const srcEmp = String(srcRow?.employeeId ?? "").trim();
      const tgtEmp = String(targetRow?.employeeId ?? "").trim();
      if (!srcRow || (srcEmp && tgtEmp && srcEmp === tgtEmp)) {
        finishEmployeeDnDVisual();
        return;
      }
      const newBossId = String(targetRow?.employeeId ?? "").trim();
      finishEmployeeDnDVisual();
      void persistEmployeeBossFromDnD(srcRow, newBossId);
    },
    [finishEmployeeDnDVisual, persistEmployeeBossFromDnD, resolveEmployeeDnDSourceRow]
  );

  const fetchPositionOptions = useCallback(
    async (filterText) => {
      const params = new URLSearchParams();
      const t = String(filterText ?? "").trim();
      if (t) {
        params.set("positionName", t);
      }
      try {
        const response = await fetch(
          `${listPositionsApiUrl}${params.toString() ? `?${params.toString()}` : ""}`
        );
        const data = await response.json();
        if (!response.ok) {
          showSystemErrorToast(String(data?.error ?? "").trim() || "Не удалось загрузить должности");
          return;
        }
        const items = Array.isArray(data?.items) ? data.items : [];
        setPositionOptions(
          items.map((item) => ({
            id: String(item?.id ?? "").trim(),
            name: String(item?.name ?? "").trim()
          }))
        );
      } catch {
        showSystemErrorToast("Не удалось загрузить должности");
      }
    },
    [listPositionsApiUrl, showSystemErrorToast]
  );

  const fetchBossOptions = useCallback(
    async (departUnitId, subjectEmployeeId, filterText) => {
      const ou = String(departUnitId ?? "").trim();
      const emp = String(subjectEmployeeId ?? "").trim();
      if (!ou || !emp) {
        setBossOptions((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      const params = new URLSearchParams();
      params.set("departUnitId", ou);
      params.set("employeeId", emp);
      const f = String(filterText ?? "").trim();
      if (f) {
        params.set("employeeName", f);
      }
      try {
        const response = await fetch(`${listEmployeesApiUrl}?${params.toString()}`);
        const data = await response.json();
        if (String(latestModalRef.current?.organUnitId ?? "").trim() !== ou) {
          return;
        }
        if (!response.ok) {
          showSystemErrorToast(String(data?.error ?? "").trim() || "Не удалось загрузить руководителей");
          return;
        }
        const items = Array.isArray(data?.items) ? data.items : [];
        setBossOptions(
          items.map((item) => ({
            id: String(item?.employeeId ?? "").trim(),
            name: String(item?.employeeFullName ?? "").trim()
          }))
        );
      } catch {
        if (String(latestModalRef.current?.organUnitId ?? "").trim() === ou) {
          showSystemErrorToast("Не удалось загрузить руководителей");
        }
      }
    },
    [listEmployeesApiUrl, showSystemErrorToast]
  );

  useEffect(() => {
    if (!modal.open) {
      return;
    }
    void fetchPositionOptions("");
  }, [modal.open, fetchPositionOptions]);

  useEffect(() => {
    if (!modal.open) {
      return;
    }
    const ou = String(modal.organUnitId ?? "").trim();
    const emp = String(modal.employeeId ?? "").trim();
    void fetchBossOptions(ou, emp, "");
  }, [modal.open, modal.organUnitId, modal.employeeId, fetchBossOptions]);

  useEffect(() => {
    if (!modal.open || modal.mode !== "add") {
      return;
    }
    if (pickTimerRef.current) {
      window.clearTimeout(pickTimerRef.current);
      pickTimerRef.current = 0;
    }
    const chosenEmployeeId = String(modal.employeeId ?? "").trim();
    if (chosenEmployeeId) {
      setEmployeePickOptions((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const q = String(modal.employeeNameFilter ?? "").trim();
    if (q.length < 1) {
      setEmployeePickOptions((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    pickTimerRef.current = window.setTimeout(async () => {
      const params = new URLSearchParams();
      params.set("employeeName", q);
      try {
        const response = await fetch(`${listEmployeesApiUrl}?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) {
          return;
        }
        if (String(latestModalRef.current?.employeeId ?? "").trim()) {
          return;
        }
        const items = Array.isArray(data?.items) ? data.items : [];
        const mapped = items
          .map((item) => ({
            id: String(item?.employeeId ?? "").trim(),
            name: String(item?.employeeFullName ?? "").trim()
          }))
          .filter((opt) => opt.id && opt.name && !linkedEmployeeIdsForOrg.has(opt.id));
        setEmployeePickOptions(mapped);
      } catch {
        setEmployeePickOptions([]);
      }
    }, 280);
    return () => {
      if (pickTimerRef.current) {
        window.clearTimeout(pickTimerRef.current);
      }
    };
  }, [
    modal.open,
    modal.mode,
    modal.employeeId,
    modal.employeeNameFilter,
    listEmployeesApiUrl,
    linkedEmployeeIdsKey
  ]);

  useEffect(() => {
    if (!modal.open || modal.mode !== "add") {
      return;
    }
    const linked = new Set(
      linkedEmployeeIdsKey ? linkedEmployeeIdsKey.split("|").filter(Boolean) : []
    );
    setEmployeePickOptions((prev) => {
      const next = prev.filter((o) => o.id && !linked.has(o.id));
      if (next.length === prev.length && next.every((o, i) => o.id === prev[i]?.id)) {
        return prev;
      }
      return next;
    });
  }, [linkedEmployeeIdsKey, modal.mode, modal.open]);

  const openAdd = useCallback(() => {
    const rootId = String(rootOrganUnitId ?? "").trim();
    setEmployeePickOptions([]);
    setBossOptions([]);
    setModal({
      ...INITIAL_MODAL,
      open: true,
      mode: "add",
      organUnitId: rootId
    });
    void fetchPositionOptions("");
  }, [rootOrganUnitId, fetchPositionOptions]);

  const openEdit = useCallback(
    (row) => {
      const organId = String(row?.employeeOrganId ?? "").trim();
      if (!organId) {
        showSystemErrorToast("Не удалось определить запись для редактирования");
        return;
      }
      setEmployeePickOptions([]);
      setModal({
        ...INITIAL_MODAL,
        open: true,
        mode: "edit",
        employeeOrganId: organId,
        employeeId: String(row?.employeeId ?? "").trim(),
        employeeFullName: String(row?.employeeFullName ?? "").trim(),
        organUnitId: String(row?.organUnitChildId ?? "").trim(),
        editInitialOrganUnitId: String(row?.organUnitChildId ?? "").trim(),
        employeePositionId: String(row?.employeePositionId ?? "").trim(),
        bossEmployeeId: String(row?.employeeParentId ?? "").trim()
      });
      void fetchPositionOptions("");
    },
    [fetchPositionOptions, showSystemErrorToast]
  );

  const closeModal = useCallback(() => {
    setModal(INITIAL_MODAL);
    setEmployeePickOptions([]);
  }, []);

  const saveModal = useCallback(async () => {
    const organUnitId = String(modal.organUnitId ?? "").trim();
    if (!organUnitId) {
      showSystemErrorToast("Выберите подразделение");
      return;
    }
    const employeeId = String(modal.employeeId ?? "").trim();
    if (modal.mode === "add" && !employeeId) {
      showSystemErrorToast("Выберите сотрудника");
      return;
    }
    const bossId = String(modal.bossEmployeeId ?? "").trim();
    if (bossId) {
      const bossInList = bossOptions.some((b) => String(b.id) === bossId);
      if (bossOptions.length > 0 && !bossInList) {
        showSystemErrorToast("В новом подразделении выберите руководителя заново");
        return;
      }
    }
    setSaving(true);
    try {
      const isEdit = modal.mode === "edit";
      const url = isEdit
        ? `${employeePositionBaseUrl}/${encodeURIComponent(modal.employeeOrganId)}`
        : employeePositionBaseUrl;
      const body = {
        employeeId,
        organUnitId,
        employeePositionId: String(modal.employeePositionId ?? "").trim() || null,
        bossEmployeeId: String(modal.bossEmployeeId ?? "").trim() || null
      };
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showSystemErrorToast(
          String(data?.error ?? "").trim() ||
            (isEdit ? "Не удалось сохранить запись" : "Не удалось добавить запись")
        );
        return;
      }
      const unitName =
        organUnitChoices.find((o) => String(o.id) === String(organUnitId))?.name?.trim() || "—";
      const posLabel =
        positionOptions.find((p) => String(p.id) === String(modal.employeePositionId ?? "").trim())
          ?.name?.trim() || "";
      if (typeof onEmployeeLinkUpsert === "function") {
        if (!isEdit) {
          const newLinkId = String(
            data?.item?.employeeOrganId ?? data?.item?.employee_organ_id ?? ""
          ).trim();
          if (newLinkId) {
            onEmployeeLinkUpsert({
              employeeOrganId: newLinkId,
              employeeId,
              employeeFullName: String(modal.employeeFullName ?? "").trim(),
              employeeParentId: String(modal.bossEmployeeId ?? "").trim(),
              employeePositionId: String(modal.employeePositionId ?? "").trim(),
              employeePositionName: posLabel,
              organUnitChildId: organUnitId,
              organUnitName: unitName
            });
          }
        } else {
          const existingLinkId = String(modal.employeeOrganId ?? "").trim();
          if (existingLinkId) {
            onEmployeeLinkUpsert({
              employeeOrganId: existingLinkId,
              employeeId,
              employeeFullName: String(modal.employeeFullName ?? "").trim(),
              employeeParentId: String(modal.bossEmployeeId ?? "").trim(),
              employeePositionId: String(modal.employeePositionId ?? "").trim(),
              employeePositionName: posLabel,
              organUnitChildId: organUnitId,
              organUnitName: unitName
            });
          }
        }
      }
      setFilters({ subdivision: "", fullName: "", position: "" });
      showSystemSuccessToast(isEdit ? "Сохранено" : "Добавлено");
      closeModal();
      try {
        await onRefresh?.();
      } catch {
        // повторная загрузка структуры — не блокируем UX
      }
    } catch {
      showSystemErrorToast("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [
    modal,
    allLinks,
    employeePositionBaseUrl,
    organUnitChoices,
    positionOptions,
    bossOptions,
    closeModal,
    onRefresh,
    onEmployeeLinkUpsert,
    showSystemErrorToast,
    showSystemSuccessToast
  ]);

  const confirmDelete = useCallback(async () => {
    const id = String(pendingDeleteOrganId ?? "").trim();
    if (!id) {
      return;
    }
    setPendingDeleteOrganId("");
    try {
      const response = await fetch(`${employeePositionBaseUrl}/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showSystemErrorToast(String(data?.error ?? "").trim() || "Не удалось удалить");
        return;
      }
      showSystemSuccessToast("Удалено");
      try {
        await onRefresh?.();
      } catch {
        // noop
      }
    } catch {
      showSystemErrorToast("Не удалось удалить");
    }
  }, [employeePositionBaseUrl, onRefresh, showSystemErrorToast, showSystemSuccessToast]);

  const rootReady = Boolean(String(rootOrganUnitId ?? "").trim());
  const { subPx, fullPx, posPx } = colWidthsPx;
  const fioColPx = fullPx;
  const subdivColPx = subPx;
  const displayedEmployeesCount = visibleEmployeeTreeRows.length;

  return (
    <section className="employee-card-section organization-card-structure-section organization-card-structure-employees-section">
      <div className="employee-card-section-header organization-card-structure-employees-header">
        <h3
          className="organization-card-structure-employees-h3"
          aria-label={`Сотрудники организации, отображается записей: ${displayedEmployeesCount}`}
        >
          <span className="organization-card-structure-employees-h3-main">Сотрудники организации</span>
          <span className="organization-card-structure-employees-title-parenthetical">
            {" "}
            ({displayedEmployeesCount})
          </span>
        </h3>
        <div className="employee-card-section-actions">
          <button
            type="button"
            className="panel-action-button"
            disabled={loading}
            aria-label="Очистить фильтры таблицы сотрудников организации"
            data-tooltip="Удалить фильтр"
            onClick={() => setFilters({ subdivision: "", fullName: "", position: "" })}
          >
            <IconClearFilter aria-hidden />
            <span>Удалить фильтр</span>
          </button>
          <button
            type="button"
            className="panel-action-button"
            disabled={!rootReady || loading}
            onClick={openAdd}
            aria-label="Добавить связь сотрудника с подразделением"
            data-tooltip="Добавить"
          >
            <IconPlus aria-hidden />
            <span>Добавить</span>
          </button>
        </div>
      </div>
      <div
        className={`organization-card-structure-employees-table-wrap${
          loading && visibleEmployeeTreeRows.length > 0
            ? " organization-card-structure-employees-table-wrap--stale-refresh"
            : ""
        }`}
        ref={setTableWrapNode}
        onDragOver={handleEmployeeDnDTableDragOverCapture}
      >
        <table
          className={`organization-card-structure-employees-table${
            employeeDnDDraggingKey ? " organization-card-structure-employees-table--dnd-active" : ""
          }`}
          onDragOverCapture={handleEmployeeDnDTableDragOverCapture}
        >
          <colgroup>
            <col style={{ width: `${fioColPx}px` }} />
            <col style={{ width: `${subdivColPx}px` }} />
            <col style={{ width: `${posPx}px` }} />
            <col style={{ width: `${ACTIONS_COL_PX}px` }} />
          </colgroup>
          <thead
            className={
              employeeDnDDropTargetKey === EMPLOYEE_DND_HEADER_KEY
                ? "organization-card-structure-employees-thead organization-card-structure-employees-thead--drop-target"
                : "organization-card-structure-employees-thead"
            }
            onDragOver={handleEmployeeStructureTheadDragOver}
            onDrop={handleEmployeeStructureTheadDrop}
          >
            <tr ref={employeesTheadRow1Ref}>
              {renderSortableHeader("ФИО", SORT_FIELDS.employeeFullName, "full-sub")}
              {renderSortableHeader("Подразделение", SORT_FIELDS.organUnitName, "sub-pos")}
              {renderSortableHeader("Должность", SORT_FIELDS.employeePositionName, null)}
              <th
                className="organization-card-structure-employees-actions-col"
                scope="col"
                aria-label="Действия"
              />
            </tr>
            <tr className="organization-card-structure-employees-filter-row">
              <th>
                <div className="column-filter-input-wrapper">
                  <input
                    type="text"
                    className="column-filter-input"
                    placeholder="ФИО"
                    value={filters.fullName}
                    onChange={(e) => setFilters((f) => ({ ...f, fullName: e.target.value }))}
                    aria-label="Фильтр по ФИО"
                  />
                  {String(filters.fullName ?? "").trim() !== "" ? (
                    <button
                      type="button"
                      className="column-filter-clear-button"
                      aria-label="Очистить фильтр по ФИО"
                      onClick={() => setFilters((f) => ({ ...f, fullName: "" }))}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </th>
              <th>
                <div className="column-filter-input-wrapper">
                  <input
                    type="text"
                    className="column-filter-input"
                    placeholder="Подразделение"
                    value={filters.subdivision}
                    onChange={(e) => setFilters((f) => ({ ...f, subdivision: e.target.value }))}
                    aria-label="Фильтр по подразделению"
                  />
                  {String(filters.subdivision ?? "").trim() !== "" ? (
                    <button
                      type="button"
                      className="column-filter-clear-button"
                      aria-label="Очистить фильтр по подразделению"
                      onClick={() => setFilters((f) => ({ ...f, subdivision: "" }))}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </th>
              <th>
                <div className="column-filter-input-wrapper">
                  <input
                    type="text"
                    className="column-filter-input"
                    placeholder="Должность"
                    value={filters.position}
                    onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value }))}
                    aria-label="Фильтр по должности"
                  />
                  {String(filters.position ?? "").trim() !== "" ? (
                    <button
                      type="button"
                      className="column-filter-clear-button"
                      aria-label="Очистить фильтр по должности"
                      onClick={() => setFilters((f) => ({ ...f, position: "" }))}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </th>
              <th className="organization-card-structure-employees-actions-col" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {loading &&
            visibleEmployeeTreeRows.length === 0 &&
            (allLinks.length === 0 || totalFilteredTreeCount === 0) ? (
              <tr>
                <td colSpan={4} className="organization-card-structure-status-cell">
                  Загрузка...
                </td>
              </tr>
            ) : null}
            {!loading && totalFilteredTreeCount === 0 ? (
              <tr>
                <td colSpan={4} className="organization-card-structure-status-cell">
                  Нет записей
                </td>
              </tr>
            ) : null}
            {visibleEmployeeTreeRows.map((row) => {
                const empId = String(row.employeeId ?? "").trim();
                const cardHref =
                  empId && typeof getEmployeeCardHref === "function"
                    ? String(getEmployeeCardHref(empId) ?? "").trim()
                    : "";
                const canOpenEmployeeCard = Boolean(cardHref && cardHref !== "#");
                const fullNameLabel = row.employeeFullName || "—";
                const nameCellClass =
                  "organization-card-structure-employees-cell-value organization-structure-employees-tooltip-target";

                const rowKeyStr = linkKey(row);
                const rowDnDClassParts = [];
                if (!loading && rootReady && totalFilteredTreeCount > 0) {
                  rowDnDClassParts.push("organization-card-structure-row-draggable");
                }
                if (employeeDnDDraggingKey === rowKeyStr) {
                  rowDnDClassParts.push("organization-card-structure-row-dragging");
                }
                if (employeeDnDDropTargetKey === rowKeyStr) {
                  rowDnDClassParts.push("organization-card-structure-drop-target");
                }
                const rowDnDClasses = rowDnDClassParts.join(" ");
                const isRowSelected = selectedEmployeeTreeRowKey === rowKeyStr;
                const trClassName = [rowDnDClasses, isRowSelected ? "organization-card-structure-employees-row-selected" : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr
                    key={rowKeyStr}
                    className={trClassName || undefined}
                    aria-selected={isRowSelected}
                    draggable={!loading && rootReady && totalFilteredTreeCount > 0}
                    onClick={(event) => handleEmployeeTableRowClick(event, row)}
                    onDragStart={(event) => handleEmployeeRowDragStart(row, event)}
                    onDrag={handleEmployeeRowDrag}
                    onDragEnd={handleEmployeeRowDragEnd}
                    onDragOver={(event) => handleEmployeeRowDragOver(row, event)}
                    onDrop={(event) => handleEmployeeRowDrop(row, event)}
                  >
                    <td
                      className="organization-card-structure-employees-subdiv-cell"
                      style={{ paddingLeft: `${12 + row.depth * 18}px` }}
                    >
                      <div className="organization-card-structure-name-cell-inner">
                        {row.hasChildren ? (
                          <button
                            type="button"
                            className="organization-card-structure-tree-toggle"
                            aria-expanded={!collapsedEmployeeTreeKeys.has(row.rowKey)}
                            aria-label={
                              collapsedEmployeeTreeKeys.has(row.rowKey)
                                ? "Развернуть подчинённых"
                                : "Свернуть подчинённых"
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleEmployeeTreeRowCollapse(row.rowKey);
                            }}
                          >
                            {collapsedEmployeeTreeKeys.has(row.rowKey) ? "▸" : "▾"}
                          </button>
                        ) : (
                          <span className="organization-card-structure-tree-toggle-spacer" aria-hidden />
                        )}
                        {canOpenEmployeeCard ? (
                          <a
                            href={cardHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            draggable={false}
                            className={`organization-card-structure-name-text ${nameCellClass} entity-card-hover-link`}
                            aria-label={`Открыть карточку сотрудника ${fullNameLabel} в новой вкладке`}
                            onMouseEnter={(event) => handleCellMouseEnter(event, row.employeeFullName)}
                            onMouseMove={updateCellTooltipPosition}
                            onMouseLeave={handleCellMouseLeave}
                          >
                            {fullNameLabel}
                          </a>
                        ) : (
                          <span
                            className={`organization-card-structure-name-text ${nameCellClass}`}
                            onMouseEnter={(event) => handleCellMouseEnter(event, row.employeeFullName)}
                            onMouseMove={updateCellTooltipPosition}
                            onMouseLeave={handleCellMouseLeave}
                          >
                            {fullNameLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={nameCellClass}
                        onMouseEnter={(event) => handleCellMouseEnter(event, row.organUnitName)}
                        onMouseMove={updateCellTooltipPosition}
                        onMouseLeave={handleCellMouseLeave}
                      >
                        {row.organUnitName || "—"}
                      </span>
                    </td>
                    <td>
                      <span
                        className="organization-card-structure-employees-cell-value organization-structure-employees-tooltip-target"
                        onMouseEnter={(event) => handleCellMouseEnter(event, row.employeePositionName)}
                        onMouseMove={updateCellTooltipPosition}
                        onMouseLeave={handleCellMouseLeave}
                      >
                        {row.employeePositionName || "—"}
                      </span>
                    </td>
                    <td className="organization-card-structure-employees-actions-cell">
                      <button
                        type="button"
                        className="employee-card-position-action-button"
                        aria-label="Изменить"
                        data-tooltip="Изменить"
                        onClick={() => openEdit(row)}
                      >
                        <IconPencil aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="employee-card-position-action-button"
                        aria-label="Удалить"
                        data-tooltip="Удалить"
                        onClick={() => setPendingDeleteOrganId(String(row.employeeOrganId ?? "").trim())}
                      >
                        <IconTrash aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {modal.open ? (
        <div className="modal-overlay" role="presentation">
          <div
            className="modal organization-structure-employee-link-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal.mode === "add" ? "Добавление связи" : "Редактирование связи"}
          >
            <h3 className="organization-structure-editor-modal-title">
              {modal.mode === "add" ? "Добавить сотрудника в подразделение" : "Изменить связь с подразделением"}
            </h3>
            <div className="organization-structure-editor-modal-fields">
              {modal.mode === "add" ? (
                <div
                  className={`organization-structure-editor-field organization-structure-employee-pick-field${
                    employeePickOptions.length > 0 ? " organization-structure-employee-pick-field--open" : ""
                  }`}
                >
                  <label className="employee-card-field-label" htmlFor={employeePickInputId}>
                    Сотрудник *
                  </label>
                  <div className="organization-structure-employee-pick-anchor">
                    <input
                      id={employeePickInputId}
                      type="text"
                      className="employee-card-field-input"
                      value={modal.employeeNameFilter}
                      onChange={(e) =>
                        setModal((m) => ({
                          ...m,
                          employeeNameFilter: e.target.value,
                          employeeId: "",
                          employeeFullName: ""
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setEmployeePickOptions([]);
                        }
                      }}
                      placeholder="Поиск по ФИО"
                      disabled={saving}
                      autoComplete="off"
                    />
                    {employeePickOptions.length > 0 ? (
                      <ul
                        className="organization-structure-employee-pick-list"
                        role="listbox"
                        aria-label="Сотрудники по ФИО"
                      >
                        {employeePickOptions.map((opt) => (
                          <li key={opt.id}>
                            <button
                              type="button"
                              className="organization-structure-employee-pick-option"
                              onMouseDown={(event) => {
                                event.preventDefault();
                              }}
                              onClick={() => {
                                setEmployeePickOptions([]);
                                setModal((m) => ({
                                  ...m,
                                  employeeId: opt.id,
                                  employeeFullName: opt.name,
                                  employeeNameFilter: opt.name
                                }));
                              }}
                            >
                              {opt.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="organization-structure-editor-field">
                  <span className="employee-card-field-label">Сотрудник</span>
                  <div className="organization-structure-employee-readonly">
                    {modal.employeeFullName || "—"}
                  </div>
                </div>
              )}
              <div className="organization-structure-editor-field">
                <span
                  className="employee-card-field-label"
                  id={`${organUnitComboboxListId}-organ-label`}
                >
                  Подразделение *
                </span>
                <div
                  ref={organUnitComboboxRef}
                  className="organization-structure-parent-combobox"
                >
                  <button
                    type="button"
                    className="organization-structure-parent-combobox-trigger"
                    disabled={saving || organUnitChoices.length === 0}
                    aria-haspopup="listbox"
                    aria-expanded={organUnitMenuOpen}
                    aria-controls={organUnitComboboxListId}
                    aria-labelledby={`${organUnitComboboxListId}-organ-label`}
                    onClick={() => {
                      if (!saving && organUnitChoices.length > 0) {
                        setPositionMenuOpen(false);
                        setBossMenuOpen(false);
                        setOrganUnitMenuOpen((open) => !open);
                      }
                    }}
                  >
                    <span className="organization-structure-parent-combobox-trigger-text">
                      {organUnitChoices.length === 0
                        ? "Нет доступных вариантов"
                        : organUnitChoices.find((o) => String(o.id) === String(modal.organUnitId))
                            ?.name ?? "—"}
                    </span>
                    <span className="organization-structure-parent-combobox-chevron" aria-hidden>
                      ▼
                    </span>
                  </button>
                  {organUnitMenuOpen && organUnitChoices.length > 0 ? (
                    <div
                      id={organUnitComboboxListId}
                      className="organization-structure-parent-combobox-panel"
                      role="listbox"
                      aria-label="Выбор подразделения"
                    >
                      {organUnitChoices.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          role="option"
                          aria-selected={String(o.id) === String(modal.organUnitId)}
                          className={`organization-structure-parent-combobox-option${
                            String(o.id) === String(modal.organUnitId) ? " is-selected" : ""
                          }`}
                          onClick={() => {
                            const nextId = String(o.id);
                            setModal((m) => {
                              const prevId = String(m.organUnitId ?? "").trim();
                              return {
                                ...m,
                                organUnitId: nextId,
                                ...(prevId !== nextId ? { bossEmployeeId: "" } : {})
                              };
                            });
                            setOrganUnitMenuOpen(false);
                          }}
                        >
                          {o.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="organization-structure-editor-field">
                <span
                  className="employee-card-field-label"
                  id={`${positionComboboxListId}-position-label`}
                >
                  Должность
                </span>
                <div ref={positionComboboxRef} className="organization-structure-parent-combobox">
                  <button
                    type="button"
                    className="organization-structure-parent-combobox-trigger"
                    disabled={saving}
                    aria-haspopup="listbox"
                    aria-expanded={positionMenuOpen}
                    aria-controls={positionComboboxListId}
                    aria-labelledby={`${positionComboboxListId}-position-label`}
                    onClick={() => {
                      if (!saving) {
                        setOrganUnitMenuOpen(false);
                        setBossMenuOpen(false);
                        setPositionMenuOpen((open) => !open);
                      }
                    }}
                  >
                    <span className="organization-structure-parent-combobox-trigger-text">
                      {String(modal.employeePositionId ?? "").trim()
                        ? positionOptions.find((p) => String(p.id) === String(modal.employeePositionId))?.name ??
                          "—"
                        : "—"}
                    </span>
                    <span className="organization-structure-parent-combobox-chevron" aria-hidden>
                      ▼
                    </span>
                  </button>
                  {positionMenuOpen ? (
                    <div
                      id={positionComboboxListId}
                      className="organization-structure-parent-combobox-panel"
                      role="listbox"
                      aria-label="Выбор должности"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={!String(modal.employeePositionId ?? "").trim()}
                        className={`organization-structure-parent-combobox-option${
                          !String(modal.employeePositionId ?? "").trim() ? " is-selected" : ""
                        }`}
                        onClick={() => {
                          setModal((m) => ({ ...m, employeePositionId: "" }));
                          setPositionMenuOpen(false);
                        }}
                      >
                        —
                      </button>
                      {positionOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={String(p.id) === String(modal.employeePositionId)}
                          className={`organization-structure-parent-combobox-option${
                            String(p.id) === String(modal.employeePositionId) ? " is-selected" : ""
                          }`}
                          onClick={() => {
                            setModal((m) => ({ ...m, employeePositionId: String(p.id) }));
                            setPositionMenuOpen(false);
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="organization-structure-editor-field">
                <span
                  className="employee-card-field-label"
                  id={`${bossComboboxListId}-boss-label`}
                >
                  Руководитель
                </span>
                <div ref={bossComboboxRef} className="organization-structure-parent-combobox">
                  <button
                    type="button"
                    className="organization-structure-parent-combobox-trigger"
                    disabled={saving}
                    aria-haspopup="listbox"
                    aria-expanded={bossMenuOpen}
                    aria-controls={bossComboboxListId}
                    aria-labelledby={`${bossComboboxListId}-boss-label`}
                    onClick={() => {
                      if (!saving) {
                        setOrganUnitMenuOpen(false);
                        setPositionMenuOpen(false);
                        setBossMenuOpen((open) => !open);
                      }
                    }}
                  >
                    <span className="organization-structure-parent-combobox-trigger-text">
                      {String(modal.bossEmployeeId ?? "").trim()
                        ? bossOptions.find((b) => String(b.id) === String(modal.bossEmployeeId))?.name ?? "—"
                        : "—"}
                    </span>
                    <span className="organization-structure-parent-combobox-chevron" aria-hidden>
                      ▼
                    </span>
                  </button>
                  {bossMenuOpen ? (
                    <div
                      id={bossComboboxListId}
                      className="organization-structure-parent-combobox-panel"
                      role="listbox"
                      aria-label="Выбор руководителя"
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={!String(modal.bossEmployeeId ?? "").trim()}
                        className={`organization-structure-parent-combobox-option${
                          !String(modal.bossEmployeeId ?? "").trim() ? " is-selected" : ""
                        }`}
                        onClick={() => {
                          setModal((m) => ({ ...m, bossEmployeeId: "" }));
                          setBossMenuOpen(false);
                        }}
                      >
                        —
                      </button>
                      {bossOptions.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          role="option"
                          aria-selected={String(b.id) === String(modal.bossEmployeeId)}
                          className={`organization-structure-parent-combobox-option${
                            String(b.id) === String(modal.bossEmployeeId) ? " is-selected" : ""
                          }`}
                          onClick={() => {
                            setModal((m) => ({ ...m, bossEmployeeId: String(b.id) }));
                            setBossMenuOpen(false);
                          }}
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="confirm-actions">
              <button type="button" className="modal-close-button" onClick={() => void saveModal()} disabled={saving}>
                <span>{saving ? "Сохранение..." : "Сохранить"}</span>
              </button>
              <button type="button" className="modal-close-button secondary" onClick={closeModal} disabled={saving}>
                <IconClose aria-hidden />
                <span>Отмена</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteOrganId ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Удаление связи">
            <p className="result-message">Удалить связь сотрудника с подразделением?</p>
            <div className="confirm-actions">
              <button type="button" className="modal-close-button" onClick={() => void confirmDelete()}>
                Да
              </button>
              <button
                type="button"
                className="modal-close-button secondary"
                onClick={() => setPendingDeleteOrganId("")}
              >
                <IconClose aria-hidden />
                <span>Нет</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {cellTooltip.visible && typeof document !== "undefined"
        ? createPortal(
            <div
              className="custom-cell-tooltip organization-structure-employees-cell-tooltip"
              style={{ left: `${cellTooltip.x}px`, top: `${cellTooltip.y}px` }}
              role="tooltip"
            >
              {cellTooltip.text}
            </div>,
            document.body
          )
        : null}
    </section>
  );
});

OrganizationStructureEmployeesPanel.displayName = "OrganizationStructureEmployeesPanel";

export default OrganizationStructureEmployeesPanel;
