import { useCallback, useEffect, useRef, useState } from "react";
import ExportToExcelButton from "./components/ExportToExcelButton";
import TableColumnSettingsPanel from "./components/TableColumnSettingsPanel";

const THEME_STORAGE_KEY = "employees.dark-theme-enabled";
const SORT_RULES_STORAGE_KEY = "employees.sort-rules";
const PAGE_SIZE_STORAGE_KEY = "employees.page-size";
const FILTERS_STORAGE_KEY = "employees.filters";
const COLUMN_WIDTHS_STORAGE_KEY = "employees.column-widths";
const COLUMN_SETTINGS_STORAGE_KEY = "employees.column-settings";
const RELATION_COLUMN_WIDTHS_STORAGE_KEY = "employees.relation-column-widths";
const RELATION_SORT_RULES_STORAGE_KEY = "employees.relation-sort-rules";
const RELATIONS_PAGE_SORT_RULES_STORAGE_KEY = "relations-page.sort-rules";
const RELATIONS_PAGE_FILTERS_STORAGE_KEY = "relations-page.filters";
const RELATIONS_PAGE_COLUMN_WIDTHS_STORAGE_KEY = "relations-page.column-widths";
const RELATIONS_PAGE_COLUMN_SETTINGS_STORAGE_KEY = "relations-page.column-settings";
const ORGANIZATIONS_SORT_RULES_STORAGE_KEY = "organizations.sort-rules";
const ORGANIZATIONS_FILTERS_STORAGE_KEY = "organizations.filters";
const ORGANIZATIONS_COLUMN_WIDTHS_STORAGE_KEY = "organizations.column-widths";
const ORGANIZATIONS_COLUMN_SETTINGS_STORAGE_KEY = "organizations.column-settings";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3003").replace(/\/+$/, "");
const EMPLOYEES_API_URL = `${API_BASE_URL}/api/employees`;
const ORGANIZATIONS_API_URL = `${API_BASE_URL}/api/organizations`;
const RELATIONS_API_URL = `${API_BASE_URL}/api/relations`;
const EMPLOYEES_IMPORT_API_URL = `${API_BASE_URL}/api/employees/import`;
const LIST_ORGANIZATIONS_API_URL = `${API_BASE_URL}/api/list_organizations`;
const LIST_RELATIONS_API_URL = `${API_BASE_URL}/api/list_relations`;
const LIST_PRODUCT_GROUPS_API_URL = `${API_BASE_URL}/api/list_product_groups`;
const LIST_POSITIONS_API_URL = `${API_BASE_URL}/api/list_positions`;
const LIST_EMPLOYEES_API_URL = `${API_BASE_URL}/api/list_employees`;
const ALLOWED_SORT_FIELDS = new Set([
  "fullName",
  "sapId",
  "surname",
  "firstName",
  "middleName",
  "email",
  "personalNumber",
  "phoneNumber",
  "status",
  "organName",
  "departName",
  "positionName",
  "bossName"
]);
const ALLOWED_SORT_DIRECTIONS = new Set(["ASC", "DESC"]);
const ALLOWED_PAGE_SIZES = new Set([20, 50, 100]);
const PAGE_IDS = {
  EMPLOYEES: "employees",
  ORGANIZATIONS: "organizations",
  EMPLOYEE_RELATIONS: "employee-relations"
};
const PAGE_TITLES = {
  [PAGE_IDS.EMPLOYEES]: "Список сотрудников",
  [PAGE_IDS.ORGANIZATIONS]: "Список организаций",
  [PAGE_IDS.EMPLOYEE_RELATIONS]: "Список связей сотрудников"
};
const RELATION_COLUMNS = [
  { key: "organName", title: "Организация" },
  { key: "relationName", title: "Тип отношения" },
  { key: "defaultFlag", title: "Основное отношение" },
  { key: "salesOrganName", title: "Сбытовая организация" },
  { key: "productGroupName", title: "Группа продуктов" }
];
const DEFAULT_RELATION_COLUMN_WIDTHS = {
  organName: 220,
  relationName: 220,
  defaultFlag: 160,
  salesOrganName: 220,
  productGroupName: 220
};
const INITIAL_RELATION_FILTERS = {
  organName: "",
  relationName: "",
  defaultFlag: "",
  salesOrganName: "",
  productGroupName: ""
};
const INITIAL_NEW_RELATION_FORM = {
  employeeName: "",
  employeeId: "",
  employeeNameFilter: "",
  organName: "",
  organSapId: "",
  organInn: "",
  organKpp: "",
  organOgrn: "",
  organFullAddress: "",
  organUnitId: "",
  relationName: "",
  relationTypeId: "",
  salesOrganName: "",
  salesOrganizationId: "",
  defaultFlag: false,
  productGroupName: "",
  productGroupsId: "",
  organNameFilter: "",
  relationNameFilter: "",
  salesOrganNameFilter: "",
  productGroupNameFilter: ""
};
const INITIAL_NEW_POSITION_FORM = {
  organName: "",
  organUnitId: "",
  departments: [],
  departName: "",
  departUnitId: "",
  positionName: "",
  employeePositionId: "",
  bossName: "",
  bossEmployeeId: "",
  organNameFilter: "",
  departNameFilter: "",
  positionNameFilter: "",
  bossNameFilter: ""
};
const INITIAL_EMPLOYEE_CARD_EDIT_FORM = {
  surname: "",
  firstName: "",
  middleName: "",
  email: "",
  phoneNumber: "",
  sapId: "",
  personalNumber: "",
  status: "ACTIVE"
};
const ALL_COLUMNS = [
  { key: "sapId", title: "sap_id", sortField: "sapId" },
  { key: "fullName", title: "ФИО сотрудника", sortField: "fullName" },
  { key: "surname", title: "Фамилия", sortField: "surname" },
  { key: "firstName", title: "Имя", sortField: "firstName" },
  { key: "middleName", title: "Отчество", sortField: "middleName" },
  { key: "email", title: "Почта", sortField: "email" },
  { key: "personalNumber", title: "Табельный №", sortField: "personalNumber" },
  { key: "phoneNumber", title: "Телефон", sortField: "phoneNumber" },
  { key: "status", title: "Статус", sortField: "status" },
  { key: "organName", title: "Организация", sortField: "organName" },
  { key: "departName", title: "Подразделение", sortField: "departName" },
  { key: "positionName", title: "Должность", sortField: "positionName" },
  { key: "bossName", title: "Руководитель", sortField: "bossName" }
];
const ORGANIZATION_COLUMNS = [
  { key: "sapId", title: "sap_id", sortField: "sapId" },
  { key: "name", title: "Наименование", sortField: "name" },
  { key: "shName", title: "Краткое наименование", sortField: "shName" },
  { key: "inn", title: "ИНН", sortField: "inn" },
  { key: "kpp", title: "КПП", sortField: "kpp" },
  { key: "ogrn", title: "ОГРН", sortField: "ogrn" },
  { key: "okpo", title: "ОКПО", sortField: "okpo" },
  { key: "signResident", title: "Резидент", sortField: "signResident" },
  { key: "countryName", title: "Страна", sortField: "countryName" },
  { key: "address", title: "Адрес", sortField: "address" }
];
const RELATIONS_PAGE_COLUMNS = [
  { key: "employeeName", title: "ФИО сотрудника", sortField: "employeeName" },
  { key: "organName", title: "Организация", sortField: "organName" },
  { key: "relationName", title: "Тип отношения", sortField: "relationName" },
  { key: "defaultFlag", title: "Основное отношение", sortField: "defaultFlag" },
  { key: "salesOrganName", title: "Сбытовая организация", sortField: "salesOrganName" },
  { key: "productGroupName", title: "Группа продуктов", sortField: "productGroupName" }
];
const RELATIONS_PAGE_DEFAULT_SORT_RULES = [{ field: "employeeName", direction: "ASC" }];
const INITIAL_FILTERS = {
  sapId: "",
  fullName: "",
  surname: "",
  firstName: "",
  middleName: "",
  email: "",
  personalNumber: "",
  phoneNumber: "",
  status: "",
  organName: "",
  departName: "",
  positionName: "",
  bossName: ""
};
const ORGANIZATION_INITIAL_FILTERS = {
  sapId: "",
  name: "",
  shName: "",
  inn: "",
  kpp: "",
  ogrn: "",
  okpo: "",
  signResident: "",
  countryName: "",
  address: ""
};
const RELATIONS_PAGE_INITIAL_FILTERS = {
  employeeName: "",
  organName: "",
  relationName: "",
  defaultFlag: "",
  salesOrganName: "",
  productGroupName: ""
};
const DEFAULT_COLUMN_WIDTHS = {
  sapId: 130,
  fullName: 240,
  surname: 170,
  firstName: 150,
  middleName: 170,
  email: 260,
  personalNumber: 140,
  phoneNumber: 170,
  status: 130,
  organName: 220,
  departName: 220,
  positionName: 220,
  bossName: 220
};

const ORGANIZATION_DEFAULT_COLUMN_WIDTHS = {
  sapId: 130,
  name: 320,
  shName: 240,
  inn: 140,
  kpp: 140,
  ogrn: 160,
  okpo: 140,
  signResident: 130,
  countryName: 240,
  address: 320
};
const RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS = {
  employeeName: 260,
  organName: 220,
  relationName: 220,
  defaultFlag: 180,
  salesOrganName: 220,
  productGroupName: 220
};
const MIN_COLUMN_WIDTH = 90;
const RELATION_COMBO_VISIBLE_OPTION_COUNT = 15;
const RELATION_COMBO_OPTION_HEIGHT_PX = 32;
const RELATION_COMBO_MENU_PADDING_PX = 12;
const URL_EMPLOYEE_ID_PARAM = "employeeId";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeEmployeeId = (value) => {
  const normalized = String(value ?? "").trim();
  return UUID_PATTERN.test(normalized) ? normalized : "";
};

const getEmployeeIdFromUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }
  const params = new URLSearchParams(window.location.search);
  return (
    normalizeEmployeeId(params.get(URL_EMPLOYEE_ID_PARAM)) ||
    normalizeEmployeeId(params.get("employee_id"))
  );
};

const setEmployeeIdToUrl = (employeeId) => {
  if (typeof window === "undefined") {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const normalized = normalizeEmployeeId(employeeId);
  if (normalized) {
    params.set(URL_EMPLOYEE_ID_PARAM, normalized);
  } else {
    params.delete(URL_EMPLOYEE_ID_PARAM);
    params.delete("employee_id");
  }
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
};

const buildEmployeeCardUrl = (employeeId) => {
  if (typeof window === "undefined") {
    return "#";
  }
  const normalized = normalizeEmployeeId(employeeId);
  if (!normalized) {
    return "#";
  }
  const params = new URLSearchParams();
  params.set(URL_EMPLOYEE_ID_PARAM, normalized);
  return `${window.location.pathname}?${params.toString()}`;
};

const hasAnyEmployeeListFilter = (filters) =>
  Object.values(filters ?? {}).some((value) => String(value ?? "").trim() !== "");

const normalizeUiText = (value) =>
  String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const snakeToCamel = (value) =>
  String(value ?? "").replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const toCamelApiPayload = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => toCamelApiPayload(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [snakeToCamel(key), toCamelApiPayload(nestedValue)])
    );
  }
  return value;
};

const normalizeEmployeePositionItem = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const source = value;
  return {
    ...source,
    employeeOrganId: String(source.employeeOrganId ?? source.employee_organ_id ?? "").trim(),
    bossId: String(source.bossId ?? source.boss_id ?? "").trim(),
    bossName: normalizeUiText(source.bossName ?? source.boss_name),
    organName: normalizeUiText(source.organName ?? source.organ_name),
    departName: normalizeUiText(source.departName ?? source.depart_name),
    departUnitId: String(source.departUnitId ?? source.depart_unit_id ?? "").trim(),
    positionId: String(source.positionId ?? source.position_id ?? "").trim(),
    positionName: normalizeUiText(source.positionName ?? source.position_name),
    organSapId: normalizeUiText(source.organSapId ?? source.organ_sap_id),
    organInn: normalizeUiText(source.organInn ?? source.organ_inn),
    organKpp: normalizeUiText(source.organKpp ?? source.organ_kpp),
    organOgrn: normalizeUiText(source.organOgrn ?? source.organ_ogrn),
    organFullAddress: normalizeUiText(source.organFullAddress ?? source.organ_full_address)
  };
};

const normalizeRelationListItem = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const source = value;
  return {
    ...source,
    relationId: String(source.relationId ?? source.relation_id ?? "").trim(),
    employeeId: String(source.employeeId ?? source.employee_id ?? "").trim(),
    employeeName: normalizeUiText(source.employeeName ?? source.employee_name),
    organName: normalizeUiText(source.organName ?? source.organ_name),
    relationName: normalizeUiText(source.relationName ?? source.relation_name),
    salesOrganName: normalizeUiText(source.salesOrganName ?? source.sales_organ_name),
    productGroupName: normalizeUiText(source.productGroupName ?? source.product_group_name),
    defaultFlag:
      source.defaultFlag === true ||
      String(source.defaultFlag ?? source.default_flag ?? "")
        .trim()
        .toLowerCase() === "true"
  };
};
const DEFAULT_COLUMN_SETTINGS = ALL_COLUMNS.map((column) => ({
  key: column.key,
  visible: true,
  pin: "none"
}));
const ORGANIZATION_DEFAULT_COLUMN_SETTINGS = ORGANIZATION_COLUMNS.map((column) => ({
  key: column.key,
  visible: true,
  pin: "none"
}));
const RELATIONS_PAGE_DEFAULT_COLUMN_SETTINGS = RELATIONS_PAGE_COLUMNS.map((column) => ({
  key: column.key,
  visible: true,
  pin: "none"
}));
const ORGANIZATION_SORT_FIELDS = new Set(ORGANIZATION_COLUMNS.map((column) => column.sortField));
const RELATIONS_PAGE_SORT_FIELDS = new Set(RELATIONS_PAGE_COLUMNS.map((column) => column.sortField));

function parseStoredColumnWidths() {
  if (typeof window === "undefined") {
    return DEFAULT_COLUMN_WIDTHS;
  }

  const rawValue = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_COLUMN_WIDTHS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return DEFAULT_COLUMN_WIDTHS;
    }

    const normalized = { ...DEFAULT_COLUMN_WIDTHS };
    for (const key of Object.keys(DEFAULT_COLUMN_WIDTHS)) {
      const value = Number(parsed[key]);
      if (Number.isFinite(value) && value >= MIN_COLUMN_WIDTH) {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return DEFAULT_COLUMN_WIDTHS;
  }
}

function parseStoredRelationColumnWidths() {
  if (typeof window === "undefined") {
    return DEFAULT_RELATION_COLUMN_WIDTHS;
  }

  const rawValue = window.localStorage.getItem(RELATION_COLUMN_WIDTHS_STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_RELATION_COLUMN_WIDTHS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return DEFAULT_RELATION_COLUMN_WIDTHS;
    }

    const normalized = { ...DEFAULT_RELATION_COLUMN_WIDTHS };
    for (const key of Object.keys(DEFAULT_RELATION_COLUMN_WIDTHS)) {
      const value = Number(parsed[key]);
      if (Number.isFinite(value) && value >= MIN_COLUMN_WIDTH) {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return DEFAULT_RELATION_COLUMN_WIDTHS;
  }
}

function parseStoredColumnSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_COLUMN_SETTINGS;
  }

  const rawValue = window.localStorage.getItem(COLUMN_SETTINGS_STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_COLUMN_SETTINGS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return DEFAULT_COLUMN_SETTINGS;
    }

    const byKey = new Map();
    const normalized = [];
    for (const item of parsed) {
      const key = String(item?.key ?? "").trim();
      const visible = item?.visible !== false;
      const pin = item?.pin === "left" || item?.pin === "right" ? item.pin : "none";
      if (DEFAULT_COLUMN_WIDTHS[key] !== undefined && !byKey.has(key)) {
        const setting = { key, visible, pin };
        byKey.set(key, setting);
        normalized.push(setting);
      }
    }

    for (const column of ALL_COLUMNS) {
      if (!byKey.has(column.key)) {
        normalized.push({ key: column.key, visible: true, pin: "none" });
      }
    }

    return normalized.length > 0 ? normalized : DEFAULT_COLUMN_SETTINGS;
  } catch {
    return DEFAULT_COLUMN_SETTINGS;
  }
}

function parseStoredFilters() {
  if (typeof window === "undefined") {
    return INITIAL_FILTERS;
  }

  const rawValue = window.localStorage.getItem(FILTERS_STORAGE_KEY);
  if (!rawValue) {
    return INITIAL_FILTERS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return INITIAL_FILTERS;
    }

    return {
      sapId: String(parsed.sapId ?? ""),
      fullName: String(parsed.fullName ?? ""),
      surname: String(parsed.surname ?? ""),
      firstName: String(parsed.firstName ?? ""),
      middleName: String(parsed.middleName ?? ""),
      email: String(parsed.email ?? ""),
      personalNumber: String(parsed.personalNumber ?? ""),
      phoneNumber: String(parsed.phoneNumber ?? ""),
      organName: String(parsed.organName ?? ""),
      departName: String(parsed.departName ?? ""),
      positionName: String(parsed.positionName ?? ""),
      status:
        parsed.status === "ACTIVE" || parsed.status === "INACTIVE"
          ? parsed.status
          : ""
    };
  } catch {
    return INITIAL_FILTERS;
  }
}

function parseStoredSortRules() {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(SORT_RULES_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized = [];
    const seenFields = new Set();
    for (const item of parsed) {
      const field = snakeToCamel(String(item?.field ?? "").trim());
      const direction = String(item?.direction ?? "")
        .trim()
        .toUpperCase();
      if (!ALLOWED_SORT_FIELDS.has(field) || !ALLOWED_SORT_DIRECTIONS.has(direction) || seenFields.has(field)) {
        continue;
      }
      normalized.push({ field, direction });
      seenFields.add(field);
    }
    if (normalized.length === 1 && normalized[0].field === "fullName" && normalized[0].direction === "ASC") {
      return [];
    }
    return normalized;
  } catch {
    return [];
  }
}

function parseStoredRelationSortRules() {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(RELATION_SORT_RULES_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const allowedRelationSortFields = new Set(RELATION_COLUMNS.map((column) => column.key));
    return parsed.filter((item) => {
      const field = snakeToCamel(String(item?.field ?? "").trim());
      const direction = String(item?.direction ?? "")
        .trim()
        .toUpperCase();
      return allowedRelationSortFields.has(field) && ALLOWED_SORT_DIRECTIONS.has(direction);
    });
  } catch {
    return [];
  }
}

function parseStoredOrganizationSortRules() {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(ORGANIZATIONS_SORT_RULES_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized = [];
    const seenFields = new Set();
    for (const item of parsed) {
      const field = snakeToCamel(String(item?.field ?? "").trim());
      const direction = String(item?.direction ?? "")
        .trim()
        .toUpperCase();
      if (
        !ORGANIZATION_SORT_FIELDS.has(field) ||
        !ALLOWED_SORT_DIRECTIONS.has(direction) ||
        seenFields.has(field)
      ) {
        continue;
      }
      normalized.push({ field, direction });
      seenFields.add(field);
    }
    if (normalized.length === 1 && normalized[0].field === "name" && normalized[0].direction === "ASC") {
      return [];
    }
    return normalized;
  } catch {
    return [];
  }
}

function parseStoredOrganizationFilters() {
  if (typeof window === "undefined") {
    return ORGANIZATION_INITIAL_FILTERS;
  }

  const rawValue = window.localStorage.getItem(ORGANIZATIONS_FILTERS_STORAGE_KEY);
  if (!rawValue) {
    return ORGANIZATION_INITIAL_FILTERS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return ORGANIZATION_INITIAL_FILTERS;
    }

    return {
      sapId: String(parsed.sapId ?? ""),
      name: String(parsed.name ?? ""),
      shName: String(parsed.shName ?? ""),
      inn: String(parsed.inn ?? ""),
      kpp: String(parsed.kpp ?? ""),
      ogrn: String(parsed.ogrn ?? ""),
      okpo: String(parsed.okpo ?? ""),
      signResident:
        parsed.signResident === "ДА" || parsed.signResident === "НЕТ"
          ? String(parsed.signResident)
          : "",
      countryName: String(parsed.countryName ?? ""),
      address: String(parsed.address ?? "")
    };
  } catch {
    return ORGANIZATION_INITIAL_FILTERS;
  }
}

function parseStoredOrganizationColumnWidths() {
  if (typeof window === "undefined") {
    return ORGANIZATION_DEFAULT_COLUMN_WIDTHS;
  }

  const rawValue = window.localStorage.getItem(ORGANIZATIONS_COLUMN_WIDTHS_STORAGE_KEY);
  if (!rawValue) {
    return ORGANIZATION_DEFAULT_COLUMN_WIDTHS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return ORGANIZATION_DEFAULT_COLUMN_WIDTHS;
    }

    const normalized = { ...ORGANIZATION_DEFAULT_COLUMN_WIDTHS };
    for (const key of Object.keys(ORGANIZATION_DEFAULT_COLUMN_WIDTHS)) {
      const value = Number(parsed[key]);
      if (Number.isFinite(value) && value >= MIN_COLUMN_WIDTH) {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return ORGANIZATION_DEFAULT_COLUMN_WIDTHS;
  }
}

function parseStoredOrganizationColumnSettings() {
  if (typeof window === "undefined") {
    return ORGANIZATION_DEFAULT_COLUMN_SETTINGS;
  }

  const rawValue = window.localStorage.getItem(ORGANIZATIONS_COLUMN_SETTINGS_STORAGE_KEY);
  if (!rawValue) {
    return ORGANIZATION_DEFAULT_COLUMN_SETTINGS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return ORGANIZATION_DEFAULT_COLUMN_SETTINGS;
    }

    const byKey = new Map();
    const normalized = [];
    for (const item of parsed) {
      const key = String(item?.key ?? "").trim();
      const visible = item?.visible !== false;
      const pin = item?.pin === "left" || item?.pin === "right" ? item.pin : "none";
      if (ORGANIZATION_DEFAULT_COLUMN_WIDTHS[key] !== undefined && !byKey.has(key)) {
        const setting = { key, visible, pin };
        byKey.set(key, setting);
        normalized.push(setting);
      }
    }

    for (const column of ORGANIZATION_COLUMNS) {
      if (!byKey.has(column.key)) {
        normalized.push({ key: column.key, visible: true, pin: "none" });
      }
    }

    return normalized.length > 0 ? normalized : ORGANIZATION_DEFAULT_COLUMN_SETTINGS;
  } catch {
    return ORGANIZATION_DEFAULT_COLUMN_SETTINGS;
  }
}

function parseStoredRelationsPageSortRules() {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(RELATIONS_PAGE_SORT_RULES_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized = [];
    const seenFields = new Set();
    for (const item of parsed) {
      const field = snakeToCamel(String(item?.field ?? "").trim());
      const direction = String(item?.direction ?? "")
        .trim()
        .toUpperCase();
      if (
        !RELATIONS_PAGE_SORT_FIELDS.has(field) ||
        !ALLOWED_SORT_DIRECTIONS.has(direction) ||
        seenFields.has(field)
      ) {
        continue;
      }
      normalized.push({ field, direction });
      seenFields.add(field);
    }
    if (
      normalized.length === 1 &&
      normalized[0].field === "employeeName" &&
      normalized[0].direction === "ASC"
    ) {
      return [];
    }
    return normalized;
  } catch {
    return [];
  }
}

function parseStoredRelationsPageFilters() {
  if (typeof window === "undefined") {
    return RELATIONS_PAGE_INITIAL_FILTERS;
  }

  const rawValue = window.localStorage.getItem(RELATIONS_PAGE_FILTERS_STORAGE_KEY);
  if (!rawValue) {
    return RELATIONS_PAGE_INITIAL_FILTERS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return RELATIONS_PAGE_INITIAL_FILTERS;
    }

    return {
      employeeName: String(parsed.employeeName ?? ""),
      organName: String(parsed.organName ?? ""),
      relationName: String(parsed.relationName ?? ""),
      defaultFlag:
        parsed.defaultFlag === "true" || parsed.defaultFlag === "false" ? String(parsed.defaultFlag) : "",
      salesOrganName: String(parsed.salesOrganName ?? ""),
      productGroupName: String(parsed.productGroupName ?? "")
    };
  } catch {
    return RELATIONS_PAGE_INITIAL_FILTERS;
  }
}

function parseStoredRelationsPageColumnWidths() {
  if (typeof window === "undefined") {
    return RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS;
  }

  const rawValue = window.localStorage.getItem(RELATIONS_PAGE_COLUMN_WIDTHS_STORAGE_KEY);
  if (!rawValue) {
    return RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS;
    }

    const normalized = { ...RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS };
    for (const key of Object.keys(RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS)) {
      const value = Number(parsed[key]);
      if (Number.isFinite(value) && value >= MIN_COLUMN_WIDTH) {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS;
  }
}

function parseStoredRelationsPageColumnSettings() {
  if (typeof window === "undefined") {
    return RELATIONS_PAGE_DEFAULT_COLUMN_SETTINGS;
  }

  const rawValue = window.localStorage.getItem(RELATIONS_PAGE_COLUMN_SETTINGS_STORAGE_KEY);
  if (!rawValue) {
    return RELATIONS_PAGE_DEFAULT_COLUMN_SETTINGS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return RELATIONS_PAGE_DEFAULT_COLUMN_SETTINGS;
    }

    const byKey = new Map();
    const normalized = [];
    for (const item of parsed) {
      const key = String(item?.key ?? "").trim();
      const visible = item?.visible !== false;
      const pin = item?.pin === "left" || item?.pin === "right" ? item.pin : "none";
      if (RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS[key] !== undefined && !byKey.has(key)) {
        const setting = { key, visible, pin };
        byKey.set(key, setting);
        normalized.push(setting);
      }
    }

    for (const column of RELATIONS_PAGE_COLUMNS) {
      if (!byKey.has(column.key)) {
        normalized.push({ key: column.key, visible: true, pin: "none" });
      }
    }

    return normalized.length > 0 ? normalized : RELATIONS_PAGE_DEFAULT_COLUMN_SETTINGS;
  } catch {
    return RELATIONS_PAGE_DEFAULT_COLUMN_SETTINGS;
  }
}

function compareUtf8ByteOrder(left, right) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(String(left ?? ""));
  const rightBytes = encoder.encode(String(right ?? ""));
  const minLength = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < minLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) {
      return leftBytes[index] - rightBytes[index];
    }
  }
  return leftBytes.length - rightBytes.length;
}

function getEmployeeDerivedPositionData(row) {
  const positions = Array.isArray(row?.positions) ? row.positions : [];
  const formatDetailedOrganTooltip = (position) => {
    const organName = normalizeUiText(position?.organName);
    const sapId = normalizeUiText(position?.organSapId);
    const inn = normalizeUiText(position?.organInn);
    const kpp = normalizeUiText(position?.organKpp);
    const ogrn = normalizeUiText(position?.organOgrn);
    const fullAddress = normalizeUiText(position?.organFullAddress);

    if (!organName) {
      return "";
    }

    const lines = [sapId ? `${organName} (${sapId})` : organName];
    const innKppValues = [inn, kpp].filter(Boolean);
    if (innKppValues.length > 0) {
      lines.push(`ИНН/КПП ${innKppValues.join(" / ")}`);
    }
    if (ogrn) {
      lines.push(`ОГРН ${ogrn}`);
    }
    if (fullAddress) {
      lines.push(fullAddress);
    }
    return lines.join("\n");
  };

  if (positions.length === 0) {
    return {
      organName: "",
      departName: "",
      positionName: "",
      bossName: "",
      organTooltipText: "",
      organNamesForTooltip: [],
      departNamesForTooltip: []
    };
  }

  if (positions.length === 1) {
    return {
      organName: String(positions[0]?.organName ?? ""),
      departName: String(positions[0]?.departName ?? ""),
      positionName: String(positions[0]?.positionName ?? ""),
      bossName: String(positions[0]?.bossName ?? ""),
      organTooltipText: formatDetailedOrganTooltip(positions[0]),
      organNamesForTooltip: [],
      departNamesForTooltip: []
    };
  }

  const organNames = positions
    .map((position) => String(position?.organName ?? "").trim())
    .filter(Boolean);
  const uniqueSortedOrganNames = Array.from(new Set(organNames)).sort(compareUtf8ByteOrder);

  const departNames = positions
    .map((position) => String(position?.departName ?? "").trim())
    .filter(Boolean);
  const uniqueSortedDepartNames = Array.from(new Set(departNames)).sort(compareUtf8ByteOrder);

  const organDisplayValue =
    uniqueSortedOrganNames.length <= 1
      ? (uniqueSortedOrganNames[0] ?? "")
      : `организаций: ${uniqueSortedOrganNames.length}`;
  const departDisplayValue =
    uniqueSortedDepartNames.length <= 1
      ? (uniqueSortedDepartNames[0] ?? "")
      : `подразделений: ${uniqueSortedDepartNames.length}`;

  return {
    organName: organDisplayValue,
    departName: departDisplayValue,
    positionName: "",
    bossName: "",
    organTooltipText: "",
    organNamesForTooltip: uniqueSortedOrganNames.length > 1 ? uniqueSortedOrganNames : [],
    departNamesForTooltip: uniqueSortedDepartNames.length > 1 ? uniqueSortedDepartNames : []
  };
}

function normalizeColumnSettingsForColumns(currentSettings, columns) {
  const allowedKeys = new Set(columns.map((column) => column.key));
  const settingsByKey = new Map(
    (Array.isArray(currentSettings) ? currentSettings : []).map((item) => [
      item?.key,
      {
        key: item?.key,
        visible: item?.visible !== false,
        pin: item?.pin === "left" || item?.pin === "right" ? item.pin : "none"
      }
    ])
  );

  const normalized = [];
  for (const item of Array.isArray(currentSettings) ? currentSettings : []) {
    const key = String(item?.key ?? "").trim();
    if (!allowedKeys.has(key)) {
      continue;
    }
    if (!normalized.some((entry) => entry.key === key)) {
      normalized.push(settingsByKey.get(key));
    }
  }

  for (const column of columns) {
    if (!normalized.some((entry) => entry.key === column.key)) {
      normalized.push({ key: column.key, visible: true, pin: "none" });
    }
  }

  return normalized;
}

function parseFileNameFromDisposition(dispositionHeaderValue, fallbackName) {
  const fallback = String(fallbackName || "export.xlsx");
  const headerValue = String(dispositionHeaderValue || "");

  const utf8Match = headerValue.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return fallback;
    }
  }

  const asciiMatch = headerValue.match(/filename\s*=\s*"([^"]+)"/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return fallback;
}

function App() {
  const EMPLOYEE_CARD_TABS = {
    MAIN: "main",
    RELATIONS: "relations"
  };
  const formatNow = () => {
    const now = new Date();
    const time = now.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const date = now.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    return { time, date };
  };

  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [stats, setStats] = useState(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [logFileUrl, setLogFileUrl] = useState("");
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isAdministrationOpen, setIsAdministrationOpen] = useState(false);
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(true);
  const [activePage, setActivePage] = useState(PAGE_IDS.EMPLOYEES);
  const [isDarkThemeEnabled, setIsDarkThemeEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(THEME_STORAGE_KEY) === "true";
  });
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageJumpInput, setPageJumpInput] = useState("1");
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window === "undefined") {
      return 20;
    }

    const stored = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return ALLOWED_PAGE_SIZES.has(stored) ? stored : 20;
  });
  const [totalCount, setTotalCount] = useState(0);
  const [employeesListRefreshToken, setEmployeesListRefreshToken] = useState(0);
  const [sortRules, setSortRules] = useState(() => parseStoredSortRules());
  const [filters, setFilters] = useState(() => parseStoredFilters());
  const [debouncedEmployeeFilters, setDebouncedEmployeeFilters] = useState(() => parseStoredFilters());
  const [debouncedOrganizationFilters, setDebouncedOrganizationFilters] = useState(
    ORGANIZATION_INITIAL_FILTERS
  );
  const [debouncedRelationsPageFilters, setDebouncedRelationsPageFilters] = useState(
    RELATIONS_PAGE_INITIAL_FILTERS
  );
  const [columnWidths, setColumnWidths] = useState(() => parseStoredColumnWidths());
  const [columnSettings, setColumnSettings] = useState(() => parseStoredColumnSettings());
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployeeSnapshot, setSelectedEmployeeSnapshot] = useState(null);
  const [isEmployeeCardPanelOpen, setIsEmployeeCardPanelOpen] = useState(false);
  const [isCreatingEmployeeCard, setIsCreatingEmployeeCard] = useState(false);
  const [employeeCardEditForm, setEmployeeCardEditForm] = useState(INITIAL_EMPLOYEE_CARD_EDIT_FORM);
  const [linkedEmployeeIdFilter, setLinkedEmployeeIdFilter] = useState(() => getEmployeeIdFromUrl());
  const [isLinkedEmployeeLookupActive, setIsLinkedEmployeeLookupActive] = useState(
    () => Boolean(getEmployeeIdFromUrl())
  );
  const [hasLinkedEmployeeLookupAttempt, setHasLinkedEmployeeLookupAttempt] = useState(false);
  const [activeEmployeeCardTab, setActiveEmployeeCardTab] = useState(EMPLOYEE_CARD_TABS.MAIN);
  const [isEmployeeCardEditMode, setIsEmployeeCardEditMode] = useState(false);
  const [employeeRelations, setEmployeeRelations] = useState([]);
  const [employeeRelationsLoading, setEmployeeRelationsLoading] = useState(false);
  const [employeeRelationsError, setEmployeeRelationsError] = useState("");
  const [systemErrorToast, setSystemErrorToast] = useState({ id: 0, message: "" });
  const [isSystemErrorToastClosing, setIsSystemErrorToastClosing] = useState(false);
  const [employeeRelationsSortRules, setEmployeeRelationsSortRules] = useState(() =>
    parseStoredRelationSortRules()
  );
  const [employeeRelationsFilters, setEmployeeRelationsFilters] = useState(INITIAL_RELATION_FILTERS);
  const [isAddingEmployeeRelation, setIsAddingEmployeeRelation] = useState(false);
  const [editingEmployeeRelationId, setEditingEmployeeRelationId] = useState("");
  const [activeNewRelationCombo, setActiveNewRelationCombo] = useState(null);
  const [relationComboMenuLayouts, setRelationComboMenuLayouts] = useState({});
  const [newEmployeeRelationForm, setNewEmployeeRelationForm] = useState(INITIAL_NEW_RELATION_FORM);
  const [organizationOptions, setOrganizationOptions] = useState([]);
  const [relationTypeOptions, setRelationTypeOptions] = useState([]);
  const [salesOrganizationOptions, setSalesOrganizationOptions] = useState([]);
  const [productGroupOptions, setProductGroupOptions] = useState([]);
  const [pendingEmployeeDelete, setPendingEmployeeDelete] = useState(null);
  const [pendingRelationDelete, setPendingRelationDelete] = useState(null);
  const [pendingPositionDelete, setPendingPositionDelete] = useState(null);

  const showSystemErrorToast = useCallback((message) => {
    const normalizedMessage = String(message ?? "").trim();
    if (!normalizedMessage) {
      return;
    }
    setSystemErrorToast((prev) => {
      return {
        id: Number(prev?.id ?? 0) + 1,
        message: normalizedMessage
      };
    });
    setIsSystemErrorToastClosing(false);
  }, []);
  const showEmployeeRelationsError = useCallback((message) => {
    const normalizedMessage = String(message ?? "").trim();
    if (!normalizedMessage) {
      return;
    }
    setEmployeeRelationsError((prev) => {
      if (prev === normalizedMessage) {
        setTimeout(() => {
          setEmployeeRelationsError(normalizedMessage);
        }, 0);
        return "";
      }
      return normalizedMessage;
    });
  }, []);
  const refreshEmployeesList = useCallback(() => {
    setEmployeesListRefreshToken((prev) => prev + 1);
  }, []);
  const getEmployeeCardEditFormFromEmployee = useCallback((employee) => {
    const normalizedStatus = String(employee?.status ?? "")
      .trim()
      .toUpperCase();
    return {
      surname: String(employee?.surname ?? "").trim(),
      firstName: String(employee?.firstName ?? "").trim(),
      middleName: String(employee?.middleName ?? "").trim(),
      email: String(employee?.email ?? "").trim(),
      phoneNumber: String(employee?.phoneNumber ?? "").trim(),
      sapId: String(employee?.sapId ?? "").trim(),
      personalNumber: String(employee?.personalNumber ?? "").trim(),
      status: normalizedStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE"
    };
  }, []);
  const [isAddingEmployeePosition, setIsAddingEmployeePosition] = useState(false);
  const [editingEmployeePositionId, setEditingEmployeePositionId] = useState("");
  const [newEmployeePositionForm, setNewEmployeePositionForm] = useState(INITIAL_NEW_POSITION_FORM);
  const [positionOrganizationOptions, setPositionOrganizationOptions] = useState([]);
  const [positionTitleOptions, setPositionTitleOptions] = useState([]);
  const [positionEmployeeOptions, setPositionEmployeeOptions] = useState([]);
  const [relationEmployeeOptions, setRelationEmployeeOptions] = useState([]);
  const [activeNewPositionCombo, setActiveNewPositionCombo] = useState(null);
  const [positionComboMenuLayouts, setPositionComboMenuLayouts] = useState({});
  const [employeeRelationsColumnWidths, setEmployeeRelationsColumnWidths] = useState(() =>
    parseStoredRelationColumnWidths()
  );
  const resizeStateRef = useRef(null);
  const relationResizeStateRef = useRef(null);
  const relationTableWrapperRef = useRef(null);
  const employeeRelationsTabContentRef = useRef(null);
  const positionsTableWrapperRef = useRef(null);
  const relationComboInputRefs = useRef({});
  const positionComboInputRefs = useRef({});
  const relationOptionsRequestRef = useRef({ employee: 0, organ: 0, sales: 0 });
  const employeesListRequestRef = useRef(0);
  const relationComboSelectInProgressRef = useRef({
    employee: false,
    organ: false,
    relation: false,
    sales: false,
    product: false
  });
  const relationComboClearInProgressRef = useRef({
    employee: false,
    organ: false,
    relation: false,
    sales: false,
    product: false
  });
  const lastConfirmedOrganRef = useRef({
    id: "",
    name: "",
    sapId: "",
    inn: "",
    kpp: "",
    ogrn: "",
    fullAddress: ""
  });
  const lastConfirmedRelationEmployeeRef = useRef({ id: "", name: "" });
  const lastConfirmedRelationRef = useRef({ id: "", name: "" });
  const lastConfirmedSalesRef = useRef({ id: "", name: "" });
  const lastConfirmedProductRef = useRef({ id: "", name: "" });
  const tableWrapperRef = useRef(null);
  const mainPanelRef = useRef(null);
  const bottomPanelRef = useRef(null);
  const administrationButtonRef = useRef(null);
  const [settingsPanelBounds, setSettingsPanelBounds] = useState({ top: 80, bottom: 24 });
  const [administrationPanelPosition, setAdministrationPanelPosition] = useState({ top: 0, left: 0 });
  const [cellTooltip, setCellTooltip] = useState({
    visible: false,
    text: "",
    x: 0,
    y: 0
  });
  const [buttonTooltip, setButtonTooltip] = useState({
    visible: false,
    text: "",
    x: 0,
    y: 0
  });
  const [nowDisplay, setNowDisplay] = useState(() => formatNow());
  const currentPageTitle = PAGE_TITLES[activePage] ?? PAGE_TITLES[PAGE_IDS.EMPLOYEES];
  const isEmployeesPage = activePage === PAGE_IDS.EMPLOYEES;
  const isOrganizationsPage = activePage === PAGE_IDS.ORGANIZATIONS;
  const isEmployeeRelationsPage = activePage === PAGE_IDS.EMPLOYEE_RELATIONS;
  const isListPage = isEmployeesPage || isOrganizationsPage || isEmployeeRelationsPage;
  const tableColumns = isEmployeesPage
    ? ALL_COLUMNS
    : isOrganizationsPage
      ? ORGANIZATION_COLUMNS
      : RELATIONS_PAGE_COLUMNS;
  const initialFiltersForPage = isEmployeesPage
    ? INITIAL_FILTERS
    : isOrganizationsPage
      ? ORGANIZATION_INITIAL_FILTERS
      : RELATIONS_PAGE_INITIAL_FILTERS;
  const defaultColumnSettingsForPage = isEmployeesPage
    ? DEFAULT_COLUMN_SETTINGS
    : isOrganizationsPage
      ? ORGANIZATION_DEFAULT_COLUMN_SETTINGS
      : RELATIONS_PAGE_DEFAULT_COLUMN_SETTINGS;
  const defaultColumnWidthsForPage = isEmployeesPage
    ? DEFAULT_COLUMN_WIDTHS
    : isOrganizationsPage
      ? ORGANIZATION_DEFAULT_COLUMN_WIDTHS
      : RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS;
  const activeApiUrl = isEmployeesPage
    ? EMPLOYEES_API_URL
    : isOrganizationsPage
      ? ORGANIZATIONS_API_URL
      : RELATIONS_API_URL;
  const activeListErrorMessage = isEmployeesPage
    ? "Не удалось получить список сотрудников"
    : isOrganizationsPage
      ? "Не удалось получить список организаций"
      : "Не удалось получить список связей сотрудников";
  const selectedEmployeeFromList = isEmployeesPage
    ? employees.find(
        (row) => String(row?.id ?? row?.employeeId ?? "").trim() === String(selectedEmployeeId).trim()
      ) ?? null
    : null;
  const selectedEmployee =
    selectedEmployeeFromList ??
    (String(selectedEmployeeSnapshot?.id ?? selectedEmployeeSnapshot?.employeeId ?? "").trim() ===
    String(selectedEmployeeId).trim()
      ? selectedEmployeeSnapshot
      : null);
  const selectedEmployeeIdForRelations = String(
    selectedEmployee?.id ?? selectedEmployee?.employeeId ?? ""
  ).trim();
  const employeeCardHeaderFullName = isEmployeeCardEditMode
    ? String(
        [
          employeeCardEditForm.surname,
          employeeCardEditForm.firstName,
          employeeCardEditForm.middleName
        ]
          .map((part) => String(part ?? "").trim())
          .filter((part) => part.length > 0)
          .join(" ")
      )
    : String(selectedEmployee?.fullName ?? "").trim();
  const isEditingEmployeeRelation = Boolean(editingEmployeeRelationId);
  const isRelationFormActive = isAddingEmployeeRelation || isEditingEmployeeRelation;
  const isEditingEmployeePosition = Boolean(editingEmployeePositionId);
  const isPositionFormActive = isAddingEmployeePosition || isEditingEmployeePosition;
  const isEmployeeCardVisible =
    isEmployeesPage && isEmployeeCardPanelOpen && (Boolean(selectedEmployee) || isCreatingEmployeeCard);
  const selectedEmployeePositions = Array.isArray(selectedEmployee?.positions)
    ? [...selectedEmployee.positions].sort((left, right) => {
        const organDiff = compareUtf8ByteOrder(left?.organName, right?.organName);
        if (organDiff !== 0) {
          return organDiff;
        }
        const departDiff = compareUtf8ByteOrder(left?.departName, right?.departName);
        if (departDiff !== 0) {
          return departDiff;
        }
        return compareUtf8ByteOrder(left?.positionName, right?.positionName);
      })
    : [];

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, String(isDarkThemeEnabled));
  }, [isDarkThemeEnabled]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowDisplay(formatNow());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const elementsWithTitle = document.querySelectorAll("[title]");
    elementsWithTitle.forEach((element) => {
      const title = element.getAttribute("title");
      if (!title) {
        return;
      }
      if (!element.getAttribute("data-tooltip")) {
        element.setAttribute("data-tooltip", title);
      }
      element.removeAttribute("title");
    });
  });

  useEffect(() => {
    const getTooltipTarget = (target) =>
      target instanceof Element ? target.closest("button[data-tooltip], label[data-tooltip]") : null;

    const handleMouseOver = (event) => {
      const tooltipTarget = getTooltipTarget(event.target);
      if (!tooltipTarget) {
        return;
      }
      const tooltipText = String(tooltipTarget.getAttribute("data-tooltip") ?? "").trim();
      if (!tooltipText) {
        return;
      }
      setButtonTooltip({
        visible: true,
        text: tooltipText,
        x: event.clientX + 12,
        y: event.clientY + 12
      });
    };

    const handleMouseMove = (event) => {
      setButtonTooltip((prev) =>
        prev.visible
          ? {
              ...prev,
              x: event.clientX + 12,
              y: event.clientY + 12
            }
          : prev
      );
    };

    const handleMouseOut = (event) => {
      const currentTarget = getTooltipTarget(event.target);
      if (!currentTarget) {
        return;
      }
      const nextTarget = getTooltipTarget(event.relatedTarget);
      if (currentTarget === nextTarget) {
        return;
      }
      setButtonTooltip((prev) => ({ ...prev, visible: false, text: "" }));
    };

    const forceHideTooltips = () => {
      setButtonTooltip((prev) => ({ ...prev, visible: false, text: "" }));
      setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseout", handleMouseOut);
    document.addEventListener("pointerdown", forceHideTooltips, true);
    document.addEventListener("scroll", forceHideTooltips, true);
    window.addEventListener("blur", forceHideTooltips);
    document.addEventListener("visibilitychange", forceHideTooltips);
    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseout", handleMouseOut);
      document.removeEventListener("pointerdown", forceHideTooltips, true);
      document.removeEventListener("scroll", forceHideTooltips, true);
      window.removeEventListener("blur", forceHideTooltips);
      document.removeEventListener("visibilitychange", forceHideTooltips);
    };
  }, []);

  useEffect(() => {
    const normalizedEmployeeSettings = normalizeColumnSettingsForColumns(
      parseStoredColumnSettings(),
      ALL_COLUMNS
    );
    window.localStorage.setItem(
      COLUMN_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizedEmployeeSettings)
    );

    const normalizedOrganizationSettings = normalizeColumnSettingsForColumns(
      parseStoredOrganizationColumnSettings(),
      ORGANIZATION_COLUMNS
    );
    window.localStorage.setItem(
      ORGANIZATIONS_COLUMN_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizedOrganizationSettings)
    );

    const normalizedRelationsPageSettings = normalizeColumnSettingsForColumns(
      parseStoredRelationsPageColumnSettings(),
      RELATIONS_PAGE_COLUMNS
    );
    window.localStorage.setItem(
      RELATIONS_PAGE_COLUMN_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizedRelationsPageSettings)
    );
  }, []);

  useEffect(() => {
    if (isEmployeesPage) {
      window.localStorage.setItem(SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    } else if (isOrganizationsPage) {
      window.localStorage.setItem(ORGANIZATIONS_SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    } else if (isEmployeeRelationsPage) {
      window.localStorage.setItem(RELATIONS_PAGE_SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    }
  }, [isEmployeesPage, isOrganizationsPage, isEmployeeRelationsPage, sortRules]);

  useEffect(() => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    if (isEmployeesPage) {
      window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } else if (isOrganizationsPage) {
      window.localStorage.setItem(ORGANIZATIONS_FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } else if (isEmployeeRelationsPage) {
      window.localStorage.setItem(RELATIONS_PAGE_FILTERS_STORAGE_KEY, JSON.stringify(filters));
    }
  }, [filters, isEmployeesPage, isOrganizationsPage, isEmployeeRelationsPage]);

  useEffect(() => {
    if (isEmployeesPage) {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } else if (isOrganizationsPage) {
      window.localStorage.setItem(ORGANIZATIONS_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } else if (isEmployeeRelationsPage) {
      window.localStorage.setItem(RELATIONS_PAGE_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    }
  }, [columnWidths, isEmployeesPage, isOrganizationsPage, isEmployeeRelationsPage]);

  useEffect(() => {
    window.localStorage.setItem(
      RELATION_COLUMN_WIDTHS_STORAGE_KEY,
      JSON.stringify(employeeRelationsColumnWidths)
    );
  }, [employeeRelationsColumnWidths]);

  useEffect(() => {
    window.localStorage.setItem(
      RELATION_SORT_RULES_STORAGE_KEY,
      JSON.stringify(employeeRelationsSortRules)
    );
  }, [employeeRelationsSortRules]);

  useEffect(() => {
    if (isEmployeesPage) {
      window.localStorage.setItem(COLUMN_SETTINGS_STORAGE_KEY, JSON.stringify(columnSettings));
    } else if (isOrganizationsPage) {
      window.localStorage.setItem(ORGANIZATIONS_COLUMN_SETTINGS_STORAGE_KEY, JSON.stringify(columnSettings));
    } else if (isEmployeeRelationsPage) {
      window.localStorage.setItem(RELATIONS_PAGE_COLUMN_SETTINGS_STORAGE_KEY, JSON.stringify(columnSettings));
    }
  }, [columnSettings, isEmployeesPage, isOrganizationsPage, isEmployeeRelationsPage]);

  useEffect(() => {
    if (!isEmployeesPage) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setDebouncedEmployeeFilters(filters);
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [filters, isEmployeesPage]);

  useEffect(() => {
    if (!isOrganizationsPage) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setDebouncedOrganizationFilters(filters);
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [filters, isOrganizationsPage]);

  useEffect(() => {
    if (!isEmployeeRelationsPage) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setDebouncedRelationsPageFilters(filters);
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [filters, isEmployeeRelationsPage]);

  useEffect(() => {
    if (!linkedEmployeeIdFilter) {
      return;
    }
    setSelectedEmployeeId("");
    setSelectedRowIndex(-1);
    setIsEmployeeCardPanelOpen(false);
    setIsCreatingEmployeeCard(false);
    setIsEmployeeCardEditMode(false);
  }, [linkedEmployeeIdFilter]);

  useEffect(() => {
    if (!isEmployeesPage || !linkedEmployeeIdFilter || !isLinkedEmployeeLookupActive) {
      return;
    }

    if (hasAnyEmployeeListFilter(filters)) {
      setFilters({ ...INITIAL_FILTERS });
    }
    if (hasAnyEmployeeListFilter(debouncedEmployeeFilters)) {
      setDebouncedEmployeeFilters({ ...INITIAL_FILTERS });
    }
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [
    currentPage,
    debouncedEmployeeFilters,
    filters,
    isEmployeesPage,
    isLinkedEmployeeLookupActive,
    linkedEmployeeIdFilter
  ]);

  useEffect(() => {
    if (!isEmployeesPage || !linkedEmployeeIdFilter || !isLinkedEmployeeLookupActive) {
      return;
    }
    const currentSelectedId = String(selectedEmployee?.id ?? selectedEmployee?.employeeId ?? "").trim();
    if (currentSelectedId === linkedEmployeeIdFilter) {
      return;
    }
    setSelectedEmployeeId("");
    setSelectedRowIndex(-1);
    setIsEmployeeCardPanelOpen(false);
    setIsCreatingEmployeeCard(false);
  }, [
    isEmployeesPage,
    isLinkedEmployeeLookupActive,
    linkedEmployeeIdFilter,
    selectedEmployee
  ]);

  useEffect(() => {
    setPageJumpInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    const normalized = normalizeColumnSettingsForColumns(columnSettings, tableColumns);
    const isSame =
      normalized.length === columnSettings.length &&
      normalized.every(
        (item, index) =>
          item.key === columnSettings[index]?.key &&
          item.visible === (columnSettings[index]?.visible !== false) &&
          item.pin === (columnSettings[index]?.pin ?? "none")
      );

    if (!isSame) {
      setColumnSettings(normalized);
    }
  }, [columnSettings, tableColumns]);

  useEffect(() => {
    if (employees.length === 0) {
      setSelectedEmployeeId("");
      setSelectedRowIndex(-1);
      if (!selectedEmployeeId) {
        setIsEmployeeCardPanelOpen(false);
      }
      return;
    }

    if (selectedRowIndex >= employees.length) {
      setSelectedRowIndex(-1);
    }
  }, [employees, selectedEmployeeId, selectedRowIndex]);

  useEffect(() => {
    if (!selectedEmployeeFromList) {
      return;
    }
    setSelectedEmployeeSnapshot(selectedEmployeeFromList);
  }, [selectedEmployeeFromList]);

  useEffect(() => {
    setEmployeeRelations([]);
    setEmployeeRelationsError("");
    setEmployeeRelationsFilters(INITIAL_RELATION_FILTERS);
    setIsAddingEmployeeRelation(false);
    setEditingEmployeeRelationId("");
    setActiveNewRelationCombo(null);
    setRelationComboMenuLayouts({});
    setNewEmployeeRelationForm(INITIAL_NEW_RELATION_FORM);
    setOrganizationOptions([]);
    setRelationTypeOptions([]);
    setSalesOrganizationOptions([]);
    setProductGroupOptions([]);
  }, [selectedEmployeeIdForRelations]);

  useEffect(() => {
    setIsAddingEmployeePosition(false);
    setEditingEmployeePositionId("");
    setNewEmployeePositionForm(INITIAL_NEW_POSITION_FORM);
    setPositionOrganizationOptions([]);
    setPositionTitleOptions([]);
    setActiveNewPositionCombo(null);
    setPositionComboMenuLayouts({});
  }, [selectedEmployeeIdForRelations]);

  useEffect(() => {
    if (
      !isEmployeeCardVisible ||
      activeEmployeeCardTab !== EMPLOYEE_CARD_TABS.RELATIONS ||
      !selectedEmployeeIdForRelations
    ) {
      return;
    }

    const fetchRelations = async () => {
      setEmployeeRelationsLoading(true);
      setEmployeeRelationsError("");

      const requestBody = {
        sorts:
          employeeRelationsSortRules.length > 0
            ? employeeRelationsSortRules
            : [{ field: "organName", direction: "ASC" }]
      };

      for (const [key, value] of Object.entries(employeeRelationsFilters)) {
        const normalized = String(value ?? "").trim();
        if (!normalized) {
          continue;
        }
        requestBody[key] = normalized;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/relation/${selectedEmployeeIdForRelations}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(toCamelApiPayload(requestBody))
        });
        const data = await response.json();
        if (!response.ok) {
          setEmployeeRelations([]);
          setEmployeeRelationsError(data.error ?? "Не удалось получить связи сотрудника");
          return;
        }

        setEmployeeRelations(Array.isArray(data.items) ? data.items : []);
      } catch {
        setEmployeeRelations([]);
        setEmployeeRelationsError("Не удалось получить связи сотрудника");
      } finally {
        setEmployeeRelationsLoading(false);
      }
    };

    fetchRelations();
  }, [
    API_BASE_URL,
    EMPLOYEE_CARD_TABS.RELATIONS,
    activeEmployeeCardTab,
    employeeRelationsFilters,
    employeeRelationsSortRules,
    isEmployeeCardVisible,
    selectedEmployeeIdForRelations
  ]);


  useEffect(() => {
    if (!isColumnSettingsOpen) {
      return;
    }

    const updateBounds = () => {
      const mainRect = mainPanelRef.current?.getBoundingClientRect();
      const bottomRect = bottomPanelRef.current?.getBoundingClientRect();
      if (!mainRect || !bottomRect) {
        return;
      }

      setSettingsPanelBounds({
        top: Math.max(0, mainRect.top),
        bottom: Math.max(0, window.innerHeight - bottomRect.bottom)
      });
    };

    updateBounds();
    window.addEventListener("resize", updateBounds);
    window.addEventListener("scroll", updateBounds, true);
    return () => {
      window.removeEventListener("resize", updateBounds);
      window.removeEventListener("scroll", updateBounds, true);
    };
  }, [isColumnSettingsOpen]);

  useEffect(() => {
    if (!isAdministrationOpen) {
      return;
    }

    const updateAdministrationPanelPosition = () => {
      const buttonRect = administrationButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) {
        return;
      }

      setAdministrationPanelPosition({
        top: Math.max(0, buttonRect.top),
        left: Math.max(0, buttonRect.right)
      });
    };

    updateAdministrationPanelPosition();
    window.addEventListener("resize", updateAdministrationPanelPosition);
    window.addEventListener("scroll", updateAdministrationPanelPosition, true);
    return () => {
      window.removeEventListener("resize", updateAdministrationPanelPosition);
      window.removeEventListener("scroll", updateAdministrationPanelPosition, true);
    };
  }, [isAdministrationOpen, isSidebarCollapsed]);

  const activeSortRules =
    sortRules.length > 0
      ? sortRules
      : isEmployeeRelationsPage
        ? RELATIONS_PAGE_DEFAULT_SORT_RULES
        : sortRules;
  const getListRequestPayload = (limitValue, offsetValue, payloadFilters) => ({
    limit: limitValue,
    offset: offsetValue,
    sorts: activeSortRules,
    ...Object.fromEntries(
      Object.entries(payloadFilters).filter(([, value]) => value !== null && String(value).trim() !== "")
    )
  });

  const activeFiltersForRequest = isOrganizationsPage
    ? debouncedOrganizationFilters
    : isEmployeeRelationsPage
      ? debouncedRelationsPageFilters
      : debouncedEmployeeFilters;

  useEffect(() => {
    if (!isListPage) {
      return;
    }

    const fetchItems = async () => {
      const requestId = employeesListRequestRef.current + 1;
      employeesListRequestRef.current = requestId;
      setEmployeesLoading(true);
      setEmployeesError("");

      try {
        const requestFilters =
          isEmployeesPage && linkedEmployeeIdFilter
            ? INITIAL_FILTERS
            : activeFiltersForRequest;
        const response = await fetch(activeApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            toCamelApiPayload({
              ...getListRequestPayload(pageSize, currentPage, requestFilters),
              ...(isEmployeesPage && linkedEmployeeIdFilter
                ? { employeeId: linkedEmployeeIdFilter }
                : {})
            })
          )
        });

        const data = await response.json();
        if (requestId !== employeesListRequestRef.current) {
          return;
        }
        if (!response.ok) {
          setEmployees([]);
          setTotalCount(0);
          setEmployeesError(data.error ?? activeListErrorMessage);
          return;
        }

        const responseItems = Array.isArray(data.items) ? data.items : [];
        setEmployees(
          isEmployeeRelationsPage
            ? responseItems
                .map((item) => normalizeRelationListItem(item))
                .filter((item) => item !== null)
            : responseItems
        );
        setTotalCount(Number(data.totalCount ?? 0));
      } catch {
        if (requestId !== employeesListRequestRef.current) {
          return;
        }
        setEmployees([]);
        setTotalCount(0);
        setEmployeesError(activeListErrorMessage);
      } finally {
        if (requestId !== employeesListRequestRef.current) {
          return;
        }
        if (isEmployeesPage && linkedEmployeeIdFilter && isLinkedEmployeeLookupActive) {
          setHasLinkedEmployeeLookupAttempt(true);
        }
        setEmployeesLoading(false);
      }
    };

    fetchItems();
  }, [
    activeApiUrl,
    activeFiltersForRequest,
    activeListErrorMessage,
    currentPage,
    employeesListRefreshToken,
    linkedEmployeeIdFilter,
    pageSize,
    activeSortRules,
    isEmployeesPage,
    isEmployeeRelationsPage,
    isListPage
  ]);

  useEffect(() => {
    if (!isEmployeesPage || !linkedEmployeeIdFilter || !isLinkedEmployeeLookupActive || employeesLoading) {
      return;
    }
    const matchedIndex = employees.findIndex(
      (row) => String(row?.id ?? row?.employeeId ?? "").trim() === linkedEmployeeIdFilter
    );
    if (matchedIndex < 0) {
      if (hasLinkedEmployeeLookupAttempt) {
        setIsLinkedEmployeeLookupActive(false);
      }
      return;
    }
    if (!isEmployeeCardPanelOpen) {
      setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.MAIN);
    }
    setSelectedEmployeeId(linkedEmployeeIdFilter);
    setSelectedRowIndex(matchedIndex);
    setIsCreatingEmployeeCard(false);
    setIsEmployeeCardEditMode(false);
    setIsEmployeeCardPanelOpen(true);
    setIsColumnSettingsOpen(false);
    setLinkedEmployeeIdFilter("");
    setIsLinkedEmployeeLookupActive(false);
    setHasLinkedEmployeeLookupAttempt(false);
  }, [
    employees,
    employeesLoading,
    hasLinkedEmployeeLookupAttempt,
    isEmployeeCardPanelOpen,
    isEmployeesPage,
    isLinkedEmployeeLookupActive,
    linkedEmployeeIdFilter
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const visiblePaginationItems = (() => {
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
  })();
  const settingsMap = new Map(columnSettings.map((item, index) => [item.key, { ...item, index }]));
  const orderedColumns = [...tableColumns].sort(
    (a, b) => (settingsMap.get(a.key)?.index ?? 0) - (settingsMap.get(b.key)?.index ?? 0)
  );
  const visibleColumnsOrdered = orderedColumns.filter((column) => settingsMap.get(column.key)?.visible !== false);
  const leftPinnedColumns = visibleColumnsOrdered.filter(
    (column) => (settingsMap.get(column.key)?.pin ?? "none") === "left"
  );
  const rightPinnedColumns = visibleColumnsOrdered.filter(
    (column) => (settingsMap.get(column.key)?.pin ?? "none") === "right"
  );
  const unpinnedColumns = visibleColumnsOrdered.filter(
    (column) => (settingsMap.get(column.key)?.pin ?? "none") === "none"
  );
  const visibleColumns = [...leftPinnedColumns, ...unpinnedColumns, ...rightPinnedColumns];

  const leftOffsets = {};
  let accumulatedLeft = 0;
  for (const column of leftPinnedColumns) {
    leftOffsets[column.key] = accumulatedLeft;
    accumulatedLeft += Number(columnWidths[column.key] ?? defaultColumnWidthsForPage[column.key]);
  }

  const rightOffsets = {};
  let accumulatedRight = 0;
  for (let index = rightPinnedColumns.length - 1; index >= 0; index -= 1) {
    const column = rightPinnedColumns[index];
    rightOffsets[column.key] = accumulatedRight;
    accumulatedRight += Number(columnWidths[column.key] ?? defaultColumnWidthsForPage[column.key]);
  }

  const getColumnWidthPx = (columnKey) =>
    Number(columnWidths[columnKey] ?? defaultColumnWidthsForPage[columnKey] ?? MIN_COLUMN_WIDTH);
  const tableWidthPx = visibleColumns.reduce((sum, column) => sum + getColumnWidthPx(column.key), 0);
  const listActionsColumnWidth = isEmployeeRelationsPage ? 96 : 0;
  const tableWidthWithActionsPx = tableWidthPx + listActionsColumnWidth;

  const fitRenderedColumnsToTargetWidth = (renderedColumns, targetTotalWidth) => {
    if (!Array.isArray(renderedColumns) || renderedColumns.length === 0 || targetTotalWidth <= 0) {
      return null;
    }
    const minColumnWidth = MIN_COLUMN_WIDTH;
    const currentTotalWidth = renderedColumns.reduce((sum, column) => sum + Number(column.width || 0), 0);
    if (currentTotalWidth <= 0) {
      return null;
    }

    const scale = targetTotalWidth / currentTotalWidth;
    const scaledWidths = renderedColumns.map((column) => ({
      key: column.key,
      width: Math.max(minColumnWidth, Math.round(Number(column.width || 0) * scale))
    }));

    let diff = targetTotalWidth - scaledWidths.reduce((sum, column) => sum + column.width, 0);
    if (diff < 0) {
      let deficit = -diff;
      for (let index = scaledWidths.length - 1; index >= 0 && deficit > 0; index -= 1) {
        const shrinkCapacity = Math.max(0, scaledWidths[index].width - minColumnWidth);
        if (shrinkCapacity <= 0) {
          continue;
        }
        const shrinkBy = Math.min(shrinkCapacity, deficit);
        scaledWidths[index].width -= shrinkBy;
        deficit -= shrinkBy;
      }
      diff = deficit > 0 ? -deficit : 0;
    }

    if (diff > 0 && scaledWidths.length > 0) {
      scaledWidths[scaledWidths.length - 1].width += diff;
    }

    return scaledWidths;
  };

  const getSortDirectionForField = (columnSortField) => {
    const match = sortRules.find((rule) => rule.field === columnSortField);
    return match ? match.direction : null;
  };

  const getSortOrderForField = (columnSortField) => {
    const sortIndex = sortRules.findIndex((rule) => rule.field === columnSortField);
    return sortIndex >= 0 ? sortIndex + 1 : null;
  };

  const handleSortClick = (columnSortField) => {
    setCurrentPage(1);
    setSortRules((prev) => {
      const hasOnlyDefaultEmployeeSort =
        isEmployeesPage &&
        prev.length === 1 &&
        prev[0]?.field === "fullName" &&
        prev[0]?.direction === "ASC";
      const hasOnlyDefaultOrganizationSort =
        isOrganizationsPage &&
        prev.length === 1 &&
        prev[0]?.field === "name" &&
        prev[0]?.direction === "ASC";
      const normalizedPrev =
        (hasOnlyDefaultEmployeeSort || hasOnlyDefaultOrganizationSort) &&
        prev[0]?.field !== columnSortField
          ? []
          : prev;

      const currentRule = normalizedPrev.find((rule) => rule.field === columnSortField);
      let nextRules;
      if (!currentRule) {
        nextRules = [...normalizedPrev, { field: columnSortField, direction: "ASC" }];
      } else if (currentRule.direction === "ASC") {
        nextRules = normalizedPrev.map((rule) =>
          rule.field === columnSortField ? { ...rule, direction: "DESC" } : rule
        );
      } else {
        nextRules = normalizedPrev.filter((rule) => rule.field !== columnSortField);
      }

      try {
        if (isEmployeesPage) {
          window.localStorage.setItem(SORT_RULES_STORAGE_KEY, JSON.stringify(nextRules));
        } else if (isOrganizationsPage) {
          window.localStorage.setItem(ORGANIZATIONS_SORT_RULES_STORAGE_KEY, JSON.stringify(nextRules));
        } else if (isEmployeeRelationsPage) {
          window.localStorage.setItem(RELATIONS_PAGE_SORT_RULES_STORAGE_KEY, JSON.stringify(nextRules));
        }
      } catch {
        // noop
      }
      return nextRules;
    });
  };

  const handleFilterChange = (field, value) => {
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResizeStart = (field, event) => {
    event.preventDefault();
    event.stopPropagation();

    const startWidth = columnWidths[field];
    resizeStateRef.current = {
      field,
      startX: event.clientX,
      startWidth
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent) => {
      if (!resizeStateRef.current) {
        return;
      }

      const delta = moveEvent.clientX - resizeStateRef.current.startX;
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, resizeStateRef.current.startWidth + delta);
      setColumnWidths((prev) => ({
        ...prev,
        [field]: nextWidth
      }));
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleAlignVisibleColumns = () => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) {
      return;
    }

    const renderedColumns = visibleColumns.map((column) => ({
      key: column.key,
      width: Number(columnWidths[column.key]) || defaultColumnWidthsForPage[column.key]
    }));
    if (renderedColumns.length === 0) {
      return;
    }

    const reservedActionsWidth = isEmployeeRelationsPage ? listActionsColumnWidth : 0;
    const targetTotalWidth = wrapper.clientWidth - reservedActionsWidth;
    if (targetTotalWidth <= 0) {
      return;
    }
    const scaledWidths = fitRenderedColumnsToTargetWidth(renderedColumns, targetTotalWidth);
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
  };

  const getStickyProps = (columnKey, isHeader = false) => {
    const pin = settingsMap.get(columnKey)?.pin ?? "none";
    if (pin === "left") {
      return {
        className: "sticky-cell sticky-left",
        style: { left: `${leftOffsets[columnKey] ?? 0}px`, zIndex: isHeader ? 7 : 5 }
      };
    }

    if (pin === "right") {
      return {
        className: "sticky-cell sticky-right",
        style: { right: `${rightOffsets[columnKey] ?? 0}px`, zIndex: isHeader ? 7 : 5 }
      };
    }

    return { className: "", style: undefined };
  };

  const openColumnSettings = () => {
    setIsColumnSettingsOpen(true);
  };

  const closeColumnSettings = () => {
    setIsColumnSettingsOpen(false);
  };

  const applyColumnSettingsDraft = (nextDraft) => {
    setColumnSettings(nextDraft.map((item) => ({ ...item })));
    setIsColumnSettingsOpen(false);
  };

  const cancelColumnSettings = () => {
    setIsColumnSettingsOpen(false);
  };

  const resetColumnSettings = () => {
    setColumnSettings(defaultColumnSettingsForPage.map((item) => ({ ...item })));
    setIsColumnSettingsOpen(false);
  };


  const exportColumns = visibleColumns.map((column) => ({
    key: column.key,
    title: column.title
  }));

  const exportApiUrl = isEmployeesPage
    ? `${API_BASE_URL}/api/employees/export`
    : isOrganizationsPage
      ? `${API_BASE_URL}/api/organizations/export`
      : `${API_BASE_URL}/api/relations/export`;

  const exportFallbackFileName = isEmployeesPage
    ? "employees-export.xlsx"
    : isOrganizationsPage
      ? "organizations-export.xlsx"
      : "relations-export.xlsx";

  const requestExportFile = async () => {
    const response = await fetch(exportApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        toCamelApiPayload({
          sorts: sortRules,
          columns: exportColumns,
          ...Object.fromEntries(
            Object.entries(activeFiltersForRequest).filter(
              ([, value]) => value !== null && String(value).trim() !== ""
            )
          )
        })
      )
    });

    if (!response.ok) {
      let errorMessage = isEmployeesPage
        ? "Не удалось выгрузить данные сотрудников в Excel"
        : "Не удалось выгрузить данные организаций в Excel";
      try {
        const errorPayload = await response.json();
        if (typeof errorPayload?.error === "string" && errorPayload.error.trim()) {
          errorMessage = errorPayload.error;
        }
      } catch {
        // noop
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const fileName = parseFileNameFromDisposition(
      response.headers.get("content-disposition"),
      exportFallbackFileName
    );
    return { blob, fileName };
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setPendingFile(file);
    setDeleteMissing(false);
    setIsConfirmModalOpen(true);
  };

  const startUpload = async () => {
    if (!pendingFile) {
      return;
    }

    setLoading(true);
    setResultMessage("");
    setStats(null);
    setIsResultModalOpen(false);
    setLogFileUrl("");
    setIsConfirmModalOpen(false);

    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("delete_missing", deleteMissing ? "true" : "false");

      const response = await fetch(EMPLOYEES_IMPORT_API_URL, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMessage = data.error ?? "Ошибка загрузки файла";
        showSystemErrorToast(errorMessage);
        return;
      }

      setResultMessage(data.message ?? "Операция загрузки завершена.");
      setStats(data.stats ?? null);
      setLogFileUrl(data.logFileUrl ?? "");
      setIsResultModalOpen(true);
    } catch {
      showSystemErrorToast("Ошибка загрузки файла");
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  };

  const handleAdministrationClick = () => {
    setIsAdministrationOpen((prev) => !prev);
  };

  const handleOpenRelationCreateFromList = () => {
    openAddEmployeeRelationRow();
  };

  const handlePageSelect = (pageId) => {
    if (isEmployeesPage) {
      window.localStorage.setItem(SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    } else if (isOrganizationsPage) {
      window.localStorage.setItem(ORGANIZATIONS_SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    } else if (isEmployeeRelationsPage) {
      window.localStorage.setItem(RELATIONS_PAGE_SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    }

    setActivePage(pageId);
    setCurrentPage(1);
    setTotalCount(0);
    setEmployees([]);
    setEmployeesError("");
    setSelectedEmployeeSnapshot(null);
    setSelectedEmployeeId("");
    setSelectedRowIndex(-1);
    setIsEmployeeCardPanelOpen(false);
    setIsColumnSettingsOpen(false);

    if (pageId === PAGE_IDS.EMPLOYEES) {
      setSortRules(parseStoredSortRules());
      setFilters(parseStoredFilters());
      setDebouncedEmployeeFilters(parseStoredFilters());
      setDebouncedOrganizationFilters({ ...ORGANIZATION_INITIAL_FILTERS });
      setColumnWidths(parseStoredColumnWidths());
      setColumnSettings(parseStoredColumnSettings());
    } else if (pageId === PAGE_IDS.ORGANIZATIONS) {
      const storedOrgSorts = parseStoredOrganizationSortRules();
      const storedOrgFilters = parseStoredOrganizationFilters();
      const storedOrgColumnWidths = parseStoredOrganizationColumnWidths();
      const storedOrgColumnSettings = parseStoredOrganizationColumnSettings();
      setSortRules(storedOrgSorts);
      setFilters(storedOrgFilters);
      setDebouncedEmployeeFilters(parseStoredFilters());
      setDebouncedOrganizationFilters(storedOrgFilters);
      setColumnWidths(storedOrgColumnWidths);
      setColumnSettings(storedOrgColumnSettings);
      setIsConfirmModalOpen(false);
      setIsResultModalOpen(false);
      setPendingFile(null);
      setLoading(false);
    } else if (pageId === PAGE_IDS.EMPLOYEE_RELATIONS) {
      const storedRelationsSorts = parseStoredRelationsPageSortRules();
      const storedRelationsFilters = parseStoredRelationsPageFilters();
      const storedRelationsColumnWidths = parseStoredRelationsPageColumnWidths();
      const storedRelationsColumnSettings = parseStoredRelationsPageColumnSettings();
      setSortRules(storedRelationsSorts);
      setFilters(storedRelationsFilters);
      setDebouncedEmployeeFilters(parseStoredFilters());
      setDebouncedOrganizationFilters(parseStoredOrganizationFilters());
      setDebouncedRelationsPageFilters(storedRelationsFilters);
      setColumnWidths(storedRelationsColumnWidths);
      setColumnSettings(storedRelationsColumnSettings);
      setIsConfirmModalOpen(false);
      setIsResultModalOpen(false);
      setPendingFile(null);
      setLoading(false);
    }
    setIsAdministrationOpen(false);
    if (pageId !== PAGE_IDS.EMPLOYEES) {
      setLinkedEmployeeIdFilter("");
      setIsLinkedEmployeeLookupActive(false);
      setHasLinkedEmployeeLookupAttempt(false);
      setEmployeeIdToUrl("");
    }
  };

  const handleEmployeeRowClick = (rowIndex) => {
    if (isLinkedEmployeeLookupActive) {
      return;
    }
    const employeeId = String(employees[rowIndex]?.id ?? employees[rowIndex]?.employeeId ?? "").trim();
    setSelectedEmployeeSnapshot(employees[rowIndex] ?? null);
    if (!isEmployeeCardPanelOpen) {
      setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.MAIN);
    }
    setSelectedEmployeeId(employeeId);
    setSelectedRowIndex(rowIndex);
    setIsCreatingEmployeeCard(false);
    setIsEmployeeCardEditMode(false);
    if (isEmployeesPage) {
      setIsLinkedEmployeeLookupActive(false);
      setHasLinkedEmployeeLookupAttempt(false);
      setEmployeeIdToUrl(employeeId);
      setIsEmployeeCardPanelOpen(true);
      setIsColumnSettingsOpen(false);
    }
  };

  const handleCloseEmployeeCardPanel = () => {
    setIsEmployeeCardPanelOpen(false);
    setIsCreatingEmployeeCard(false);
    setIsEmployeeCardEditMode(false);
    setEmployeeCardEditForm(INITIAL_EMPLOYEE_CARD_EDIT_FORM);
    setSelectedEmployeeSnapshot(null);
    setSelectedEmployeeId("");
    setLinkedEmployeeIdFilter("");
    setIsLinkedEmployeeLookupActive(false);
    setHasLinkedEmployeeLookupAttempt(false);
    setEmployeeIdToUrl("");
  };

  const startEmployeeCardEditMode = () => {
    if (!selectedEmployee) {
      return;
    }
    setEmployeeCardEditForm(getEmployeeCardEditFormFromEmployee(selectedEmployee));
    setIsCreatingEmployeeCard(false);
    setIsEmployeeCardEditMode(true);
    setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.MAIN);
    cancelAddEmployeePositionRow();
    cancelAddEmployeeRelationRow();
  };

  const cancelEmployeeCardEditMode = () => {
    if (isCreatingEmployeeCard) {
      handleCloseEmployeeCardPanel();
      return;
    }
    setIsEmployeeCardEditMode(false);
    setEmployeeCardEditForm(INITIAL_EMPLOYEE_CARD_EDIT_FORM);
  };

  const openCreateEmployeeCard = () => {
    setSelectedEmployeeSnapshot(null);
    setSelectedEmployeeId("");
    setSelectedRowIndex(-1);
    setLinkedEmployeeIdFilter("");
    setIsLinkedEmployeeLookupActive(false);
    setHasLinkedEmployeeLookupAttempt(false);
    setEmployeeIdToUrl("");
    setIsCreatingEmployeeCard(true);
    setEmployeeCardEditForm(INITIAL_EMPLOYEE_CARD_EDIT_FORM);
    setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.MAIN);
    setIsEmployeeCardEditMode(true);
    setIsEmployeeCardPanelOpen(true);
  };

  const renderEmployeeCardTextInput = ({
    value,
    onChange,
    type = "text",
    inputMode = undefined,
    pattern = undefined,
    title = undefined
  }) => (
    <div className="employee-card-field-input-wrapper">
      <input
        type={type}
        inputMode={inputMode}
        pattern={pattern}
        title={title}
        className="employee-card-field-input"
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      />
      {String(value ?? "").length > 0 && (
        <button
          type="button"
          className="employee-card-field-input-clear-button"
          aria-label="Очистить поле"
          onClick={() => onChange("")}
        >
          ×
        </button>
      )}
    </div>
  );

  const saveEmployeeCardMainInfo = async () => {
    const employeeId = String(selectedEmployee?.id ?? selectedEmployee?.employeeId ?? "").trim();
    const isCreateMode = isCreatingEmployeeCard;
    if (!isCreateMode && !employeeId) {
      const errorMessage = "Не удалось определить employeeId";
      showSystemErrorToast(errorMessage);
      return;
    }

    const surname = String(employeeCardEditForm.surname ?? "").trim();
    const firstName = String(employeeCardEditForm.firstName ?? "").trim();
    const middleName = String(employeeCardEditForm.middleName ?? "").trim();
    const email = String(employeeCardEditForm.email ?? "").trim();
    const phoneNumber = String(employeeCardEditForm.phoneNumber ?? "").trim();
    const sapId = String(employeeCardEditForm.sapId ?? "").trim();
    const personalNumber = String(employeeCardEditForm.personalNumber ?? "").trim();
    const status = String(employeeCardEditForm.status ?? "")
      .trim()
      .toUpperCase();

    if (!email) {
      showSystemErrorToast("Не заполнено поле: email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showSystemErrorToast("Поле email должно соответствовать шаблону email");
      return;
    }
    if (phoneNumber && !/^[0-9()+-]+$/.test(phoneNumber)) {
      showSystemErrorToast("Поле телефон может содержать только цифры и символы + - ( )");
      return;
    }
    if (sapId && !/^\d{1,10}$/.test(sapId)) {
      showSystemErrorToast("Поле sap id должно содержать только цифры (до 10 символов)");
      return;
    }
    if (personalNumber && !/^\d{1,10}$/.test(personalNumber)) {
      showSystemErrorToast("Поле табельный номер должно содержать только цифры (до 10 символов)");
      return;
    }
    if (status !== "ACTIVE" && status !== "INACTIVE") {
      showSystemErrorToast("Поле статус должно быть ACTIVE или INACTIVE");
      return;
    }

    try {
      const response = await fetch(
        isCreateMode ? `${API_BASE_URL}/api/employee` : `${API_BASE_URL}/api/employee/${employeeId}`,
        {
          method: isCreateMode ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            toCamelApiPayload({
              surname: surname || null,
              firstName: firstName || null,
              middleName: middleName || null,
              email,
              phoneNumber: phoneNumber || null,
              sapId: sapId || null,
              personalNumber: personalNumber || null,
              status
            })
          )
        }
      );
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data.error ?? "Не удалось сохранить данные сотрудника");
        return;
      }

      const item = data?.item && typeof data.item === "object" ? data.item : null;
      if (item) {
        if (isCreateMode) {
          const createdEmployeeId = String(item?.id ?? item?.employeeId ?? "").trim();
          if (createdEmployeeId) {
            setSelectedEmployeeId(createdEmployeeId);
            setEmployeeIdToUrl(createdEmployeeId);
          }
          setSelectedEmployeeSnapshot(item);
        } else {
          setEmployees((prev) =>
            prev.map((row) => {
              const rowEmployeeId = String(row?.id ?? row?.employeeId ?? "").trim();
              return rowEmployeeId === employeeId ? { ...row, ...item } : row;
            })
          );
          setSelectedEmployeeSnapshot((prev) => (prev ? { ...prev, ...item } : prev));
        }
      }

      setIsCreatingEmployeeCard(false);
      setIsEmployeeCardEditMode(false);
      setEmployeeCardEditForm(INITIAL_EMPLOYEE_CARD_EDIT_FORM);
      refreshEmployeesList();
    } catch {
      showSystemErrorToast("Не удалось сохранить данные сотрудника");
    }
  };

  const goToPage = () => {
    const parsed = Number.parseInt(String(pageJumpInput).trim(), 10);
    if (!Number.isFinite(parsed)) {
      setPageJumpInput(String(currentPage));
      return;
    }

    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    setCurrentPage(clamped);
    setPageJumpInput(String(clamped));
  };

  const updateCellTooltipPosition = (event) => {
    setCellTooltip((prev) => ({
      ...prev,
      x: event.clientX + 12,
      y: event.clientY + 12
    }));
  };

  const handleCellMouseEnter = (event, value, fixedTooltipText = null) => {
    const valueText = String(value ?? "").trim();
    const fixedText = String(fixedTooltipText ?? "").trim();
    const tooltipText = fixedText || valueText;
    if (!tooltipText || tooltipText === "-") {
      setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
      return;
    }

    const shouldShow = fixedText
      ? true
      : event.currentTarget.scrollWidth > event.currentTarget.clientWidth;
    if (!shouldShow) {
      setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
      return;
    }

    setCellTooltip({
      visible: true,
      text: tooltipText,
      x: event.clientX + 12,
      y: event.clientY + 12
    });
  };

  const handleCellMouseLeave = () => {
    setCellTooltip((prev) => ({ ...prev, visible: false, text: "" }));
  };

  const formatOrganizationTooltip = ({
    organName,
    sapId,
    inn,
    kpp,
    ogrn,
    fullAddress
  }) => {
    const name = normalizeUiText(organName);
    const sap = normalizeUiText(sapId);
    const innValue = normalizeUiText(inn);
    const kppValue = normalizeUiText(kpp);
    const ogrnValue = normalizeUiText(ogrn);
    const addressValue = normalizeUiText(fullAddress);
    if (!name) {
      return "";
    }
    const lines = [sap ? `${name} (${sap})` : name];
    if (innValue || kppValue) {
      lines.push(`ИНН/КПП ${innValue || "-"} / ${kppValue || "-"}`);
    }
    if (ogrnValue) {
      lines.push(`ОГРН ${ogrnValue}`);
    }
    if (addressValue) {
      lines.push(addressValue);
    }
    return lines.join("\n");
  };

  const scrollContainerToTop = (containerRef) => {
    const container = containerRef?.current;
    if (!(container instanceof HTMLElement)) {
      return;
    }
    container.scrollTop = 0;
  };

  const getRelationSortDirectionForField = (field) => {
    const match = employeeRelationsSortRules.find((rule) => rule.field === field);
    return match ? match.direction : null;
  };

  const getRelationSortOrderForField = (field) => {
    const sortIndex = employeeRelationsSortRules.findIndex((rule) => rule.field === field);
    return sortIndex >= 0 ? sortIndex + 1 : null;
  };

  const handleRelationSortClick = (field) => {
    setEmployeeRelationsSortRules((prev) => {
      const index = prev.findIndex((rule) => rule.field === field);
      if (index === -1) {
        return [...prev, { field, direction: "ASC" }];
      }

      if (prev[index].direction === "ASC") {
        return prev.map((rule, ruleIndex) =>
          ruleIndex === index ? { ...rule, direction: "DESC" } : rule
        );
      }

      return prev.filter((_, ruleIndex) => ruleIndex !== index);
    });
  };

  const handleRelationFilterChange = (field, value) => {
    setEmployeeRelationsFilters((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const getRelationId = (relationRow) =>
    String(relationRow?.relationId ?? "").trim();

  const clearRelationFilters = () => {
    setEmployeeRelationsFilters(INITIAL_RELATION_FILTERS);
  };

  const fetchOrganizationOptions = async (filterValue, showShortCode) => {
    const normalizedFilter = String(filterValue ?? "").trim();
    const requestKey = showShortCode ? "sales" : "organ";
    relationOptionsRequestRef.current[requestKey] += 1;
    const requestId = relationOptionsRequestRef.current[requestKey];
    if (!showShortCode && !normalizedFilter) {
      setOrganizationOptions([]);
      return;
    }
    const params = new URLSearchParams({
      showShortCode: showShortCode ? "true" : "false"
    });
    if (normalizedFilter) {
      params.set("organName", normalizedFilter);
    }
    try {
      const response = await fetch(`${LIST_ORGANIZATIONS_API_URL}?${params.toString()}`);
      const data = await response.json();
      if (requestId !== relationOptionsRequestRef.current[requestKey]) {
        return;
      }
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось получить список организаций");
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      const normalizedItems = items.map((item) => {
        const baseName = normalizeUiText(item?.shName);
        const sapId = normalizeUiText(item?.sapId);
        const inn = normalizeUiText(item?.inn);
        const kpp = normalizeUiText(item?.kpp);
        const ogrn = normalizeUiText(item?.ogrn);
        const fullAddress = normalizeUiText(item?.fullAddress);
        return {
          id: String(item?.id ?? ""),
          name: sapId ? `${baseName} (${sapId})` : baseName,
          fieldName: baseName,
          sapId,
          inn,
          kpp,
          ogrn,
          fullAddress,
          tooltipLabel: sapId ? `${baseName} (${sapId})` : baseName
        };
      });
      if (showShortCode) {
        setSalesOrganizationOptions(normalizedItems);
      } else {
        setOrganizationOptions(normalizedItems);
      }
    } catch {
      if (requestId !== relationOptionsRequestRef.current[requestKey]) {
        return;
      }
      setEmployeeRelationsError("Не удалось получить список организаций");
    }
  };

  const fetchRelationTypeOptions = async (filterValue) => {
    const normalizedFilter = String(filterValue ?? "").trim();
    const params = new URLSearchParams();
    if (normalizedFilter) {
      params.set("relationName", normalizedFilter);
    }
    try {
      const response = await fetch(
        `${LIST_RELATIONS_API_URL}${params.toString() ? `?${params.toString()}` : ""}`
      );
      const data = await response.json();
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось получить список связей");
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setRelationTypeOptions(
        items.map((item) => ({
          id: String(item?.id ?? ""),
          name: String(item?.name ?? "").trim()
        }))
      );
    } catch {
      setEmployeeRelationsError("Не удалось получить список связей");
    }
  };

  const fetchProductGroupOptions = async (filterValue) => {
    const normalizedFilter = String(filterValue ?? "").trim();
    const params = new URLSearchParams();
    if (normalizedFilter) {
      params.set("productGroupName", normalizedFilter);
    }
    try {
      const response = await fetch(
        `${LIST_PRODUCT_GROUPS_API_URL}${params.toString() ? `?${params.toString()}` : ""}`
      );
      const data = await response.json();
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось получить список групп продуктов");
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setProductGroupOptions(
        items.map((item) => ({
          id: String(item?.id ?? ""),
          name: String(item?.name ?? "").trim()
        }))
      );
    } catch {
      setEmployeeRelationsError("Не удалось получить список групп продуктов");
    }
  };

  const fetchRelationEmployeeOptions = async (filterValue) => {
    const normalizedFilter = String(filterValue ?? "").trim();
    relationOptionsRequestRef.current.employee += 1;
    const requestId = relationOptionsRequestRef.current.employee;
    const params = new URLSearchParams();
    params.set("departUnitId", "");
    params.set("employeeId", "");
    if (normalizedFilter) {
      params.set("employeeName", normalizedFilter);
    }

    try {
      const response = await fetch(`${LIST_EMPLOYEES_API_URL}?${params.toString()}`);
      const data = await response.json();
      if (requestId !== relationOptionsRequestRef.current.employee) {
        return;
      }
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось получить список сотрудников");
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setRelationEmployeeOptions(
        items
          .map((item) => ({
            id: String(item?.employeeId ?? "").trim(),
            name: normalizeUiText(item?.employeeFullName)
          }))
          .filter((item) => item.id && item.name)
      );
    } catch {
      if (requestId !== relationOptionsRequestRef.current.employee) {
        return;
      }
      setEmployeeRelationsError("Не удалось получить список сотрудников");
    }
  };

  const fetchPositionOrganizationOptions = async (filterValue) => {
    const normalizedFilter = String(filterValue ?? "").trim();
    if (!normalizedFilter) {
      setPositionOrganizationOptions([]);
      return [];
    }
    const params = new URLSearchParams({
      showShortCode: "false",
      organName: normalizedFilter
    });
    try {
      const response = await fetch(`${LIST_ORGANIZATIONS_API_URL}?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось получить список организаций");
        return [];
      }
      const items = Array.isArray(data.items) ? data.items : [];
      const normalizedItems = items.map((item) => ({
          id: String(item?.id ?? ""),
          name: normalizeUiText(item?.sapId)
            ? `${normalizeUiText(item?.shName)} (${normalizeUiText(item?.sapId)})`
            : normalizeUiText(item?.shName),
          fieldName: normalizeUiText(item?.shName),
          sapId: normalizeUiText(item?.sapId),
          inn: normalizeUiText(item?.inn),
          kpp: normalizeUiText(item?.kpp),
          ogrn: normalizeUiText(item?.ogrn),
          fullAddress: normalizeUiText(item?.fullAddress),
          departments: Array.isArray(item?.departments)
            ? item.departments
                .map((department) => ({
                  id: String(department?.id ?? "").trim(),
                  name: normalizeUiText(department?.shName),
                  sapId: normalizeUiText(department?.sapId)
                }))
                .filter((department) => department.id && department.name)
            : []
        }));
      setPositionOrganizationOptions(normalizedItems);
      return normalizedItems;
    } catch {
      setEmployeeRelationsError("Не удалось получить список организаций");
      return [];
    }
  };

  const fetchPositionTitleOptions = async (filterValue) => {
    const normalizedFilter = String(filterValue ?? "").trim();
    const params = new URLSearchParams();
    if (normalizedFilter) {
      params.set("positionName", normalizedFilter);
    }
    try {
      const response = await fetch(
        `${LIST_POSITIONS_API_URL}${params.toString() ? `?${params.toString()}` : ""}`
      );
      const data = await response.json();
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось получить список должностей");
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setPositionTitleOptions(
        items.map((item) => ({
          id: String(item?.id ?? ""),
          name: normalizeUiText(item?.name),
          code: normalizeUiText(item?.code)
        }))
      );
    } catch {
      setEmployeeRelationsError("Не удалось получить список должностей");
    }
  };

  const fetchPositionEmployeeOptions = async (filterValue, departUnitId) => {
    const normalizedDepartUnitId = String(departUnitId ?? "").trim();
    const currentEmployeeId = String(selectedEmployeeIdForRelations ?? "").trim();
    if (!normalizedDepartUnitId) {
      setPositionEmployeeOptions([]);
      return;
    }
    if (!currentEmployeeId) {
      setPositionEmployeeOptions([]);
      return;
    }
    const params = new URLSearchParams();
    params.set("departUnitId", normalizedDepartUnitId);
    params.set("employeeId", currentEmployeeId);
    const normalizedFilter = String(filterValue ?? "").trim();
    if (normalizedFilter) {
      params.set("employeeName", normalizedFilter);
    }
    try {
      const response = await fetch(
        `${LIST_EMPLOYEES_API_URL}${params.toString() ? `?${params.toString()}` : ""}`
      );
      const data = await response.json();
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось получить список сотрудников");
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setPositionEmployeeOptions(
        items.map((item) => ({
          id: String(item?.employeeId ?? "").trim(),
          name: normalizeUiText(item?.employeeFullName)
        }))
      );
    } catch {
      setEmployeeRelationsError("Не удалось получить список сотрудников");
    }
  };

  useEffect(() => {
    const departUnitId = String(newEmployeePositionForm.departUnitId ?? "").trim();
    if (departUnitId) {
      return;
    }
    if (
      !String(newEmployeePositionForm.bossName ?? "").trim() &&
      !String(newEmployeePositionForm.bossEmployeeId ?? "").trim() &&
      !String(newEmployeePositionForm.bossNameFilter ?? "").trim()
    ) {
      return;
    }
    setNewEmployeePositionForm((prev) => ({
      ...prev,
      bossName: "",
      bossEmployeeId: "",
      bossNameFilter: ""
    }));
    setPositionEmployeeOptions([]);
    setActiveNewPositionCombo((prev) => (prev === "boss" ? null : prev));
  }, [
    newEmployeePositionForm.departUnitId,
    newEmployeePositionForm.bossName,
    newEmployeePositionForm.bossEmployeeId,
    newEmployeePositionForm.bossNameFilter
  ]);

  const getFilteredPositionDepartmentOptions = () => {
    const filterText = String(newEmployeePositionForm.departNameFilter ?? "").trim().toLowerCase();
    const departments = Array.isArray(newEmployeePositionForm.departments)
      ? newEmployeePositionForm.departments
      : [];
    if (!filterText) {
      return departments;
    }
    return departments.filter((department) =>
      String(department?.name ?? "")
        .trim()
        .toLowerCase()
        .includes(filterText)
    );
  };

  const openAddEmployeeRelationRow = async () => {
    const relationTargetRef = isEmployeeRelationsPage ? tableWrapperRef : relationTableWrapperRef;
    scrollContainerToTop(relationTargetRef);
    setEmployeeRelationsError("");
    setIsAddingEmployeeRelation(true);
    setEditingEmployeeRelationId("");
    setActiveNewRelationCombo(null);
    setRelationComboMenuLayouts({});
    setNewEmployeeRelationForm({
      ...INITIAL_NEW_RELATION_FORM,
      defaultFlag: false
    });
    lastConfirmedOrganRef.current = {
      id: "",
      name: "",
      sapId: "",
      inn: "",
      kpp: "",
      ogrn: "",
      fullAddress: ""
    };
    lastConfirmedRelationEmployeeRef.current = { id: "", name: "" };
    lastConfirmedRelationRef.current = { id: "", name: "" };
    lastConfirmedSalesRef.current = { id: "", name: "" };
    lastConfirmedProductRef.current = { id: "", name: "" };
    setOrganizationOptions([]);
    setRelationEmployeeOptions([]);
    await Promise.all(
      [
        isEmployeeRelationsPage ? fetchRelationEmployeeOptions("") : null,
        fetchRelationTypeOptions(""),
        fetchOrganizationOptions("", true),
        fetchProductGroupOptions("")
      ].filter(Boolean)
    );
    requestAnimationFrame(() => {
      scrollContainerToTop(relationTargetRef);
    });
  };

  const cancelAddEmployeeRelationRow = () => {
    setEmployeeRelationsError("");
    setIsAddingEmployeeRelation(false);
    setEditingEmployeeRelationId("");
    setActiveNewRelationCombo(null);
    setRelationComboMenuLayouts({});
    setNewEmployeeRelationForm(INITIAL_NEW_RELATION_FORM);
    setOrganizationOptions([]);
    setRelationEmployeeOptions([]);
    setRelationTypeOptions([]);
    setSalesOrganizationOptions([]);
    setProductGroupOptions([]);
    lastConfirmedOrganRef.current = {
      id: "",
      name: "",
      sapId: "",
      inn: "",
      kpp: "",
      ogrn: "",
      fullAddress: ""
    };
    lastConfirmedRelationEmployeeRef.current = { id: "", name: "" };
    lastConfirmedRelationRef.current = { id: "", name: "" };
    lastConfirmedSalesRef.current = { id: "", name: "" };
    lastConfirmedProductRef.current = { id: "", name: "" };
  };

  const openAddEmployeePositionRow = async () => {
    scrollContainerToTop(positionsTableWrapperRef);
    setEmployeeRelationsError("");
    setIsAddingEmployeePosition(true);
    setEditingEmployeePositionId("");
    setNewEmployeePositionForm(INITIAL_NEW_POSITION_FORM);
    setPositionOrganizationOptions([]);
    setPositionTitleOptions([]);
    setPositionEmployeeOptions([]);
    setActiveNewPositionCombo(null);
    setPositionComboMenuLayouts({});
    requestAnimationFrame(() => {
      scrollContainerToTop(positionsTableWrapperRef);
    });
  };

  const cancelAddEmployeePositionRow = () => {
    setEmployeeRelationsError("");
    setIsAddingEmployeePosition(false);
    setEditingEmployeePositionId("");
    setNewEmployeePositionForm(INITIAL_NEW_POSITION_FORM);
    setPositionOrganizationOptions([]);
    setPositionTitleOptions([]);
    setPositionEmployeeOptions([]);
    setActiveNewPositionCombo(null);
    setPositionComboMenuLayouts({});
  };

  const updatePositionComboMenuLayout = (comboKey) => {
    const inputElement = positionComboInputRefs.current[comboKey];
    const tableWrapperElement = positionsTableWrapperRef.current;
    if (!(inputElement instanceof HTMLElement) || !(tableWrapperElement instanceof HTMLElement)) {
      return;
    }
    const inputRect = inputElement.getBoundingClientRect();
    const wrapperRect = tableWrapperElement.getBoundingClientRect();
    const spaceBelow = Math.max(0, wrapperRect.bottom - inputRect.bottom - 8);
    const spaceAbove = Math.max(0, inputRect.top - wrapperRect.top - 8);
    const preferredOptionsHeight = RELATION_COMBO_VISIBLE_OPTION_COUNT * RELATION_COMBO_OPTION_HEIGHT_PX;
    const openUpward = spaceBelow < preferredOptionsHeight && spaceAbove > spaceBelow;
    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const optionsMaxHeight = Math.max(
      RELATION_COMBO_OPTION_HEIGHT_PX * 3,
      Math.min(preferredOptionsHeight, availableSpace - RELATION_COMBO_MENU_PADDING_PX)
    );

    setPositionComboMenuLayouts((prev) => ({
      ...prev,
      [comboKey]: {
        optionsMaxHeight,
        openUpward,
        left: inputRect.left,
        width: inputRect.width,
        top: inputRect.bottom + 4,
        bottom: window.innerHeight - inputRect.top + 4
      }
    }));
  };

  const openNewPositionCombo = async (comboKey) => {
    setActiveNewPositionCombo(comboKey);
    requestAnimationFrame(() => updatePositionComboMenuLayout(comboKey));
    if (comboKey === "organ") {
      await fetchPositionOrganizationOptions(newEmployeePositionForm.organNameFilter);
      return;
    }
    if (comboKey === "depart") {
      setNewEmployeePositionForm((prev) => ({
        ...prev,
        departNameFilter: ""
      }));
      return;
    }
    if (comboKey === "position") {
      setNewEmployeePositionForm((prev) => ({
        ...prev,
        positionNameFilter: ""
      }));
      await fetchPositionTitleOptions("");
      return;
    }
    if (comboKey === "boss") {
      setNewEmployeePositionForm((prev) => ({
        ...prev,
        bossNameFilter: ""
      }));
      await fetchPositionEmployeeOptions("", newEmployeePositionForm.departUnitId);
      return;
    }
  };

  const openEditEmployeePositionRow = async (positionRow) => {
    const employeeOrganId = String(positionRow?.employeeOrganId ?? "").trim();
    if (!employeeOrganId) {
      setEmployeeRelationsError("Не удалось определить employeeOrganId для редактирования");
      return;
    }

    setEmployeeRelationsError("");
    setIsAddingEmployeePosition(false);
    setEditingEmployeePositionId(employeeOrganId);
    setPositionOrganizationOptions([]);
    setPositionTitleOptions([]);
    setPositionEmployeeOptions([]);
    setActiveNewPositionCombo(null);
    setPositionComboMenuLayouts({});

    const formState = {
      ...INITIAL_NEW_POSITION_FORM,
      organName: String(positionRow?.organName ?? "").trim(),
      organUnitId: String(positionRow?.organUnitId ?? "").trim(),
      departments: [],
      departName: String(positionRow?.departName ?? "").trim(),
      departUnitId: String(positionRow?.departUnitId ?? "").trim(),
      positionName: String(positionRow?.positionName ?? "").trim(),
      employeePositionId: String(positionRow?.positionId ?? "").trim(),
      bossName: String(positionRow?.bossName ?? "").trim(),
      bossEmployeeId: String(positionRow?.bossId ?? "").trim(),
      organNameFilter: String(positionRow?.organName ?? "").trim(),
      departNameFilter: "",
      positionNameFilter: "",
      bossNameFilter: ""
    };
    setNewEmployeePositionForm(formState);

    const [fetchedOrganizations] = await Promise.all([
      fetchPositionOrganizationOptions(formState.organNameFilter),
      fetchPositionTitleOptions(""),
      fetchPositionEmployeeOptions("", formState.departUnitId)
    ]);

    const selectedOrganization = Array.isArray(fetchedOrganizations)
      ? fetchedOrganizations.find((item) => String(item?.id ?? "").trim() === formState.organUnitId)
      : null;

    if (selectedOrganization) {
      setNewEmployeePositionForm((prev) => ({
        ...prev,
        departments: Array.isArray(selectedOrganization.departments)
          ? selectedOrganization.departments
          : []
      }));
    }
  };

  const saveEmployeePosition = async () => {
    if (!selectedEmployeeIdForRelations) {
      const errorMessage = "Не удалось определить employeeId";
      showEmployeeRelationsError(errorMessage);
      showSystemErrorToast(errorMessage);
      return;
    }
    if (!String(newEmployeePositionForm.departUnitId ?? "").trim()) {
      const errorMessage = "Не заполнено поле: Подразделение";
      showEmployeeRelationsError(errorMessage);
      showSystemErrorToast(errorMessage);
      return;
    }

    try {
      const isEditMode = Boolean(editingEmployeePositionId);
      const endpoint = isEditMode
        ? `${API_BASE_URL}/api/employee-position/${editingEmployeePositionId}`
        : `${API_BASE_URL}/api/employee-position`;
      const response = await fetch(endpoint, {
        method: isEditMode ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          toCamelApiPayload({
            employeeId: selectedEmployeeIdForRelations,
            organUnitId: newEmployeePositionForm.departUnitId,
            employeePositionId: String(newEmployeePositionForm.employeePositionId ?? "").trim() || null,
            bossEmployeeId: String(newEmployeePositionForm.bossEmployeeId ?? "").trim() || null
          })
        )
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMessage = data.error ?? "Не удалось сохранить связь подчинения";
        showEmployeeRelationsError(errorMessage);
        showSystemErrorToast(errorMessage);
        return;
      }

      const item = normalizeEmployeePositionItem(data?.item);
      if (item) {
        setEmployees((prev) =>
          prev.map((row) => {
            const rowEmployeeId = String(row?.id ?? row?.employeeId ?? "").trim();
            if (rowEmployeeId !== selectedEmployeeIdForRelations) {
              return row;
            }
            const positions = Array.isArray(row?.positions) ? row.positions : [];
            return {
              ...row,
              positions: isEditMode
                ? positions.map((position) =>
                    String(position?.employeeOrganId ?? "").trim() === editingEmployeePositionId
                      ? item
                      : position
                  )
                : [item, ...positions]
            };
          })
        );
        setSelectedEmployeeSnapshot((prev) => {
          if (!prev) {
            return prev;
          }
          const positions = Array.isArray(prev.positions) ? prev.positions : [];
          return {
            ...prev,
            positions: isEditMode
              ? positions.map((position) =>
                  String(position?.employeeOrganId ?? "").trim() === editingEmployeePositionId
                    ? item
                    : position
                )
              : [item, ...positions]
          };
        });
      }
      refreshEmployeesList();
      cancelAddEmployeePositionRow();
    } catch {
      const errorMessage = "Не удалось сохранить связь подчинения";
      showEmployeeRelationsError(errorMessage);
      showSystemErrorToast(errorMessage);
    }
  };

  const openEditEmployeeRelationRow = async (relationRow) => {
    const relationId = getRelationId(relationRow);
    if (!relationId) {
      setEmployeeRelationsError("Не удалось определить relationId для редактирования");
      return;
    }

    setEmployeeRelationsError("");
    setIsAddingEmployeeRelation(false);
    setEditingEmployeeRelationId(relationId);
    setActiveNewRelationCombo(null);
    setRelationComboMenuLayouts({});
    setNewEmployeeRelationForm({
      ...INITIAL_NEW_RELATION_FORM,
      employeeNameFilter: "",
      employeeName: String(relationRow?.employeeName ?? "").trim(),
      employeeId: String(relationRow?.employeeId ?? "").trim(),
      organNameFilter: String(relationRow?.organName ?? "").trim(),
      organName: String(relationRow?.organName ?? "").trim(),
      organSapId: String(relationRow?.organSapId ?? "").trim(),
      organInn: String(relationRow?.organInn ?? "").trim(),
      organKpp: String(relationRow?.organKpp ?? "").trim(),
      organOgrn: String(relationRow?.organOgrn ?? "").trim(),
      organFullAddress: String(relationRow?.organFullAddress ?? "").trim(),
      organUnitId: String(relationRow?.organUnitId ?? "").trim(),
      relationNameFilter: "",
      relationName: String(relationRow?.relationName ?? "").trim(),
      relationTypeId: String(relationRow?.relationTypeId ?? "").trim(),
      salesOrganNameFilter: "",
      salesOrganName: String(relationRow?.salesOrganName ?? "").trim(),
      salesOrganizationId: String(relationRow?.salesOrganizationId ?? "").trim(),
      productGroupNameFilter: "",
      productGroupName: String(relationRow?.productGroupName ?? "").trim(),
      productGroupsId: String(relationRow?.productGroupsId ?? "").trim(),
      defaultFlag: relationRow?.defaultFlag === true
    });
    lastConfirmedRelationEmployeeRef.current = {
      id: String(relationRow?.employeeId ?? "").trim(),
      name: String(relationRow?.employeeName ?? "").trim()
    };
    lastConfirmedOrganRef.current = {
      id: String(relationRow?.organUnitId ?? "").trim(),
      name: String(relationRow?.organName ?? "").trim(),
      sapId: String(relationRow?.organSapId ?? "").trim(),
      inn: String(relationRow?.organInn ?? "").trim(),
      kpp: String(relationRow?.organKpp ?? "").trim(),
      ogrn: String(relationRow?.organOgrn ?? "").trim(),
      fullAddress: String(relationRow?.organFullAddress ?? "").trim()
    };
    lastConfirmedRelationRef.current = {
      id: String(relationRow?.relationTypeId ?? "").trim(),
      name: String(relationRow?.relationName ?? "").trim()
    };
    lastConfirmedSalesRef.current = {
      id: String(relationRow?.salesOrganizationId ?? "").trim(),
      name: String(relationRow?.salesOrganName ?? "").trim()
    };
    lastConfirmedProductRef.current = {
      id: String(relationRow?.productGroupsId ?? "").trim(),
      name: String(relationRow?.productGroupName ?? "").trim()
    };
    setOrganizationOptions([]);
    setRelationEmployeeOptions([]);
    await Promise.all(
      [
        isEmployeeRelationsPage ? fetchRelationEmployeeOptions("") : null,
        fetchRelationTypeOptions(""),
        fetchOrganizationOptions("", true),
        fetchProductGroupOptions("")
      ].filter(Boolean)
    );
  };

  const handleOrganFieldBlur = () => {
    setTimeout(() => {
      if (relationComboClearInProgressRef.current.organ) {
        relationComboClearInProgressRef.current.organ = false;
        return;
      }
      if (relationComboSelectInProgressRef.current.organ) {
        relationComboSelectInProgressRef.current.organ = false;
        return;
      }
      setNewEmployeeRelationForm((prev) => {
        const currentOrganId = String(prev.organUnitId ?? "").trim();
        if (currentOrganId) {
          return prev;
        }
        const currentOrganFilter = String(prev.organNameFilter ?? "").trim();
        const currentOrganValue = String(prev.organName ?? "").trim();
        if (!currentOrganFilter && !currentOrganValue) {
          return prev;
        }
        const fallbackId = String(lastConfirmedOrganRef.current.id ?? "").trim();
        const fallbackName = String(lastConfirmedOrganRef.current.name ?? "").trim();
        const fallbackSapId = String(lastConfirmedOrganRef.current.sapId ?? "").trim();
        const fallbackInn = String(lastConfirmedOrganRef.current.inn ?? "").trim();
        const fallbackKpp = String(lastConfirmedOrganRef.current.kpp ?? "").trim();
        const fallbackOgrn = String(lastConfirmedOrganRef.current.ogrn ?? "").trim();
        const fallbackFullAddress = String(lastConfirmedOrganRef.current.fullAddress ?? "").trim();
        return {
          ...prev,
          organNameFilter: fallbackName,
          organName: fallbackName,
          organSapId: fallbackSapId,
          organInn: fallbackInn,
          organKpp: fallbackKpp,
          organOgrn: fallbackOgrn,
          organFullAddress: fallbackFullAddress,
          organUnitId: fallbackId
        };
      });
      setActiveNewRelationCombo((prev) => (prev === "organ" ? null : prev));
    }, 0);
  };

  const createRelationFieldBlurHandler = (
    comboKey,
    idFieldName,
    filterFieldName,
    valueFieldName,
    sourceRef
  ) => () => {
    setTimeout(() => {
      if (relationComboClearInProgressRef.current[comboKey]) {
        relationComboClearInProgressRef.current[comboKey] = false;
        return;
      }
      if (relationComboSelectInProgressRef.current[comboKey]) {
        relationComboSelectInProgressRef.current[comboKey] = false;
        return;
      }
      setNewEmployeeRelationForm((prev) => {
        const currentId = String(prev[idFieldName] ?? "").trim();
        if (currentId) {
          return prev;
        }
        const currentFilterValue = String(prev[filterFieldName] ?? "").trim();
        const currentDisplayValue = String(prev[valueFieldName] ?? "").trim();
        if (!currentFilterValue && !currentDisplayValue) {
          return prev;
        }
        const fallbackId = String(sourceRef.current.id ?? "").trim();
        const fallbackName = String(sourceRef.current.name ?? "").trim();
        return {
          ...prev,
          [filterFieldName]: fallbackName,
          [valueFieldName]: fallbackName,
          [idFieldName]: fallbackId
        };
      });
      setActiveNewRelationCombo((prev) => (prev === comboKey ? null : prev));
    }, 0);
  };

  const handleRelationEmployeeFieldBlur = createRelationFieldBlurHandler(
    "employee",
    "employeeId",
    "employeeNameFilter",
    "employeeName",
    lastConfirmedRelationEmployeeRef
  );
  const handleRelationTypeFieldBlur = createRelationFieldBlurHandler(
    "relation",
    "relationTypeId",
    "relationNameFilter",
    "relationName",
    lastConfirmedRelationRef
  );
  const handleSalesFieldBlur = createRelationFieldBlurHandler(
    "sales",
    "salesOrganizationId",
    "salesOrganNameFilter",
    "salesOrganName",
    lastConfirmedSalesRef
  );
  const handleProductFieldBlur = createRelationFieldBlurHandler(
    "product",
    "productGroupsId",
    "productGroupNameFilter",
    "productGroupName",
    lastConfirmedProductRef
  );

  const saveNewEmployeeRelation = async () => {
    const relationEmployeeId = isEmployeeRelationsPage
      ? String(newEmployeeRelationForm.employeeId ?? "").trim()
      : selectedEmployeeIdForRelations;
    if (!relationEmployeeId) {
      setEmployeeRelationsError("Не удалось определить employeeId");
      return;
    }
    const requiredMappings = [
      ...(isEmployeeRelationsPage ? [["employeeId", "ФИО сотрудника"]] : []),
      ["organUnitId", "Организация"],
      ["relationTypeId", "Тип отношения"]
    ];
    const missed = requiredMappings.find(([field]) => !String(newEmployeeRelationForm[field] ?? "").trim());
    if (missed) {
      setEmployeeRelationsError(`Не заполнено поле: ${missed[1]}`);
      return;
    }

    try {
      const isEditMode = Boolean(editingEmployeeRelationId);
      const endpoint = isEditMode
        ? `${API_BASE_URL}/api/relation/${editingEmployeeRelationId}`
        : `${API_BASE_URL}/api/relation`;
      const response = await fetch(endpoint, {
        method: isEditMode ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          toCamelApiPayload({
            employeeId: relationEmployeeId,
            organUnitId: newEmployeeRelationForm.organUnitId,
            relationTypeId: newEmployeeRelationForm.relationTypeId,
            salesOrganizationId: newEmployeeRelationForm.salesOrganizationId,
            defaultFlag: newEmployeeRelationForm.defaultFlag === true,
            productGroupsId: newEmployeeRelationForm.productGroupsId
          })
        )
      });
      const data = await response.json();
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось сохранить связь");
        return;
      }

      if (data?.item && typeof data.item === "object") {
        const normalizedItem = normalizeRelationListItem({
          ...data.item,
          employeeId: data.item.employeeId ?? relationEmployeeId,
          employeeName: data.item.employeeName ?? newEmployeeRelationForm.employeeName
        });
        if (!normalizedItem) {
          cancelAddEmployeeRelationRow();
          return;
        }
        if (isEditMode) {
          if (isEmployeeRelationsPage) {
            setEmployees((prev) =>
              prev.map((row) => (getRelationId(row) === editingEmployeeRelationId ? normalizedItem : row))
            );
          } else {
            setEmployeeRelations((prev) =>
              prev.map((row) => (getRelationId(row) === editingEmployeeRelationId ? normalizedItem : row))
            );
          }
        } else {
          if (isEmployeeRelationsPage) {
            setEmployees((prev) => [normalizedItem, ...prev]);
          } else {
            setEmployeeRelations((prev) => [normalizedItem, ...prev]);
          }
        }
      }
      cancelAddEmployeeRelationRow();
    } catch {
      setEmployeeRelationsError("Не удалось сохранить связь");
    }
  };

  useEffect(() => {
    if (!isRelationFormActive) {
      return;
    }
    const handleMouseDown = (event) => {
      if (event.target instanceof Element && event.target.closest(".relation-combobox")) {
        return;
      }
      setActiveNewRelationCombo(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isRelationFormActive]);

  useEffect(() => {
    if (!isPositionFormActive) {
      return;
    }
    const handleMouseDown = (event) => {
      if (event.target instanceof Element && event.target.closest(".relation-combobox")) {
        return;
      }
      setActiveNewPositionCombo(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isPositionFormActive]);

  const updateRelationComboMenuLayout = (comboKey) => {
    const inputElement = relationComboInputRefs.current[comboKey];
    const tabContentElement = employeeRelationsTabContentRef.current ?? tableWrapperRef.current;
    if (!(inputElement instanceof HTMLElement) || !(tabContentElement instanceof HTMLElement)) {
      return;
    }

    const inputRect = inputElement.getBoundingClientRect();
    const tabRect = tabContentElement.getBoundingClientRect();
    const spaceBelow = Math.max(0, tabRect.bottom - inputRect.bottom - 8);
    const spaceAbove = Math.max(0, inputRect.top - tabRect.top - 8);
    const preferredOptionsHeight = RELATION_COMBO_VISIBLE_OPTION_COUNT * RELATION_COMBO_OPTION_HEIGHT_PX;
    const openUpward = spaceBelow < preferredOptionsHeight && spaceAbove > spaceBelow;
    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const optionsMaxHeight = Math.max(
      RELATION_COMBO_OPTION_HEIGHT_PX * 3,
      Math.min(preferredOptionsHeight, availableSpace - RELATION_COMBO_MENU_PADDING_PX)
    );

    setRelationComboMenuLayouts((prev) => ({
      ...prev,
      [comboKey]: {
        optionsMaxHeight,
        openUpward,
        left: inputRect.left,
        width: inputRect.width,
        top: inputRect.bottom + 4,
        bottom: window.innerHeight - inputRect.top + 4
      }
    }));
  };

  const openNewRelationCombo = async (comboKey) => {
    setActiveNewRelationCombo(comboKey);
    requestAnimationFrame(() => updateRelationComboMenuLayout(comboKey));
    if (comboKey === "employee") {
      setNewEmployeeRelationForm((prev) => ({ ...prev, employeeNameFilter: "" }));
      await fetchRelationEmployeeOptions("");
    } else if (comboKey === "organ") {
      if (isEditingEmployeeRelation) {
        await fetchOrganizationOptions(
          newEmployeeRelationForm.organNameFilter || newEmployeeRelationForm.organName,
          false
        );
      }
    } else if (comboKey === "relation") {
      setNewEmployeeRelationForm((prev) => ({ ...prev, relationNameFilter: "" }));
      await fetchRelationTypeOptions("");
    } else if (comboKey === "sales") {
      setNewEmployeeRelationForm((prev) => ({ ...prev, salesOrganNameFilter: "" }));
      await fetchOrganizationOptions("", true);
    } else if (comboKey === "product") {
      setNewEmployeeRelationForm((prev) => ({ ...prev, productGroupNameFilter: "" }));
      await fetchProductGroupOptions("");
    }
  };

  useEffect(() => {
    if (!activeNewRelationCombo) {
      return;
    }
    const handleLayoutUpdate = () => updateRelationComboMenuLayout(activeNewRelationCombo);
    handleLayoutUpdate();
    window.addEventListener("resize", handleLayoutUpdate);
    window.addEventListener("scroll", handleLayoutUpdate, true);
    return () => {
      window.removeEventListener("resize", handleLayoutUpdate);
      window.removeEventListener("scroll", handleLayoutUpdate, true);
    };
  }, [activeNewRelationCombo]);

  useEffect(() => {
    if (!employeesError) {
      return;
    }
    showSystemErrorToast(employeesError);
  }, [employeesError, showSystemErrorToast]);

  useEffect(() => {
    if (!employeeRelationsError) {
      return;
    }
    showSystemErrorToast(employeeRelationsError);
  }, [employeeRelationsError, showSystemErrorToast]);

  useEffect(() => {
    if (!String(systemErrorToast?.message ?? "").trim()) {
      setIsSystemErrorToastClosing(false);
      return;
    }

    setIsSystemErrorToastClosing(false);
    const closeAnimationTimer = window.setTimeout(() => {
      setIsSystemErrorToastClosing(true);
    }, 2600);
    const hideTimer = window.setTimeout(() => {
      setSystemErrorToast((prev) => ({ ...prev, message: "" }));
      setIsSystemErrorToastClosing(false);
    }, 3000);

    return () => {
      window.clearTimeout(closeAnimationTimer);
      window.clearTimeout(hideTimer);
    };
  }, [systemErrorToast?.id, systemErrorToast?.message]);

  const renderRelationComboBox = ({
    comboKey,
    placeholder,
    selectedValue,
    filterValue,
    options,
    onFilterChange,
    onSelect,
    onBlur,
    onClear,
    tooltipText
  }) => (
    <div className={`relation-combobox${activeNewRelationCombo === comboKey ? " open" : ""}`}>
      <input
        type="text"
        className="relation-combobox-trigger employee-card-relations-filter-input"
        ref={(element) => {
          relationComboInputRefs.current[comboKey] = element;
        }}
        value={
          activeNewRelationCombo === comboKey
            ? filterValue || selectedValue || ""
            : selectedValue || filterValue
        }
        placeholder={placeholder}
        onFocus={() => openNewRelationCombo(comboKey)}
        onChange={(event) => {
          if (activeNewRelationCombo !== comboKey) {
            setActiveNewRelationCombo(comboKey);
          }
          onFilterChange(event.target.value);
        }}
        onBlur={() => onBlur?.()}
        onMouseEnter={(event) => {
          if (tooltipText) {
            handleCellMouseEnter(event, tooltipText, tooltipText);
          }
        }}
        onMouseMove={(event) => {
          if (tooltipText) {
            updateCellTooltipPosition(event);
          }
        }}
        onMouseLeave={() => {
          if (tooltipText) {
            handleCellMouseLeave();
          }
        }}
      />
      {String(activeNewRelationCombo === comboKey ? filterValue || selectedValue || "" : selectedValue || filterValue)
        .trim() && (
        <button
          type="button"
          className="relation-combobox-clear-button"
          aria-label="Очистить поле"
          onMouseDown={() => {
            relationComboClearInProgressRef.current[comboKey] = true;
          }}
          onClick={() => {
            onClear?.();
            setActiveNewRelationCombo((prev) => (prev === comboKey ? null : prev));
          }}
        >
          ×
        </button>
      )}
      {activeNewRelationCombo === comboKey && (
        <div
          className={`relation-combobox-menu${
            relationComboMenuLayouts[comboKey]?.openUpward ? " relation-combobox-menu-upward" : ""
          }`}
          style={{
            left: `${relationComboMenuLayouts[comboKey]?.left ?? 0}px`,
            width: `${relationComboMenuLayouts[comboKey]?.width ?? 0}px`,
            top: relationComboMenuLayouts[comboKey]?.openUpward
              ? "auto"
              : `${relationComboMenuLayouts[comboKey]?.top ?? 0}px`,
            bottom: relationComboMenuLayouts[comboKey]?.openUpward
              ? `${relationComboMenuLayouts[comboKey]?.bottom ?? 0}px`
              : "auto"
          }}
        >
          <div
            className="relation-combobox-options"
            style={{
              maxHeight: `${relationComboMenuLayouts[comboKey]?.optionsMaxHeight ?? 180}px`
            }}
          >
            {options.length === 0 ? (
              <div className="relation-combobox-empty">Нет данных</div>
            ) : (
              options.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="relation-combobox-option"
                  onMouseDown={() => {
                    relationComboSelectInProgressRef.current[comboKey] = true;
                  }}
                  onClick={() => {
                    onSelect(item);
                    setActiveNewRelationCombo(null);
                  }}
                  onMouseEnter={(event) => {
                    const tooltipText =
                      (comboKey === "organ" || comboKey === "sales") && item?.fieldName
                        ? formatOrganizationTooltip({
                            organName: item.fieldName,
                            sapId: item.sapId,
                            inn: item.inn,
                            kpp: item.kpp,
                            ogrn: item.ogrn,
                            fullAddress: item.fullAddress
                          })
                        : item.tooltipLabel ?? item.name;
                    handleCellMouseEnter(
                      event,
                      tooltipText,
                      comboKey === "organ" || comboKey === "sales" ? tooltipText : null
                    );
                  }}
                  onMouseMove={updateCellTooltipPosition}
                  onMouseLeave={handleCellMouseLeave}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderPositionComboBox = ({
    comboKey,
    placeholder,
    selectedValue,
    filterValue,
    options,
    onFilterChange,
    onSelect,
    onClear,
    onBlur,
    disabled = false
  }) => (
    <div className="relation-combobox">
      <input
        type="text"
        className="employee-card-relations-filter-input relation-combobox-trigger"
        ref={(element) => {
          positionComboInputRefs.current[comboKey] = element;
        }}
        value={activeNewPositionCombo === comboKey ? filterValue || selectedValue || "" : selectedValue || filterValue}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          if (disabled) {
            return;
          }
          openNewPositionCombo(comboKey);
        }}
        onChange={(event) => {
          if (disabled) {
            return;
          }
          if (activeNewPositionCombo !== comboKey) {
            setActiveNewPositionCombo(comboKey);
          }
          onFilterChange(event.target.value);
        }}
        onBlur={() => onBlur?.()}
      />
      {!disabled &&
        String(
        activeNewPositionCombo === comboKey ? filterValue || selectedValue || "" : selectedValue || filterValue
      ).trim() && (
        <button
          type="button"
          className="relation-combobox-clear-button"
          aria-label="Очистить поле"
          onClick={() => {
            onClear?.();
            setActiveNewPositionCombo((prev) => (prev === comboKey ? null : prev));
          }}
        >
          ×
        </button>
      )}
      {!disabled && activeNewPositionCombo === comboKey && (
        <div
          className={`relation-combobox-menu${
            positionComboMenuLayouts[comboKey]?.openUpward ? " relation-combobox-menu-upward" : ""
          }`}
          style={{
            left: `${positionComboMenuLayouts[comboKey]?.left ?? 0}px`,
            width: `${positionComboMenuLayouts[comboKey]?.width ?? 0}px`,
            top: positionComboMenuLayouts[comboKey]?.openUpward
              ? "auto"
              : `${positionComboMenuLayouts[comboKey]?.top ?? 0}px`,
            bottom: positionComboMenuLayouts[comboKey]?.openUpward
              ? `${positionComboMenuLayouts[comboKey]?.bottom ?? 0}px`
              : "auto"
          }}
        >
          <div
            className="relation-combobox-options"
            style={{
              maxHeight: `${positionComboMenuLayouts[comboKey]?.optionsMaxHeight ?? 180}px`
            }}
          >
            {options.length === 0 ? (
              <div className="relation-combobox-empty">Нет данных</div>
            ) : (
              options.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="relation-combobox-option"
                  onMouseEnter={(event) => {
                    if (comboKey === "organ" && item?.fieldName) {
                      const tooltipText = formatOrganizationTooltip({
                        organName: item.fieldName,
                        sapId: item.sapId,
                        inn: item.inn,
                        kpp: item.kpp,
                        ogrn: item.ogrn,
                        fullAddress: item.fullAddress
                      });
                      handleCellMouseEnter(event, tooltipText, tooltipText);
                    }
                  }}
                  onMouseMove={(event) => {
                    if (comboKey === "organ") {
                      updateCellTooltipPosition(event);
                    }
                  }}
                  onMouseLeave={() => {
                    if (comboKey === "organ") {
                      handleCellMouseLeave();
                    }
                  }}
                  onClick={() => {
                    onSelect(item);
                    setActiveNewPositionCombo(null);
                  }}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderEmployeePositionFormRow = (cancelTitle, rowKey) => {
    const departmentOptions = getFilteredPositionDepartmentOptions();
    const isBossFieldEnabled = Boolean(String(newEmployeePositionForm.departUnitId ?? "").trim());
    return (
      <tr className="employee-card-relations-edit-row" key={rowKey}>
        <td>
          {renderPositionComboBox({
            comboKey: "organ",
            placeholder: "Выберите организацию",
            selectedValue: newEmployeePositionForm.organName,
            filterValue: newEmployeePositionForm.organNameFilter,
            options: positionOrganizationOptions,
            onFilterChange: (value) => {
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                organNameFilter: value
              }));
              fetchPositionOrganizationOptions(value);
            },
            onSelect: (item) => {
              setNewEmployeePositionForm((prev) => {
                const departments = Array.isArray(item.departments) ? item.departments : [];
                const currentDepartId = String(prev.departUnitId ?? "").trim();
                const hasCurrentDepart = departments.some((department) => department.id === currentDepartId);
                return {
                  ...prev,
                  organName: item.fieldName || item.name,
                  organNameFilter: item.fieldName || item.name,
                  organUnitId: item.id,
                  departments,
                  departName: hasCurrentDepart ? prev.departName : "",
                  departNameFilter: hasCurrentDepart ? prev.departNameFilter : "",
                  departUnitId: hasCurrentDepart ? prev.departUnitId : "",
                  bossName: hasCurrentDepart ? prev.bossName : "",
                  bossEmployeeId: hasCurrentDepart ? prev.bossEmployeeId : "",
                  bossNameFilter: ""
                };
              });
              if (!String(newEmployeePositionForm.departUnitId ?? "").trim()) {
                setPositionEmployeeOptions([]);
              }
            },
            onClear: () =>
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                organName: "",
                organNameFilter: "",
                organUnitId: "",
                departments: [],
                departName: "",
                departNameFilter: "",
                departUnitId: "",
                bossName: "",
                bossEmployeeId: "",
                bossNameFilter: ""
              })),
            onBlur: () => {
              setPositionEmployeeOptions([]);
            }
          })}
        </td>
        <td>
          {renderPositionComboBox({
            comboKey: "depart",
            placeholder: "Выберите подразделение",
            selectedValue: newEmployeePositionForm.departName,
            filterValue: newEmployeePositionForm.departNameFilter,
            options: departmentOptions,
            onFilterChange: (value) =>
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                departNameFilter: value,
                departName: "",
                departUnitId: ""
              })),
            onSelect: (item) =>
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                departName: item.name,
                departNameFilter: "",
                departUnitId: item.id,
                bossName: "",
                bossEmployeeId: "",
                bossNameFilter: ""
              })),
            onClear: () =>
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                departName: "",
                departNameFilter: "",
                departUnitId: "",
                bossName: "",
                bossEmployeeId: "",
                bossNameFilter: ""
              })),
            onBlur: () =>
              setTimeout(() => {
                setNewEmployeePositionForm((prev) => {
                  const departId = String(prev.departUnitId ?? "").trim();
                  if (departId) {
                    return prev;
                  }
                  return {
                    ...prev,
                    departName: "",
                    departNameFilter: "",
                    bossName: "",
                    bossEmployeeId: "",
                    bossNameFilter: ""
                  };
                });
                setPositionEmployeeOptions([]);
              }, 0)
          })}
        </td>
        <td>
          {renderPositionComboBox({
            comboKey: "position",
            placeholder: "Выберите должность",
            selectedValue: newEmployeePositionForm.positionName,
            filterValue: newEmployeePositionForm.positionNameFilter,
            options: positionTitleOptions,
            onFilterChange: (value) => {
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                positionNameFilter: value,
                positionName: "",
                employeePositionId: ""
              }));
              fetchPositionTitleOptions(value);
            },
            onSelect: (item) =>
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                positionName: item.name,
                positionNameFilter: "",
                employeePositionId: item.id
              })),
            onClear: () =>
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                positionName: "",
                positionNameFilter: "",
                employeePositionId: ""
              }))
          })}
        </td>
        <td>
          {renderPositionComboBox({
            comboKey: "boss",
            placeholder: "Выберите руководителя",
            selectedValue: newEmployeePositionForm.bossName,
            filterValue: newEmployeePositionForm.bossNameFilter,
            options: positionEmployeeOptions,
            disabled: !isBossFieldEnabled,
            onFilterChange: (value) => {
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                bossNameFilter: value,
                bossName: "",
                bossEmployeeId: ""
              }));
              fetchPositionEmployeeOptions(value, newEmployeePositionForm.departUnitId);
            },
            onSelect: (item) =>
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                bossName: item.name,
                bossNameFilter: "",
                bossEmployeeId: item.id
              })),
            onClear: () =>
              setNewEmployeePositionForm((prev) => ({
                ...prev,
                bossName: "",
                bossNameFilter: "",
                bossEmployeeId: ""
              })),
            onBlur: () =>
              setTimeout(() => {
                setNewEmployeePositionForm((prev) => {
                  const bossId = String(prev.bossEmployeeId ?? "").trim();
                  if (bossId) {
                    return prev;
                  }
                  return {
                    ...prev,
                    bossName: "",
                    bossNameFilter: ""
                  };
                });
              }, 0)
          })}
        </td>
        <td className="employee-card-positions-actions-cell">
          <button
            type="button"
            className="employee-card-position-action-button"
            aria-label="Сохранить подчинение"
            title="Сохранить"
            onClick={saveEmployeePosition}
          >
            ✔
          </button>
          <button
            type="button"
            className="employee-card-position-action-button"
            aria-label={cancelTitle}
            title="Отменить"
            onClick={cancelAddEmployeePositionRow}
          >
            ↩
          </button>
        </td>
      </tr>
    );
  };

  const renderEmployeeRelationFormRow = (cancelTitle, rowKey) => (
    <tr className="employee-card-relations-edit-row" key={rowKey}>
      {isEmployeeRelationsPage && (
        <td>
          {renderRelationComboBox({
            comboKey: "employee",
            placeholder: "Выберите сотрудника",
            selectedValue: newEmployeeRelationForm.employeeName,
            filterValue: newEmployeeRelationForm.employeeNameFilter,
            options: relationEmployeeOptions,
            onFilterChange: (value) => {
              setNewEmployeeRelationForm((prev) => ({
                ...prev,
                employeeNameFilter: value,
                employeeName: "",
                employeeId: ""
              }));
              fetchRelationEmployeeOptions(value);
            },
            onSelect: (item) => {
              setNewEmployeeRelationForm((prev) => ({
                ...prev,
                employeeNameFilter: "",
                employeeName: item.name,
                employeeId: item.id
              }));
              lastConfirmedRelationEmployeeRef.current = {
                id: item.id,
                name: item.name
              };
            },
            onClear: () => {
              setNewEmployeeRelationForm((prev) => ({
                ...prev,
                employeeNameFilter: "",
                employeeName: "",
                employeeId: ""
              }));
              setRelationEmployeeOptions([]);
            },
            onBlur: handleRelationEmployeeFieldBlur
          })}
        </td>
      )}
      <td>
        {renderRelationComboBox({
          comboKey: "organ",
          placeholder: "Выберите организацию",
          selectedValue: newEmployeeRelationForm.organName,
          filterValue: newEmployeeRelationForm.organNameFilter,
          options: organizationOptions,
          onFilterChange: (value) => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              organNameFilter: value,
              organName: "",
              organSapId: "",
              organInn: "",
              organKpp: "",
              organOgrn: "",
              organFullAddress: "",
              organUnitId: ""
            }));
            fetchOrganizationOptions(value, false);
          },
          onSelect: (item) => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              organNameFilter: item.fieldName || item.name,
              organName: item.fieldName || item.name,
              organSapId: item.sapId || "",
              organInn: item.inn || "",
              organKpp: item.kpp || "",
              organOgrn: item.ogrn || "",
              organFullAddress: item.fullAddress || "",
              organUnitId: item.id
            }));
            lastConfirmedOrganRef.current = {
              id: item.id,
              name: item.fieldName || item.name,
              sapId: item.sapId || "",
              inn: item.inn || "",
              kpp: item.kpp || "",
              ogrn: item.ogrn || "",
              fullAddress: item.fullAddress || ""
            };
          },
          onClear: () => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              organNameFilter: "",
              organName: "",
              organSapId: "",
              organInn: "",
              organKpp: "",
              organOgrn: "",
              organFullAddress: "",
              organUnitId: ""
            }));
            setOrganizationOptions([]);
          },
          onBlur: handleOrganFieldBlur
        })}
      </td>
      <td>
        {renderRelationComboBox({
          comboKey: "relation",
          placeholder: "Выберите тип связи",
          selectedValue: newEmployeeRelationForm.relationName,
          filterValue: newEmployeeRelationForm.relationNameFilter,
          options: relationTypeOptions,
          onFilterChange: (value) => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              relationNameFilter: value,
              relationName: "",
              relationTypeId: ""
            }));
            fetchRelationTypeOptions(value);
          },
          onSelect: (item) => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              relationNameFilter: "",
              relationName: item.name,
              relationTypeId: item.id
            }));
            lastConfirmedRelationRef.current = {
              id: item.id,
              name: item.name
            };
          },
          onClear: () => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              relationNameFilter: "",
              relationName: "",
              relationTypeId: ""
            }));
            setRelationTypeOptions([]);
          },
          onBlur: handleRelationTypeFieldBlur
        })}
      </td>
      <td className="employee-card-relations-default-flag-cell">
        <select
          className="employee-card-relations-filter-input"
          value={newEmployeeRelationForm.defaultFlag ? "ДА" : "НЕТ"}
          onChange={(event) =>
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              defaultFlag: event.target.value === "ДА"
            }))
          }
        >
          <option value="НЕТ">НЕТ</option>
          <option value="ДА">ДА</option>
        </select>
      </td>
      <td>
        {renderRelationComboBox({
          comboKey: "sales",
          placeholder: "Выберите сбытовую организацию",
          selectedValue: newEmployeeRelationForm.salesOrganName,
          filterValue: newEmployeeRelationForm.salesOrganNameFilter,
          options: salesOrganizationOptions,
          onFilterChange: (value) => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              salesOrganNameFilter: value,
              salesOrganName: "",
              salesOrganizationId: ""
            }));
            fetchOrganizationOptions(value, true);
          },
          onSelect: (item) => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              salesOrganNameFilter: "",
              salesOrganName: item.name,
              salesOrganizationId: item.id
            }));
            lastConfirmedSalesRef.current = {
              id: item.id,
              name: item.name
            };
          },
          onClear: () => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              salesOrganNameFilter: "",
              salesOrganName: "",
              salesOrganizationId: ""
            }));
            setSalesOrganizationOptions([]);
          },
          onBlur: handleSalesFieldBlur
        })}
      </td>
      <td>
        {renderRelationComboBox({
          comboKey: "product",
          placeholder: "Выберите группу продуктов",
          selectedValue: newEmployeeRelationForm.productGroupName,
          filterValue: newEmployeeRelationForm.productGroupNameFilter,
          options: productGroupOptions,
          onFilterChange: (value) => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              productGroupNameFilter: value,
              productGroupName: "",
              productGroupsId: ""
            }));
            fetchProductGroupOptions(value);
          },
          onSelect: (item) => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              productGroupNameFilter: "",
              productGroupName: item.name,
              productGroupsId: item.id
            }));
            lastConfirmedProductRef.current = {
              id: item.id,
              name: item.name
            };
          },
          onClear: () => {
            setNewEmployeeRelationForm((prev) => ({
              ...prev,
              productGroupNameFilter: "",
              productGroupName: "",
              productGroupsId: ""
            }));
            setProductGroupOptions([]);
          },
          onBlur: handleProductFieldBlur
        })}
      </td>
      <td
        className={`employee-card-relations-actions-cell${
          isEmployeeRelationsPage ? " relations-list-actions-cell" : ""
        }`}
      >
        <button
          type="button"
          className="employee-card-position-action-button"
          aria-label="Сохранить связь"
          title="Сохранить"
          onClick={saveNewEmployeeRelation}
        >
          ✔
        </button>
        <button
          type="button"
          className="employee-card-position-action-button"
          aria-label={cancelTitle}
          title="Отменить"
          onClick={cancelAddEmployeeRelationRow}
        >
          ↩
        </button>
      </td>
    </tr>
  );

  const openDeleteRelationModal = (relationRow) => {
    const relationId = getRelationId(relationRow);
    if (!relationId) {
      setEmployeeRelationsError("Не удалось определить relationId для удаления");
      return;
    }
    setPendingRelationDelete({
      relationId
    });
  };

  const closeDeleteRelationModal = () => {
    setPendingRelationDelete(null);
  };

  const openDeletePositionModal = (positionRow) => {
    const employeeOrganId = String(positionRow?.employeeOrganId ?? "").trim();
    if (!employeeOrganId) {
      setEmployeeRelationsError("Не удалось определить employeeOrganId для удаления");
      return;
    }
    setPendingPositionDelete({ employeeOrganId });
  };

  const closeDeletePositionModal = () => {
    setPendingPositionDelete(null);
  };

  const openDeleteEmployeeModal = () => {
    const employeeId = String(selectedEmployee?.id ?? selectedEmployee?.employeeId ?? "").trim();
    if (!employeeId) {
      const errorMessage = "Не удалось определить employeeId для удаления";
      showEmployeeRelationsError(errorMessage);
      showSystemErrorToast(errorMessage);
      return;
    }
    setPendingEmployeeDelete({
      employeeId,
      fullName: String(selectedEmployee?.fullName ?? "").trim()
    });
  };

  const closeDeleteEmployeeModal = () => {
    setPendingEmployeeDelete(null);
  };

  const confirmDeleteRelation = async () => {
    if (!pendingRelationDelete?.relationId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/relation/${pendingRelationDelete.relationId}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось удалить связь");
        return;
      }

      if (isEmployeeRelationsPage) {
        setEmployees((prev) =>
          prev.filter((row) => getRelationId(row) !== pendingRelationDelete.relationId)
        );
      } else {
        setEmployeeRelations((prev) =>
          prev.filter((row) => getRelationId(row) !== pendingRelationDelete.relationId)
        );
      }
      setPendingRelationDelete(null);
    } catch {
      setEmployeeRelationsError("Не удалось удалить связь");
    }
  };

  const confirmDeletePosition = async () => {
    if (!pendingPositionDelete?.employeeOrganId) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employee-position/${pendingPositionDelete.employeeOrganId}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) {
        setEmployeeRelationsError(data.error ?? "Не удалось удалить связь подчинения");
        return;
      }

      const removePositionByEmployeeOrganId = (employee) => {
        const positions = Array.isArray(employee?.positions) ? employee.positions : [];
        return {
          ...employee,
          positions: positions.filter(
            (position) =>
              String(position?.employeeOrganId ?? "").trim() !== pendingPositionDelete.employeeOrganId
          )
        };
      };

      setEmployees((prev) =>
        prev.map((row) => {
          const rowEmployeeId = String(row?.id ?? row?.employeeId ?? "").trim();
          return rowEmployeeId === selectedEmployeeId ? removePositionByEmployeeOrganId(row) : row;
        })
      );
      setSelectedEmployeeSnapshot((prev) =>
        prev ? removePositionByEmployeeOrganId(prev) : prev
      );
      refreshEmployeesList();
      setPendingPositionDelete(null);
    } catch {
      setEmployeeRelationsError("Не удалось удалить связь подчинения");
    }
  };

  const confirmDeleteEmployee = async () => {
    if (!pendingEmployeeDelete?.employeeId) {
      return;
    }
    const deleteRequest = pendingEmployeeDelete;
    setPendingEmployeeDelete(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/employee/${deleteRequest.employeeId}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMessage = data.error ?? "Не удалось удалить сотрудника";
        showEmployeeRelationsError(errorMessage);
        showSystemErrorToast(errorMessage);
        return;
      }

      const deletedEmployeeId = deleteRequest.employeeId;
      setEmployees((prev) =>
        prev.filter((row) => String(row?.id ?? row?.employeeId ?? "").trim() !== deletedEmployeeId)
      );
      setTotalCount((prev) => Math.max(0, Number(prev ?? 0) - 1));
      refreshEmployeesList();
      handleCloseEmployeeCardPanel();
    } catch {
      const errorMessage = "Не удалось удалить сотрудника";
      showEmployeeRelationsError(errorMessage);
      showSystemErrorToast(errorMessage);
    }
  };

  const getRelationColumnWidthPx = (columnKey) =>
    Number(employeeRelationsColumnWidths[columnKey] ?? DEFAULT_RELATION_COLUMN_WIDTHS[columnKey] ?? MIN_COLUMN_WIDTH);
  const relationTableWidthPx =
    RELATION_COLUMNS.reduce((sum, column) => sum + getRelationColumnWidthPx(column.key), 0) + 96;

  const handleRelationResizeStart = (field, event) => {
    event.preventDefault();
    event.stopPropagation();

    const startWidth = getRelationColumnWidthPx(field);
    relationResizeStateRef.current = {
      field,
      startX: event.clientX,
      startWidth
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent) => {
      if (!relationResizeStateRef.current) {
        return;
      }

      const delta = moveEvent.clientX - relationResizeStateRef.current.startX;
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, relationResizeStateRef.current.startWidth + delta);
      setEmployeeRelationsColumnWidths((prev) => ({
        ...prev,
        [field]: nextWidth
      }));
    };

    const handleMouseUp = () => {
      relationResizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleAlignRelationColumns = () => {
    const wrapper = relationTableWrapperRef.current;
    if (!wrapper) {
      return;
    }

    const targetTotalWidth = wrapper.clientWidth - 96;
    if (targetTotalWidth <= 0) {
      return;
    }

    const renderedColumns = RELATION_COLUMNS.map((column) => ({
      key: column.key,
      width: getRelationColumnWidthPx(column.key)
    }));
    const currentTotalWidth = renderedColumns.reduce((sum, column) => sum + column.width, 0);
    if (currentTotalWidth <= 0) {
      return;
    }

    const scale = targetTotalWidth / currentTotalWidth;
    const scaledWidths = renderedColumns.map((column) => ({
      key: column.key,
      width: Math.max(MIN_COLUMN_WIDTH, Math.round(column.width * scale))
    }));

    const scaledTotal = scaledWidths.reduce((sum, column) => sum + column.width, 0);
    const diff = targetTotalWidth - scaledTotal;
    if (diff !== 0 && scaledWidths.length > 0) {
      const last = scaledWidths.length - 1;
      scaledWidths[last].width = Math.max(MIN_COLUMN_WIDTH, scaledWidths[last].width + diff);
    }

    setEmployeeRelationsColumnWidths((prev) => {
      const next = { ...prev };
      for (const column of scaledWidths) {
        next[column.key] = column.width;
      }
      return next;
    });
  };

  return (
    <main className="app-layout">
      <aside className={`sidebar${isSidebarCollapsed ? " collapsed" : ""}`}>
        <div className="sidebar-top">
          <button
            type="button"
            className={`sidebar-button sidebar-action${isSidebarCollapsed ? " icon-only" : ""}`}
            onClick={handleAdministrationClick}
            ref={administrationButtonRef}
            aria-label="Администрирование"
            title="Администрирование"
          >
            <span className="sidebar-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
              </svg>
            </span>
            {!isSidebarCollapsed && <span>Администрирование</span>}
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            type="button"
            className={`sidebar-button sidebar-theme-button${isSidebarCollapsed ? " icon-only" : ""}${
              isDarkThemeEnabled ? " active" : ""
            }`}
            onClick={() => setIsDarkThemeEnabled((prev) => !prev)}
            aria-label={isDarkThemeEnabled ? "Выключить темную тему" : "Включить темную тему"}
            title={isDarkThemeEnabled ? "Выключить темную тему" : "Включить темную тему"}
          >
            <span className="sidebar-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8z" />
              </svg>
            </span>
            {!isSidebarCollapsed && <span>Темная тема</span>}
          </button>
          <button
            type="button"
            className={`sidebar-button sidebar-toggle${isSidebarCollapsed ? " icon-only" : ""}`}
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? "Развернуть панель" : "Свернуть панель"}
            title={isSidebarCollapsed ? "Развернуть" : "Свернуть"}
          >
            <span className="sidebar-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                {isSidebarCollapsed ? (
                  <path d="M8 5l8 7-8 7V5z" />
                ) : (
                  <path d="M16 5l-8 7 8 7V5z" />
                )}
              </svg>
            </span>
            {!isSidebarCollapsed && <span>Свернуть</span>}
          </button>
        </div>
      </aside>
      {isAdministrationOpen && (
        <div
          className="administration-modal-overlay"
          role="presentation"
          onClick={() => setIsAdministrationOpen(false)}
        >
          <aside
            className={`administration-panel${isDarkThemeEnabled ? " dark" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Администрирование"
            style={{
              top: `${administrationPanelPosition.top}px`,
              left: `${administrationPanelPosition.left}px`
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="administration-panel-title">Администрирование</header>
            <button
              type="button"
              className="administration-section-header"
              onClick={() => setIsParticipantsExpanded((prev) => !prev)}
              aria-expanded={isParticipantsExpanded}
            >
              <span>Участвующие стороны</span>
              <span className="administration-section-chevron" aria-hidden="true">
                {isParticipantsExpanded ? "▾" : "▸"}
              </span>
            </button>
            {isParticipantsExpanded && (
              <div className="administration-section-items">
                <button
                  type="button"
                  className={`administration-section-item${isEmployeesPage ? " active" : ""}`}
                  onClick={() => handlePageSelect(PAGE_IDS.EMPLOYEES)}
                >
                  Список сотрудников
                </button>
                <button
                  type="button"
                  className={`administration-section-item${
                    activePage === PAGE_IDS.ORGANIZATIONS ? " active" : ""
                  }`}
                  onClick={() => handlePageSelect(PAGE_IDS.ORGANIZATIONS)}
                >
                  Список организаций
                </button>
                <button
                  type="button"
                  className={`administration-section-item${
                    activePage === PAGE_IDS.EMPLOYEE_RELATIONS ? " active" : ""
                  }`}
                  onClick={() => handlePageSelect(PAGE_IDS.EMPLOYEE_RELATIONS)}
                >
                  Список связей сотрудников
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
      <section className={`content-area${isDarkThemeEnabled ? " dark" : ""}`}>
        <header className="page-header">
          <h1>{currentPageTitle}</h1>
          <div className="header-time-block" aria-label="Текущие дата и время">
            <div className="header-time-value">{nowDisplay.time}</div>
            <div className="header-date-value">{nowDisplay.date}</div>
          </div>
        </header>
        <section className="main-panel" ref={mainPanelRef}>
          {isListPage ? (
            <>
              <div className={`list-content-layout${isEmployeeCardVisible ? " split-view" : ""}`}>
                <div className="list-content-main">
                  <div className="main-panel-toolbar">
                    <div className="main-panel-actions">
                      {isEmployeesPage && !isEmployeeCardVisible && (
                        <button type="button" className="panel-action-button" onClick={openCreateEmployeeCard}>
                          <span aria-hidden="true">+</span>
                          <span>Добавить</span>
                        </button>
                      )}
                      {isEmployeeRelationsPage && (
                        <button
                          type="button"
                          className="panel-action-button"
                          onClick={handleOpenRelationCreateFromList}
                        >
                          <span aria-hidden="true">+</span>
                          <span>Добавить</span>
                        </button>
                      )}
                      {isEmployeesPage && !isEmployeeCardVisible && (
                        <label className="panel-action-button upload-action-button">
                          <span aria-hidden="true">↑</span>
                          <span>{loading ? "Загрузка..." : "Загрузить"}</span>
                          <input
                            type="file"
                            accept=".xlsx"
                            onChange={handleFileSelect}
                            disabled={loading}
                            hidden
                          />
                        </label>
                      )}
                      {!isEmployeeCardVisible && (
                        <ExportToExcelButton
                          exportFile={requestExportFile}
                          disabled={employeesLoading}
                          className="panel-action-button"
                          onError={(error) =>
                            setEmployeesError(
                              error instanceof Error
                                ? error.message
                                : isEmployeeRelationsPage
                                  ? "Ошибка выгрузки связей сотрудников"
                                  : "Ошибка выгрузки"
                            )
                          }
                        />
                      )}
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={() => {
                          setFilters(initialFiltersForPage);
                          setCurrentPage(1);
                        }}
                      >
                        <span aria-hidden="true">✕</span>
                        <span>Удалить фильтр</span>
                      </button>
                      {!isEmployeeCardVisible && (
                        <button type="button" className="panel-action-button" onClick={handleAlignVisibleColumns}>
                          <span aria-hidden="true">↔</span>
                          <span>Выровнять</span>
                        </button>
                      )}
                      {!isEmployeeCardVisible && (
                        <button type="button" className="panel-action-button" onClick={openColumnSettings}>
                          <span aria-hidden="true">⚙</span>
                          <span>Настройка</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="table-wrapper" ref={tableWrapperRef} tabIndex={0}>
                    <table
                      className="employee-grid"
                      style={{
                        width: `${tableWidthWithActionsPx}px`,
                        minWidth: `${tableWidthWithActionsPx}px`,
                        maxWidth: `${tableWidthWithActionsPx}px`
                      }}
                    >
              <colgroup>
                {visibleColumns.map((column) => (
                  <col
                    key={`col-${column.key}`}
                    style={{
                      width: `${getColumnWidthPx(column.key)}px`,
                      minWidth: `${getColumnWidthPx(column.key)}px`,
                      maxWidth: `${getColumnWidthPx(column.key)}px`
                    }}
                  />
                ))}
                {isEmployeeRelationsPage && (
                  <col
                    style={{
                      width: `${listActionsColumnWidth}px`,
                      minWidth: `${listActionsColumnWidth}px`,
                      maxWidth: `${listActionsColumnWidth}px`
                    }}
                  />
                )}
              </colgroup>
              <thead>
                <tr>
                  {visibleColumns.map((column) => {
                    const columnSortDirection = getSortDirectionForField(column.sortField);
                    const columnSortOrder = getSortOrderForField(column.sortField);
                    const sortIcon =
                      columnSortDirection === "ASC"
                        ? "▲"
                        : columnSortDirection === "DESC"
                          ? "▼"
                          : null;

                    return (
                      <th
                        key={column.key}
                        className={`${getStickyProps(column.key, true).className}${
                          isEmployeeRelationsPage && column.key === "defaultFlag"
                            ? " relations-default-flag-column"
                            : ""
                        }`.trim()}
                        style={getStickyProps(column.key, true).style}
                      >
                        <button
                          type="button"
                          className={`column-sort-button${columnSortDirection ? " active" : ""}`}
                          onClick={() => handleSortClick(column.sortField)}
                        >
                          <span>{column.title}</span>
                          {sortIcon && (
                            <span className="sort-icon-group">
                              <span className="sort-icon">{sortIcon}</span>
                              {columnSortOrder && (
                                <span className="sort-order-index">{columnSortOrder}</span>
                              )}
                            </span>
                          )}
                        </button>
                        <span
                          className="column-resize-handle"
                          onMouseDown={(event) => handleResizeStart(column.key, event)}
                          role="presentation"
                        />
                      </th>
                    );
                  })}
                  {isEmployeeRelationsPage && <th className="relations-list-actions-header" />}
                </tr>
                <tr className="filter-row">
                  {visibleColumns.map((column) => (
                    <th
                      key={`filter-${column.key}`}
                      className={`${getStickyProps(column.key, true).className}${
                        isEmployeeRelationsPage && column.key === "defaultFlag"
                          ? " relations-default-flag-column"
                          : ""
                      }`.trim()}
                      style={getStickyProps(column.key, true).style}
                    >
                      {isEmployeesPage && column.key === "status" ? (
                        <select
                          value={filters.status}
                          onChange={(event) => handleFilterChange("status", event.target.value)}
                          className="column-filter-input"
                        >
                          <option value="">Все</option>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                      ) : isOrganizationsPage && column.key === "signResident" ? (
                        <select
                          value={filters.signResident}
                          onChange={(event) => handleFilterChange("signResident", event.target.value)}
                          className="column-filter-input"
                        >
                          <option value="">Все</option>
                          <option value="ДА">ДА</option>
                          <option value="НЕТ">НЕТ</option>
                        </select>
                      ) : isEmployeeRelationsPage && column.key === "defaultFlag" ? (
                        <select
                          value={filters.defaultFlag}
                          onChange={(event) => handleFilterChange("defaultFlag", event.target.value)}
                          className="column-filter-input"
                        >
                          <option value="">Все</option>
                          <option value="true">Да</option>
                          <option value="false">Нет</option>
                        </select>
                      ) : (
                        <div className="column-filter-input-wrapper">
                          <input
                            type="text"
                            value={filters[column.key] ?? ""}
                            onChange={(event) => handleFilterChange(column.key, event.target.value)}
                            className="column-filter-input"
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
                      )}
                    </th>
                  ))}
                  {isEmployeeRelationsPage && <th className="relations-list-actions-filter" />}
                </tr>
              </thead>
              <tbody>
                {employeesLoading && employees.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + (isEmployeeRelationsPage ? 1 : 0)}>
                      Загрузка данных...
                    </td>
                  </tr>
                )}
                {!employeesLoading && !employeesError && employees.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + (isEmployeeRelationsPage ? 1 : 0)}>
                      Записи не найдены
                    </td>
                  </tr>
                )}
                {!employeesError &&
                  isEmployeeRelationsPage &&
                  isAddingEmployeeRelation &&
                  renderEmployeeRelationFormRow("Отменить добавление связи", "relations-list-add-row")}
                {!employeesError &&
                  employees.map((row, rowIndex) => {
                    const rowEmployeeId = String(row?.id ?? row?.employeeId ?? "").trim();
                    const isRowSelected = rowEmployeeId !== "" && rowEmployeeId === selectedEmployeeId;
                    if (isEmployeeRelationsPage && getRelationId(row) === editingEmployeeRelationId) {
                      return renderEmployeeRelationFormRow(
                        "Отменить редактирование связи",
                        `relations-list-edit-${editingEmployeeRelationId || rowIndex}`
                      );
                    }
                    return (
                    <tr
                      key={`${row.id ?? row.email ?? row.sapId ?? "row"}-${rowIndex}`}
                      data-row-index={rowIndex}
                      tabIndex={-1}
                      aria-selected={isRowSelected}
                      className={isRowSelected ? "selected-row" : ""}
                      onClick={() => {
                        if (isEmployeesPage) {
                          handleEmployeeRowClick(rowIndex);
                        }
                      }}
                    >
                      {visibleColumns.map((column) => (
                        (() => {
                          const derivedPositionData = isEmployeesPage
                            ? getEmployeeDerivedPositionData(row)
                            : null;
                          const rawValue =
                            isEmployeesPage &&
                            (column.key === "organName" ||
                              column.key === "departName" ||
                              column.key === "positionName" ||
                              column.key === "bossName")
                              ? derivedPositionData[column.key]
                              : isEmployeeRelationsPage && column.key === "defaultFlag"
                                ? row?.defaultFlag === true
                                  ? "Да"
                                  : row?.defaultFlag === false
                                    ? "Нет"
                                    : ""
                                : row[column.key];
                          const displayValue = rawValue ?? "-";
                          const organTooltip =
                            isEmployeesPage &&
                            column.key === "organName" &&
                            derivedPositionData &&
                            (derivedPositionData.organNamesForTooltip.length > 0 ||
                              derivedPositionData.organTooltipText)
                              ? (
                                  derivedPositionData.organNamesForTooltip.length > 0
                                    ? derivedPositionData.organNamesForTooltip.join("\n")
                                    : derivedPositionData.organTooltipText
                                )
                              : null;
                          const departTooltip =
                            isEmployeesPage &&
                            column.key === "departName" &&
                            derivedPositionData &&
                            derivedPositionData.departNamesForTooltip.length > 0
                              ? derivedPositionData.departNamesForTooltip.join("\n")
                              : null;
                          const fixedTooltipText = organTooltip ?? departTooltip;
                          return (
                        <td
                          key={`${row.id ?? row.email ?? row.sapId ?? rowIndex}-${column.key}`}
                          className={`${getStickyProps(column.key).className}${
                            column.key === "signResident" ||
                            (isEmployeeRelationsPage && column.key === "defaultFlag")
                              ? " cell-center"
                              : ""
                          }`.trim()}
                          style={getStickyProps(column.key).style}
                          onMouseEnter={(event) =>
                            handleCellMouseEnter(event, displayValue, fixedTooltipText)
                          }
                          onMouseMove={updateCellTooltipPosition}
                          onMouseLeave={handleCellMouseLeave}
                        >
                          {isEmployeeRelationsPage &&
                          column.key === "employeeName" &&
                          normalizeEmployeeId(row?.employeeId) ? (
                            <a
                              className="log-link employee-name-link"
                              href={buildEmployeeCardUrl(row?.employeeId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              title="Открыть карточку сотрудника в новой вкладке"
                            >
                              {displayValue}
                            </a>
                          ) : (
                            displayValue
                          )}
                        </td>
                          );
                        })()
                      ))}
                      {isEmployeeRelationsPage && (
                        <td className="employee-card-relations-actions-cell relations-list-actions-cell">
                          <button
                            type="button"
                            className="employee-card-position-action-button"
                            aria-label="Редактировать связь"
                            title="Редактировать"
                            onClick={() => openEditEmployeeRelationRow(row)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="employee-card-position-action-button"
                            aria-label="Удалить связь"
                            title="Удалить"
                            onClick={() => openDeleteRelationModal(row)}
                          >
                            🗑
                          </button>
                        </td>
                      )}
                    </tr>
                    );
                  })}
              </tbody>
                    </table>
                  </div>
                </div>
                {isEmployeesPage && (
                  <aside className={`employee-card-panel${isEmployeeCardVisible ? " open" : ""}`}>
                    <div className="employee-card-panel-header">
                      <h2>Карточка сотрудника</h2>
                      <div className="employee-card-full-name employee-card-full-name-header">
                        {employeeCardHeaderFullName || "-"}
                      </div>
                      <button
                        type="button"
                        className="employee-card-close-button"
                        onClick={handleCloseEmployeeCardPanel}
                        aria-label="Закрыть карточку сотрудника"
                        title="Закрыть"
                      >
                        ×
                      </button>
                    </div>
                    <div className="employee-card-panel-body">
                      <div className="employee-card-tabs" role="tablist" aria-label="Вкладки карточки сотрудника">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeEmployeeCardTab === EMPLOYEE_CARD_TABS.MAIN}
                          className={`employee-card-tab${
                            activeEmployeeCardTab === EMPLOYEE_CARD_TABS.MAIN ? " active" : ""
                          }`}
                          onClick={() => setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.MAIN)}
                        >
                          Основные сведения
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeEmployeeCardTab === EMPLOYEE_CARD_TABS.RELATIONS}
                          className={`employee-card-tab${
                            activeEmployeeCardTab === EMPLOYEE_CARD_TABS.RELATIONS ? " active" : ""
                          }`}
                          onClick={() => {
                            if (isEmployeeCardEditMode) {
                              return;
                            }
                            setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.RELATIONS);
                          }}
                          disabled={isEmployeeCardEditMode}
                        >
                          Связи сотрудника
                        </button>
                      </div>
                      {activeEmployeeCardTab === EMPLOYEE_CARD_TABS.MAIN ? (
                        <div
                          className={`employee-card-main-tab-content${
                            isEmployeeCardEditMode ? " employee-card-main-tab-content-edit-mode" : ""
                          }`}
                        >
                          <section className="employee-card-section">
                            <div className="employee-card-section-header">
                              <h3>Персональная информация</h3>
                              <div className="employee-card-section-actions">
                                {isEmployeeCardEditMode ? (
                                  <>
                                    <button
                                      type="button"
                                      className="panel-action-button"
                                      onClick={saveEmployeeCardMainInfo}
                                    >
                                      Сохранить
                                    </button>
                                    <button
                                      type="button"
                                      className="panel-action-button"
                                      onClick={cancelEmployeeCardEditMode}
                                    >
                                      Отменить
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="panel-action-button"
                                      onClick={startEmployeeCardEditMode}
                                    >
                                      Изменить
                                    </button>
                                    {!isCreatingEmployeeCard && (
                                      <button
                                        type="button"
                                        className="panel-action-button"
                                        onClick={openDeleteEmployeeModal}
                                      >
                                        Удалить
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="employee-card-params">
                              <div className="employee-card-params-row">
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Фамилия</span>
                                  {isEmployeeCardEditMode ? (
                                    renderEmployeeCardTextInput({
                                      value: employeeCardEditForm.surname,
                                      onChange: (value) =>
                                        setEmployeeCardEditForm((prev) => ({
                                          ...prev,
                                          surname: value
                                        }))
                                    })
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {selectedEmployee?.surname ?? "-"}
                                    </span>
                                  )}
                                </div>
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Имя</span>
                                  {isEmployeeCardEditMode ? (
                                    renderEmployeeCardTextInput({
                                      value: employeeCardEditForm.firstName,
                                      onChange: (value) =>
                                        setEmployeeCardEditForm((prev) => ({
                                          ...prev,
                                          firstName: value
                                        }))
                                    })
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {selectedEmployee?.firstName ?? "-"}
                                    </span>
                                  )}
                                </div>
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Отчество</span>
                                  {isEmployeeCardEditMode ? (
                                    renderEmployeeCardTextInput({
                                      value: employeeCardEditForm.middleName,
                                      onChange: (value) =>
                                        setEmployeeCardEditForm((prev) => ({
                                          ...prev,
                                          middleName: value
                                        }))
                                    })
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {selectedEmployee?.middleName ?? "-"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="employee-card-params-row employee-card-params-row-email-phone">
                                <div className="employee-card-param employee-card-param-span-two">
                                  <span className="employee-card-field-label">Адрес email</span>
                                  {isEmployeeCardEditMode ? (
                                    renderEmployeeCardTextInput({
                                      value: employeeCardEditForm.email,
                                      type: "email",
                                      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
                                      title: "Введите корректный email, например name@example.com",
                                      onChange: (value) =>
                                        setEmployeeCardEditForm((prev) => ({
                                          ...prev,
                                          email: value
                                        }))
                                    })
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {selectedEmployee?.email ?? "-"}
                                    </span>
                                  )}
                                </div>
                                <div className="employee-card-param employee-card-param-col-three">
                                  <span className="employee-card-field-label">Телефон</span>
                                  {isEmployeeCardEditMode ? (
                                    renderEmployeeCardTextInput({
                                      value: employeeCardEditForm.phoneNumber,
                                      onChange: (value) =>
                                        setEmployeeCardEditForm((prev) => ({
                                          ...prev,
                                          phoneNumber: value.replace(/[^0-9()+-]+/g, "")
                                        }))
                                    })
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {selectedEmployee?.phoneNumber ?? "-"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="employee-card-params-row employee-card-params-row-personal-sap">
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Табельный номер</span>
                                  {isEmployeeCardEditMode ? (
                                    renderEmployeeCardTextInput({
                                      value: employeeCardEditForm.personalNumber,
                                      inputMode: "numeric",
                                      onChange: (value) =>
                                        setEmployeeCardEditForm((prev) => ({
                                          ...prev,
                                          personalNumber: value.replace(/\D+/g, "").slice(0, 10)
                                        }))
                                    })
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {selectedEmployee?.personalNumber ?? "-"}
                                    </span>
                                  )}
                                </div>
                                <div className="employee-card-param employee-card-param-col-three">
                                  <span className="employee-card-field-label">sap id</span>
                                  {isEmployeeCardEditMode ? (
                                    renderEmployeeCardTextInput({
                                      value: employeeCardEditForm.sapId,
                                      inputMode: "numeric",
                                      onChange: (value) =>
                                        setEmployeeCardEditForm((prev) => ({
                                          ...prev,
                                          sapId: value.replace(/\D+/g, "").slice(0, 10)
                                        }))
                                    })
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {selectedEmployee?.sapId ?? "-"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="employee-card-params-row employee-card-params-row-status">
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Статус</span>
                                  {isEmployeeCardEditMode ? (
                                    <select
                                      className="employee-card-field-input"
                                      value={employeeCardEditForm.status}
                                      onChange={(event) =>
                                        setEmployeeCardEditForm((prev) => ({
                                          ...prev,
                                          status: String(event.target.value ?? "").toUpperCase() === "INACTIVE"
                                            ? "INACTIVE"
                                            : "ACTIVE"
                                        }))
                                      }
                                    >
                                      <option value="ACTIVE">ACTIVE</option>
                                      <option value="INACTIVE">INACTIVE</option>
                                    </select>
                                  ) : (
                                    <span className="employee-card-field-value">{selectedEmployee?.status ?? "-"}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </section>
                          <section
                            className={`employee-card-section${isEmployeeCardEditMode ? " employee-card-section-disabled" : ""}`}
                          >
                            <div className="employee-card-subordination-header">
                              <h3>Подчинение сотрудника</h3>
                              <button
                                type="button"
                                className="panel-action-button employee-card-add-position-button"
                                aria-label="Добавить подчинение"
                                title="Добавить"
                                onClick={openAddEmployeePositionRow}
                                disabled={isEmployeeCardEditMode}
                              >
                                <span aria-hidden="true">+</span>
                                <span>Добавить</span>
                              </button>
                            </div>
                            <div className="employee-card-positions-table-wrapper" ref={positionsTableWrapperRef}>
                              <table className="employee-card-positions-table">
                                <thead>
                                  <tr>
                                    <th>Организация</th>
                                    <th>Подразделение</th>
                                    <th>Должность</th>
                                    <th>Руководитель</th>
                                    <th className="employee-card-positions-actions-header" aria-label="Действия" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {isAddingEmployeePosition &&
                                    renderEmployeePositionFormRow(
                                      "Отменить добавление подчинения",
                                      "position-add-row"
                                    )}
                                  {selectedEmployeePositions.length === 0 && !isAddingEmployeePosition ? (
                                    <tr>
                                      <td colSpan={5}>Нет записей</td>
                                    </tr>
                                  ) : (
                                    selectedEmployeePositions.map((positionRow, index) => (
                                      String(positionRow?.employeeOrganId ?? "").trim() ===
                                      editingEmployeePositionId ? (
                                        renderEmployeePositionFormRow(
                                          "Отменить редактирование подчинения",
                                          `position-edit-${
                                            String(positionRow?.employeeOrganId ?? "").trim() || index
                                          }`
                                        )
                                      ) : (
                                      <tr
                                        key={`position-${
                                          positionRow?.positionId ??
                                          `${positionRow?.organName ?? ""}-${positionRow?.departName ?? ""}`
                                        }-${index}`}
                                        onMouseDown={() => {
                                          if (isPositionFormActive) {
                                            cancelAddEmployeePositionRow();
                                          }
                                        }}
                                      >
                                        <td
                                          onMouseEnter={(event) => {
                                            const tooltipText = formatOrganizationTooltip({
                                              organName: positionRow?.organName,
                                              sapId: positionRow?.organSapId,
                                              inn: positionRow?.organInn,
                                              kpp: positionRow?.organKpp,
                                              ogrn: positionRow?.organOgrn,
                                              fullAddress: positionRow?.organFullAddress
                                            });
                                            handleCellMouseEnter(event, positionRow?.organName ?? "-", tooltipText);
                                          }}
                                          onMouseMove={updateCellTooltipPosition}
                                          onMouseLeave={handleCellMouseLeave}
                                        >
                                          {positionRow?.organName ?? "-"}
                                        </td>
                                        <td
                                          onMouseEnter={(event) =>
                                            handleCellMouseEnter(event, positionRow?.departName ?? "-")
                                          }
                                          onMouseMove={updateCellTooltipPosition}
                                          onMouseLeave={handleCellMouseLeave}
                                        >
                                          {positionRow?.departName ?? "-"}
                                        </td>
                                        <td
                                          onMouseEnter={(event) =>
                                            handleCellMouseEnter(event, positionRow?.positionName ?? "-")
                                          }
                                          onMouseMove={updateCellTooltipPosition}
                                          onMouseLeave={handleCellMouseLeave}
                                        >
                                          {positionRow?.positionName ?? "-"}
                                        </td>
                                        <td
                                          onMouseEnter={(event) =>
                                            handleCellMouseEnter(event, positionRow?.bossName ?? "-")
                                          }
                                          onMouseMove={updateCellTooltipPosition}
                                          onMouseLeave={handleCellMouseLeave}
                                        >
                                          {positionRow?.bossName ?? "-"}
                                        </td>
                                        <td className="employee-card-positions-actions-cell">
                                          <button
                                            type="button"
                                            className="employee-card-position-action-button"
                                            aria-label="Изменить подчинение"
                                            title="Изменить"
                                            onClick={() => openEditEmployeePositionRow(positionRow)}
                                            disabled={isEmployeeCardEditMode}
                                          >
                                            ✎
                                          </button>
                                          <button
                                            type="button"
                                            className="employee-card-position-action-button"
                                            aria-label="Удалить подчинение"
                                            title="Удалить"
                                            onClick={() => openDeletePositionModal(positionRow)}
                                            disabled={isEmployeeCardEditMode}
                                          >
                                            🗑
                                          </button>
                                        </td>
                                      </tr>
                                    )))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        </div>
                      ) : (
                        <div className="employee-card-relations-tab-content" ref={employeeRelationsTabContentRef}>
                          <section className="employee-card-section">
                            <div className="employee-card-subordination-header">
                              <h3>Связи сотрудника</h3>
                              <div className="employee-card-relations-header-actions">
                                <button
                                  type="button"
                                  className="panel-action-button"
                                  aria-label="Добавить связь сотрудника"
                                  title="Добавить"
                                  onClick={openAddEmployeeRelationRow}
                                >
                                  <span aria-hidden="true">+</span>
                                  <span>Добавить</span>
                                </button>
                                <button
                                  type="button"
                                  className="panel-action-button"
                                  onClick={clearRelationFilters}
                                >
                                  <span aria-hidden="true">✕</span>
                                  <span>Удалить фильтр</span>
                                </button>
                                <button
                                  type="button"
                                  className="panel-action-button"
                                  onClick={handleAlignRelationColumns}
                                >
                                  <span aria-hidden="true">↔</span>
                                  <span>Выровнять</span>
                                </button>
                              </div>
                            </div>
                            <div className="employee-card-relations-table-wrapper" ref={relationTableWrapperRef}>
                              <table
                                className="employee-card-relations-table"
                                style={{
                                  width: `${relationTableWidthPx}px`,
                                  minWidth: `${relationTableWidthPx}px`,
                                  maxWidth: `${relationTableWidthPx}px`
                                }}
                              >
                                <colgroup>
                                  {RELATION_COLUMNS.map((column) => (
                                    <col
                                      key={`relation-col-${column.key}`}
                                      style={{
                                        width: `${getRelationColumnWidthPx(column.key)}px`,
                                        minWidth: `${getRelationColumnWidthPx(column.key)}px`,
                                        maxWidth: `${getRelationColumnWidthPx(column.key)}px`
                                      }}
                                    />
                                  ))}
                                  <col style={{ width: "96px", minWidth: "96px", maxWidth: "96px" }} />
                                </colgroup>
                                <thead>
                                  <tr>
                                    {RELATION_COLUMNS.map((column) => {
                                      const direction = getRelationSortDirectionForField(column.key);
                                      const sortOrder = getRelationSortOrderForField(column.key);
                                      const sortIcon =
                                        direction === "ASC" ? "▲" : direction === "DESC" ? "▼" : null;
                                      return (
                                        <th
                                          key={column.key}
                                          className={
                                            column.key === "defaultFlag"
                                              ? "employee-card-relations-default-flag-column"
                                              : ""
                                          }
                                        >
                                          <button
                                            type="button"
                                            className={`employee-card-relations-sort-button${
                                              direction ? " active" : ""
                                            }`}
                                            onClick={() => handleRelationSortClick(column.key)}
                                          >
                                            <span>{column.title}</span>
                                            {sortIcon && (
                                              <span className="sort-icon-group">
                                                <span className="employee-card-relations-sort-icon">
                                                  {sortIcon}
                                                </span>
                                                {sortOrder && (
                                                  <span className="sort-order-index">{sortOrder}</span>
                                                )}
                                              </span>
                                            )}
                                          </button>
                                          <span
                                            className="employee-card-relations-resize-handle"
                                            onMouseDown={(event) => handleRelationResizeStart(column.key, event)}
                                            role="presentation"
                                          />
                                        </th>
                                      );
                                    })}
                                    <th
                                      className="employee-card-relations-actions-header"
                                      aria-label="Действия"
                                    />
                                  </tr>
                                  <tr className="employee-card-relations-filter-row">
                                    {RELATION_COLUMNS.map((column) => (
                                      <th
                                        key={`relation-filter-${column.key}`}
                                        className={
                                          column.key === "defaultFlag"
                                            ? "employee-card-relations-default-flag-column"
                                            : ""
                                        }
                                      >
                                        {column.key === "defaultFlag" ? (
                                          <select
                                            className="employee-card-relations-filter-input"
                                            value={employeeRelationsFilters.defaultFlag}
                                            onChange={(event) =>
                                              handleRelationFilterChange("defaultFlag", event.target.value)
                                            }
                                          >
                                            <option value="">Все</option>
                                            <option value="ДА">ДА</option>
                                            <option value="НЕТ">НЕТ</option>
                                          </select>
                                        ) : (
                                          <div className="column-filter-input-wrapper">
                                            <input
                                              type="text"
                                              className="employee-card-relations-filter-input"
                                              value={employeeRelationsFilters[column.key] ?? ""}
                                              onChange={(event) =>
                                                handleRelationFilterChange(column.key, event.target.value)
                                              }
                                            />
                                            {String(employeeRelationsFilters[column.key] ?? "").trim() !== "" && (
                                              <button
                                                type="button"
                                                className="column-filter-clear-button"
                                                aria-label="Очистить фильтр"
                                                onClick={() => handleRelationFilterChange(column.key, "")}
                                              >
                                                ×
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </th>
                                    ))}
                                    <th />
                                  </tr>
                                </thead>
                                <tbody>
                                  {isAddingEmployeeRelation &&
                                    renderEmployeeRelationFormRow("Отменить добавление связи", "relation-add-row")}
                                  {employeeRelationsLoading && (
                                    <tr>
                                      <td colSpan={6}>Загрузка данных...</td>
                                    </tr>
                                  )}
                                  {!employeeRelationsLoading &&
                                    employeeRelations.length === 0 &&
                                    !isRelationFormActive && (
                                      <tr>
                                        <td colSpan={6}>Нет записей</td>
                                      </tr>
                                    )}
                                  {!employeeRelationsLoading &&
                                    employeeRelations.map((relationRow, index) => (
                                      getRelationId(relationRow) === editingEmployeeRelationId ? (
                                        renderEmployeeRelationFormRow(
                                          "Отменить редактирование связи",
                                          `relation-edit-${editingEmployeeRelationId || index}`
                                        )
                                      ) : (
                                      <tr
                                        key={`${getRelationId(relationRow) || relationRow?.organUnitId || "relation"}-${
                                          relationRow?.relationTypeId ?? "type"
                                        }-${index}`}
                                        onMouseDown={() => {
                                          if (isRelationFormActive) {
                                            cancelAddEmployeeRelationRow();
                                          }
                                        }}
                                      >
                                        <td
                                          onMouseEnter={(event) => {
                                            const tooltipText = formatOrganizationTooltip({
                                              organName: relationRow?.organName,
                                              sapId: relationRow?.organSapId,
                                              inn: relationRow?.organInn,
                                              kpp: relationRow?.organKpp,
                                              ogrn: relationRow?.organOgrn,
                                              fullAddress: relationRow?.organFullAddress
                                            });
                                            handleCellMouseEnter(event, relationRow?.organName ?? "-", tooltipText);
                                          }}
                                          onMouseMove={updateCellTooltipPosition}
                                          onMouseLeave={handleCellMouseLeave}
                                        >
                                          {relationRow?.organName ?? "-"}
                                        </td>
                                        <td
                                          onMouseEnter={(event) =>
                                            handleCellMouseEnter(event, relationRow?.relationName ?? "-")
                                          }
                                          onMouseMove={updateCellTooltipPosition}
                                          onMouseLeave={handleCellMouseLeave}
                                        >
                                          {relationRow?.relationName ?? "-"}
                                        </td>
                                        <td className="employee-card-relations-default-flag-cell">
                                          {relationRow?.defaultFlag === true
                                            ? "ДА"
                                            : relationRow?.defaultFlag === false
                                              ? "НЕТ"
                                              : "-"}
                                        </td>
                                        <td
                                          onMouseEnter={(event) =>
                                            handleCellMouseEnter(event, relationRow?.salesOrganName ?? "-")
                                          }
                                          onMouseMove={updateCellTooltipPosition}
                                          onMouseLeave={handleCellMouseLeave}
                                        >
                                          {relationRow?.salesOrganName ?? "-"}
                                        </td>
                                        <td
                                          onMouseEnter={(event) =>
                                            handleCellMouseEnter(event, relationRow?.productGroupName ?? "-")
                                          }
                                          onMouseMove={updateCellTooltipPosition}
                                          onMouseLeave={handleCellMouseLeave}
                                        >
                                          {relationRow?.productGroupName ?? "-"}
                                        </td>
                                        <td className="employee-card-relations-actions-cell">
                                          <button
                                            type="button"
                                            className="employee-card-position-action-button"
                                            aria-label="Изменить связь"
                                            title="Изменить"
                                            onClick={() => openEditEmployeeRelationRow(relationRow)}
                                          >
                                            ✎
                                          </button>
                                          <button
                                            type="button"
                                            className="employee-card-position-action-button"
                                            aria-label="Удалить связь"
                                            title="Удалить"
                                            onClick={() => openDeleteRelationModal(relationRow)}
                                          >
                                            🗑
                                          </button>
                                        </td>
                                      </tr>
                                    )))}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        </div>
                      )}
                    </div>
                  </aside>
                )}
              </div>
            </>
          ) : (
            <div className="main-panel-placeholder" />
          )}
        </section>
        {isListPage && (
          <section className="bottom-controls-panel" ref={bottomPanelRef}>
            <div className="grid-controls">
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pager-button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={employeesLoading || currentPage <= 1}
                  aria-label="Предыдущая страница"
                  title="Предыдущая страница"
                >
                  ←
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
                      disabled={employeesLoading}
                    >
                      {item}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="pager-button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={employeesLoading || currentPage >= totalPages}
                  aria-label="Следующая страница"
                  title="Следующая страница"
                >
                  →
                </button>
              </div>
              <label className="page-jump-control">
                <span>Перейти на страницу:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageJumpInput}
                  onChange={(event) => setPageJumpInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      goToPage();
                    }
                  }}
                  disabled={employeesLoading}
                />
                <button type="button" className="page-jump-button" onClick={goToPage} disabled={employeesLoading}>
                  Перейти
                </button>
              </label>
              <span className="selected-count-label">Отобрано - {totalCount} записей</span>
              <div className="grid-controls-right">
                <label className="page-size-control">
                  <span>Записей на странице:</span>
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setCurrentPage(1);
                    }}
                    disabled={employeesLoading}
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>
            </div>
          </section>
        )}
        <TableColumnSettingsPanel
          isOpen={isColumnSettingsOpen}
          title="Настройка столбцов"
          bounds={settingsPanelBounds}
          columns={tableColumns}
          settings={columnSettings}
          onApply={applyColumnSettingsDraft}
          onClose={cancelColumnSettings}
          onReset={resetColumnSettings}
        />
        {isConfirmModalOpen && (
          <div className="modal-overlay" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-label="Подтверждение загрузки">
              <label className="confirm-checkbox">
                <input
                  type="checkbox"
                  checked={deleteMissing}
                  onChange={(event) => setDeleteMissing(event.target.checked)}
                  disabled={loading}
                />
                <span>Удалить записи, отсутствующие в файле</span>
              </label>
              <p className="result-message">Вы хотите загрузить выбранный файл?</p>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="modal-close-button"
                  onClick={startUpload}
                  disabled={loading}
                >
                  Да
                </button>
                <button
                  type="button"
                  className="modal-close-button secondary"
                  onClick={() => {
                    setIsConfirmModalOpen(false);
                    setPendingFile(null);
                  }}
                  disabled={loading}
                >
                  Нет
                </button>
              </div>
            </div>
          </div>
        )}
        {isResultModalOpen && (
          <div className="modal-overlay" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-label="Результат загрузки">
              {resultMessage && <p className="result-message">{resultMessage}</p>}
              {stats && (
                <div className="stats">
                  <p>Общее количество прочитанных записей: {stats.totalReadRecords}</p>
                  <p>Количество новых записей: {stats.newRecords}</p>
                  <p>Количество обновленных записей: {stats.updatedRecords}</p>
                  <p>Количество ошибочных записей: {stats.errorRecords}</p>
                  <p>Количество удаленных записей: {stats.deletedRecords}</p>
                </div>
              )}
              {logFileUrl && (
                <a className="log-link" href={logFileUrl} target="_blank" rel="noreferrer">
                  Открыть протокол загрузки (.log)
                </a>
              )}
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setIsResultModalOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
        {pendingEmployeeDelete && (
          <div className="modal-overlay" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-label="Удаление сотрудника">
              <p className="result-message">
                Удалить сотрудника{pendingEmployeeDelete.fullName ? ` "${pendingEmployeeDelete.fullName}"` : ""}?
              </p>
              <div className="confirm-actions">
                <button type="button" className="modal-close-button" onClick={confirmDeleteEmployee}>
                  Да
                </button>
                <button
                  type="button"
                  className="modal-close-button secondary"
                  onClick={closeDeleteEmployeeModal}
                >
                  Нет
                </button>
              </div>
            </div>
          </div>
        )}
        {pendingRelationDelete && (
          <div className="modal-overlay" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-label="Удаление связи">
              <p className="result-message">Удалить выбранную связь?</p>
              <div className="confirm-actions">
                <button type="button" className="modal-close-button" onClick={confirmDeleteRelation}>
                  Да
                </button>
                <button
                  type="button"
                  className="modal-close-button secondary"
                  onClick={closeDeleteRelationModal}
                >
                  Нет
                </button>
              </div>
            </div>
          </div>
        )}
        {pendingPositionDelete && (
          <div className="modal-overlay" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-label="Удаление связи подчинения">
              <p className="result-message">Удалить выбранную связь?</p>
              <div className="confirm-actions">
                <button type="button" className="modal-close-button" onClick={confirmDeletePosition}>
                  Да
                </button>
                <button
                  type="button"
                  className="modal-close-button secondary"
                  onClick={closeDeletePositionModal}
                >
                  Нет
                </button>
              </div>
            </div>
          </div>
        )}
        {cellTooltip.visible && (
          <div
            className="custom-cell-tooltip"
            style={{ left: `${cellTooltip.x}px`, top: `${cellTooltip.y}px` }}
          >
            {cellTooltip.text}
          </div>
        )}
        {buttonTooltip.visible && (
          <div
            className="custom-button-tooltip"
            style={{ left: `${buttonTooltip.x}px`, top: `${buttonTooltip.y}px` }}
          >
            {buttonTooltip.text}
          </div>
        )}
        {String(systemErrorToast?.message ?? "").trim() && (
          <div
            className={`relations-error-toast${isSystemErrorToastClosing ? " closing" : ""}`}
            role="alert"
            aria-live="assertive"
          >
            <span>{systemErrorToast.message}</span>
            <button
              type="button"
              className="relations-error-toast-close"
              aria-label="Закрыть сообщение об ошибке"
              onClick={() => setSystemErrorToast((prev) => ({ ...prev, message: "" }))}
            >
              ×
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
