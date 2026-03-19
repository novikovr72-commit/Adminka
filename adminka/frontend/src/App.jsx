import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Prism from "prismjs";
import "prismjs/components/prism-sql";
import * as XLSX from "xlsx";
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
const REPORT_SETTINGS_SORT_RULES_STORAGE_KEY = "report-settings.sort-rules";
const REPORT_SETTINGS_FILTERS_STORAGE_KEY = "report-settings.filters";
const REPORT_SETTINGS_COLUMN_WIDTHS_STORAGE_KEY = "report-settings.column-widths";
const REPORT_SETTINGS_COLUMN_SETTINGS_STORAGE_KEY = "report-settings.column-settings";
const ORGANIZATIONS_SORT_RULES_STORAGE_KEY = "organizations.sort-rules";
const ORGANIZATIONS_FILTERS_STORAGE_KEY = "organizations.filters.v2";
const ORGANIZATIONS_COLUMN_WIDTHS_STORAGE_KEY = "organizations.column-widths";
const ORGANIZATIONS_COLUMN_SETTINGS_STORAGE_KEY = "organizations.column-settings";
const REPORT_TEMPLATE_FIELDS_COLUMN_WIDTHS_STORAGE_KEY = "report-template.fields-column-widths";
const REPORT_TEMPLATE_GENERAL_PARAMETER_COLUMN_WIDTH_STORAGE_KEY =
  "report-template.general-parameter-column-width";
const REPORT_TEMPLATE_GENERAL_SORT_DIRECTION_STORAGE_KEY = "report-template.general-sort-direction";
const REPORT_TEMPLATE_LEVEL_EXPANDED_STORAGE_KEY = "report-template.level-expanded";
const DADATA_HIDDEN_ATTRIBUTES_STORAGE_KEY = "organization.dadata.hidden-attributes.v1";
const DADATA_VISIBLE_ONLY_STORAGE_KEY = "organization.dadata.visible-only.v1";
const DADATA_ATTRIBUTE_ORDER_STORAGE_KEY = "organization.dadata.attribute-order.v1";
const CONFIGURED_API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
const IS_BROWSER = typeof window !== "undefined";
const RUNTIME_API_BASE_URL = IS_BROWSER
  ? `${window.location.protocol}//${window.location.hostname}:3003`
  : "http://localhost:3003";
const IS_REMOTE_BROWSER =
  IS_BROWSER && !["localhost", "127.0.0.1"].includes(String(window.location.hostname ?? "").toLowerCase());
const IS_LOCALHOST_CONFIG =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(CONFIGURED_API_BASE_URL) ||
  /^localhost(:\d+)?$/i.test(CONFIGURED_API_BASE_URL) ||
  /^127\.0\.0\.1(:\d+)?$/i.test(CONFIGURED_API_BASE_URL);
const API_BASE_URL = (
  IS_REMOTE_BROWSER && IS_LOCALHOST_CONFIG
    ? RUNTIME_API_BASE_URL
    : (CONFIGURED_API_BASE_URL || RUNTIME_API_BASE_URL)
).replace(/\/+$/, "");
const ADMIN_API_BASE_URL = `${API_BASE_URL}/api/admin`;
const EMPLOYEES_API_URL = `${ADMIN_API_BASE_URL}/employees`;
const ORGANIZATIONS_API_URL = `${ADMIN_API_BASE_URL}/organizations`;
const RELATIONS_API_URL = `${ADMIN_API_BASE_URL}/relations`;
const REPORT_TEMPLATES_API_URL = `${ADMIN_API_BASE_URL}/report-templates`;
const REPORT_TEMPLATE_SQL_VALIDATE_API_URL = `${ADMIN_API_BASE_URL}/report-template/sql/validate`;
const REPORT_TEMPLATES_SQL_VALIDATE_API_URL = `${ADMIN_API_BASE_URL}/report-templates/sql/validate`;
const REPORT_TEMPLATE_SQL_RESULTS_API_URL = `${ADMIN_API_BASE_URL}/report-template/sql/results`;
const REPORT_TEMPLATES_SQL_RESULTS_API_URL = `${ADMIN_API_BASE_URL}/report-templates/sql/results`;
const REPORT_SQL_RESULTS_PREVIEW_LIMIT = 50;
const REPORT_TEMPLATE_EXCEL_PREVIEW_API_URL = `${ADMIN_API_BASE_URL}/report-template/excel-preview`;
const REPORT_TEMPLATES_EXCEL_PREVIEW_API_URL = `${ADMIN_API_BASE_URL}/report-templates/excel-preview`;
const REPORT_TEMPLATE_EXCEL_API_URL = `${ADMIN_API_BASE_URL}/report-template/excel`;
const REPORT_TEMPLATES_EXCEL_API_URL = `${ADMIN_API_BASE_URL}/report-templates/excel`;
const REPORT_CARD_TRANSITION_MS = 2100;
const SIDE_CARD_TRANSITION_MS = 320;
const PRINT_FORM_TEMPLATES_API_URL = `${ADMIN_API_BASE_URL}/print-form-templates`;
const PRINT_FORM_TEMPLATE_CREATE_API_URL = `${ADMIN_API_BASE_URL}/print-form-template`;
const PRINT_FORM_TEMPLATE_RECOGNIZE_API_URL = `${ADMIN_API_BASE_URL}/print-form-template/recognize`;
const REPORT_PREVIEW_MAX_RECORDS = 50;
const REPORT_TEMPLATE_SETTINGS_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-template/${reportTemplateId}/template-settings`;
const REPORT_TEMPLATES_SETTINGS_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-templates/${reportTemplateId}/template-settings`;
const REPORT_TEMPLATE_MAIN_SETTINGS_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-template/${reportTemplateId}`;
const REPORT_TEMPLATES_MAIN_SETTINGS_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-templates/${reportTemplateId}`;
const REPORT_TEMPLATE_CREATE_API_URL = `${ADMIN_API_BASE_URL}/report-template`;
const REPORT_TEMPLATES_CREATE_API_URL = `${ADMIN_API_BASE_URL}/report-templates/create`;
const REPORT_TEMPLATE_ORGANIZATION_DELETE_API_PATH = (reportTemplateId, organUnitId) =>
  `${ADMIN_API_BASE_URL}/report-template/${reportTemplateId}/organizations/${organUnitId}`;
const REPORT_TEMPLATES_ORGANIZATION_DELETE_API_PATH = (reportTemplateId, organUnitId) =>
  `${ADMIN_API_BASE_URL}/report-templates/${reportTemplateId}/organizations/${organUnitId}`;
const REPORT_TEMPLATE_ORGANIZATION_ADD_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-template/${reportTemplateId}/organizations`;
const REPORT_TEMPLATES_ORGANIZATION_ADD_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-templates/${reportTemplateId}/organizations`;
const REPORT_TEMPLATE_ACCESS_GROUP_DELETE_API_PATH = (reportTemplateId, codeAccess) =>
  `${ADMIN_API_BASE_URL}/report-template/${reportTemplateId}/access-groups?codeAccess=${encodeURIComponent(
    String(codeAccess ?? "")
  )}`;
const REPORT_TEMPLATES_ACCESS_GROUP_DELETE_API_PATH = (reportTemplateId, codeAccess) =>
  `${ADMIN_API_BASE_URL}/report-templates/${reportTemplateId}/access-groups?codeAccess=${encodeURIComponent(
    String(codeAccess ?? "")
  )}`;
const REPORT_TEMPLATE_ACCESS_GROUP_ADD_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-template/${reportTemplateId}/access-groups`;
const REPORT_TEMPLATES_ACCESS_GROUP_ADD_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-templates/${reportTemplateId}/access-groups`;
const REPORT_TEMPLATE_RECIPIENT_DELETE_API_PATH = (reportTemplateId, email) =>
  `${ADMIN_API_BASE_URL}/report-template/${reportTemplateId}/recipients?email=${encodeURIComponent(
    String(email ?? "")
  )}`;
const REPORT_TEMPLATES_RECIPIENT_DELETE_API_PATH = (reportTemplateId, email) =>
  `${ADMIN_API_BASE_URL}/report-templates/${reportTemplateId}/recipients?email=${encodeURIComponent(
    String(email ?? "")
  )}`;
const REPORT_TEMPLATE_RECIPIENT_ADD_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-template/${reportTemplateId}/recipients`;
const REPORT_TEMPLATES_RECIPIENT_ADD_API_PATH = (reportTemplateId) =>
  `${ADMIN_API_BASE_URL}/report-templates/${reportTemplateId}/recipients`;
const REPORT_ACCESS_GROUP_ENUM = Array.from({ length: 10 }, (_, index) => `GRP${String(index + 1).padStart(2, "0")}`);
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const EMPLOYEES_IMPORT_API_URL = `${ADMIN_API_BASE_URL}/employees/import`;
const LIST_ORGANIZATIONS_API_URL = `${ADMIN_API_BASE_URL}/list_organizations`;
const LIST_ORGANIZATION_UNIT_TYPES_API_URL = `${ADMIN_API_BASE_URL}/list_organization_unit_types`;
const LIST_COUNTRIES_API_URL = `${ADMIN_API_BASE_URL}/list_countries`;
const ORGANIZATION_DETAILS_API_PATH = (organUnitId) => `${ADMIN_API_BASE_URL}/organization/${organUnitId}`;
const ORGANIZATION_UPDATE_API_PATH = (organUnitId) => `${ADMIN_API_BASE_URL}/organization/${organUnitId}`;
const ORGANIZATION_DADATA_REFRESH_API_PATH = (organUnitId) =>
  `${ADMIN_API_BASE_URL}/organization/${organUnitId}/dadata/refresh`;
const DADATA_FIELD_DESCRIPTIONS = {
  value: "Наименование компании",
  unrestricted_value: "Наименование компании (полное)",
  "data.inn": "ИНН",
  "data.kpp": "КПП",
  "data.kpp_largest": "КПП крупнейшего налогоплательщика",
  "data.ogrn": "ОГРН",
  "data.ogrn_date": "Дата выдачи ОГРН",
  "data.hid": "Внутренний идентификатор",
  "data.type": "Тип организации",
  "data.branch_type": "Тип подразделения",
  "data.branch_count": "Количество филиалов",
  "data.invalid": "Признак недостоверных сведений",
  "data.employee_count": "Среднесписочная численность работников",
  "data.okato": "Код ОКАТО",
  "data.oktmo": "Код ОКТМО",
  "data.okpo": "Код ОКПО",
  "data.okogu": "Код ОКОГУ",
  "data.okfs": "Код ОКФС",
  "data.okved": "Код ОКВЭД",
  "data.okved_type": "Версия справочника ОКВЭД",
  "data.name.full_with_opf": "Полное наименование",
  "data.name.short_with_opf": "Краткое наименование",
  "data.name.latin": "Латинское наименование",
  "data.name.full": "Полное наименование без ОПФ",
  "data.name.short": "Краткое наименование без ОПФ",
  "data.management.name": "Руководитель",
  "data.management.post": "Должность руководителя",
  "data.management.start_date": "Дата вступления в должность",
  "data.state.status": "Статус организации",
  "data.state.actuality_date": "Дата последних изменений",
  "data.state.registration_date": "Дата регистрации",
  "data.state.liquidation_date": "Дата ликвидации",
  "data.state.code": "Детальный статус",
  "data.opf.code": "Код ОКОПФ",
  "data.opf.full": "Полное название ОПФ",
  "data.opf.short": "Краткое название ОПФ",
  "data.opf.type": "Версия справочника ОКОПФ",
  "data.address.value": "Адрес одной строкой",
  "data.address.unrestricted_value": "Полный адрес с индексом",
  "data.address.invalidity": "Недостоверность сведений об адресе",
  "data.address.data.source": "Исходный адрес одной строкой",
  "data.address.data.result": "Стандартизованный адрес одной строкой",
  "data.address.data.postal_code": "Индекс",
  "data.address.data.country": "Страна",
  "data.address.data.country_iso_code": "ISO-код страны",
  "data.address.data.federal_district": "Федеральный округ",
  "data.address.data.region_fias_id": "ФИАС-код региона",
  "data.address.data.region_kladr_id": "КЛАДР-код региона",
  "data.address.data.region_iso_code": "ISO-код региона",
  "data.address.data.region_with_type": "Регион с типом",
  "data.address.data.region_type": "Тип региона (сокращенный)",
  "data.address.data.region_type_full": "Тип региона",
  "data.address.data.region": "Регион",
  "data.address.data.area_fias_id": "ФИАС-код района",
  "data.address.data.area_kladr_id": "КЛАДР-код района",
  "data.address.data.area_with_type": "Район с типом",
  "data.address.data.area_type": "Тип района (сокращенный)",
  "data.address.data.area_type_full": "Тип района",
  "data.address.data.area": "Район",
  "data.address.data.city_fias_id": "ФИАС-код города",
  "data.address.data.city_kladr_id": "КЛАДР-код города",
  "data.address.data.city_with_type": "Город с типом",
  "data.address.data.city_type": "Тип города (сокращенный)",
  "data.address.data.city_type_full": "Тип города",
  "data.address.data.city": "Город",
  "data.address.data.city_area": "Административный округ",
  "data.address.data.city_district_fias_id": "ФИАС-код района города",
  "data.address.data.city_district_kladr_id": "КЛАДР-код района города",
  "data.address.data.city_district_with_type": "Район города с типом",
  "data.address.data.city_district_type": "Тип района города (сокращенный)",
  "data.address.data.city_district_type_full": "Тип района города",
  "data.address.data.city_district": "Район города",
  "data.address.data.settlement_fias_id": "ФИАС-код населенного пункта",
  "data.address.data.settlement_kladr_id": "КЛАДР-код населенного пункта",
  "data.address.data.settlement_with_type": "Населенный пункт с типом",
  "data.address.data.settlement_type": "Тип населенного пункта (сокращенный)",
  "data.address.data.settlement_type_full": "Тип населенного пункта",
  "data.address.data.settlement": "Населенный пункт",
  "data.address.data.street_fias_id": "ФИАС-код улицы",
  "data.address.data.street_kladr_id": "КЛАДР-код улицы",
  "data.address.data.street_with_type": "Улица с типом",
  "data.address.data.street_type": "Тип улицы (сокращенный)",
  "data.address.data.street_type_full": "Тип улицы",
  "data.address.data.street": "Улица",
  "data.address.data.stead_fias_id": "ФИАС-код земельного участка",
  "data.address.data.stead_kladr_id": "КЛАДР-код земельного участка",
  "data.address.data.stead_cadnum": "Кадастровый номер земельного участка",
  "data.address.data.stead_type": "Тип земельного участка (сокращенный)",
  "data.address.data.stead_type_full": "Тип земельного участка",
  "data.address.data.stead": "Номер земельного участка",
  "data.address.data.house_fias_id": "ФИАС-код дома",
  "data.address.data.house_kladr_id": "КЛАДР-код дома",
  "data.address.data.house_cadnum": "Кадастровый номер дома",
  "data.address.data.house_type": "Тип дома (сокращенный)",
  "data.address.data.house_type_full": "Тип дома",
  "data.address.data.house": "Дом",
  "data.address.data.house_flat_count": "Количество квартир в доме",
  "data.address.data.block_type": "Тип корпуса/строения (сокращенный)",
  "data.address.data.block_type_full": "Тип корпуса/строения",
  "data.address.data.block": "Корпус/строение",
  "data.address.data.entrance": "Подъезд",
  "data.address.data.floor": "Этаж",
  "data.address.data.flat_fias_id": "ФИАС-код квартиры",
  "data.address.data.flat_cadnum": "Кадастровый номер квартиры",
  "data.address.data.flat_type": "Тип квартиры (сокращенный)",
  "data.address.data.flat_type_full": "Тип квартиры",
  "data.address.data.flat": "Квартира",
  "data.address.data.flat_area": "Площадь квартиры",
  "data.address.data.square_meter_price": "Рыночная стоимость м2",
  "data.address.data.flat_price": "Рыночная стоимость квартиры",
  "data.address.data.postal_box": "Абонентский ящик",
  "data.address.data.room_type": "Тип комнаты (сокращенный)",
  "data.address.data.room_type_full": "Тип комнаты",
  "data.address.data.room": "Комната",
  "data.address.data.fias_id": "ФИАС-код адреса",
  "data.address.data.fias_code": "Код ФИАС",
  "data.address.data.fias_level": "Уровень детализации ФИАС",
  "data.address.data.fias_actuality_state": "Признак актуальности адреса в ФИАС",
  "data.address.data.kladr_id": "КЛАДР-код адреса",
  "data.address.data.geoname_id": "Идентификатор объекта в GeoNames",
  "data.address.data.capital_marker": "Признак центра района/региона",
  "data.address.data.okato": "Код ОКАТО",
  "data.address.data.oktmo": "Код ОКТМО",
  "data.address.data.tax_office": "Код ИФНС для физических лиц",
  "data.address.data.tax_office_legal": "Код ИФНС для организаций",
  "data.address.data.timezone": "Часовой пояс",
  "data.address.data.geo_lat": "Координаты: широта",
  "data.address.data.geo_lon": "Координаты: долгота",
  "data.address.data.beltway_hit": "Внутри кольцевой",
  "data.address.data.beltway_distance": "Расстояние от кольцевой, км",
  "data.address.data.qc_geo": "Код точности координат",
  "data.address.data.qc_complete": "Код пригодности к рассылке",
  "data.address.data.qc_house": "Признак наличия дома в ФИАС",
  "data.address.data.qc": "Код проверки адреса",
  "data.address.data.unparsed_parts": "Нераспознанная часть адреса",
  "data.address.data.metro": "Список ближайших станций метро",
  "data.address.data.metro[].name": "Название станции метро",
  "data.address.data.metro[].line": "Название линии метро",
  "data.address.data.metro[].distance": "Расстояние до станции, км",
  "data.address.data.divisions": "Компоненты адреса в административном делении",
  "data.address.data.divisions.administrative.area.name_with_type": "Район региона с типом",
  "data.address.data.divisions.administrative.city.name_with_type": "Город с типом",
  "data.address.data.divisions.administrative.city_district.name_with_type": "Район города с типом",
  "data.address.data.divisions.administrative.settlement.name_with_type": "Населенный пункт с типом",
  "data.address.data.divisions.administrative.planning_structure.name_with_type":
    "Планировочная структура с типом",
  "data.finance.tax_system": "Система налогообложения",
  "data.finance.income": "Доходы",
  "data.finance.revenue": "Выручка",
  "data.finance.expense": "Расходы",
  "data.finance.debt": "Недоимки по налогам",
  "data.finance.penalty": "Налоговые штрафы",
  "data.finance.year": "Год отчетности",
  "data.okveds": "Коды ОКВЭД дополнительных видов деятельности",
  "data.authorities": "Сведения о налоговой, ПФР и ФСС",
  "data.documents": "Документы",
  "data.licenses": "Лицензии",
  "data.founders": "Учредители компании",
  "data.managers": "Руководители компании",
  "data.predecessors": "Правопредшественники",
  "data.successors": "Правопреемники",
  "data.phones": "Телефоны",
  "data.emails": "Адреса электронной почты"
};
const DADATA_ORGANIZATION_STATUS_DESCRIPTIONS = {
  ACTIVE: "Действующая",
  LIQUIDATING: "Ликвидируется",
  LIQUIDATED: "Ликвидирована",
  BANKRUPT: "Банкротство",
  REORGANIZING: "В процессе реорганизации"
};
const DADATA_BRANCH_TYPE_DESCRIPTIONS = {
  MAIN: "Головная организация",
  BRANCH: "Филиал"
};
const DADATA_ORGANIZATION_TYPE_DESCRIPTIONS = {
  LEGAL: "Юрлицо",
  INDIVIDUAL: "Индивидуальный предприниматель"
};
const LIST_RELATIONS_API_URL = `${ADMIN_API_BASE_URL}/list_relations`;
const LIST_PRODUCT_GROUPS_API_URL = `${ADMIN_API_BASE_URL}/list_product_groups`;
const LIST_POSITIONS_API_URL = `${ADMIN_API_BASE_URL}/list_positions`;
const LIST_EMPLOYEES_API_URL = `${ADMIN_API_BASE_URL}/list_employees`;
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
  EMPLOYEE_RELATIONS: "employee-relations",
  REPORT_SETTINGS: "report-settings",
  PRINT_FORMS: "print-forms"
};
const PAGE_TITLES = {
  [PAGE_IDS.EMPLOYEES]: "Список сотрудников",
  [PAGE_IDS.ORGANIZATIONS]: "Список организаций",
  [PAGE_IDS.EMPLOYEE_RELATIONS]: "Список связей сотрудников",
  [PAGE_IDS.REPORT_SETTINGS]: "Настройка отчетов",
  [PAGE_IDS.PRINT_FORMS]: "Шаблоны печатных форм"
};
const PAGE_PATHNAMES = {
  [PAGE_IDS.EMPLOYEES]: "/employees",
  [PAGE_IDS.ORGANIZATIONS]: "/organizations",
  [PAGE_IDS.EMPLOYEE_RELATIONS]: "/employee-relations",
  [PAGE_IDS.REPORT_SETTINGS]: "/report-settings",
  [PAGE_IDS.PRINT_FORMS]: "/print-forms"
};
const PRINT_FORMS_TABS = {
  LIST: "list",
  CREATE: "create"
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
const INITIAL_ORGANIZATION_CARD_EDIT_FORM = {
  sapId: "",
  inn: "",
  kpp: "",
  name: "",
  shName: "",
  ogrn: "",
  okpo: "",
  shortCode: "",
  signResident: "НЕТ",
  countryId: "",
  organUnitTypeIds: [],
  address: "",
  kcehNumber: "",
  claimPrefix: "",
  fastTrack: ""
};
const INITIAL_REPORT_MAIN_SETTINGS_DRAFT = {
  codeReport: "",
  name: "",
  version: "",
  method: "AUTO",
  numberDays: "",
  outputFileName: "",
  outputFileType: "XLSX",
  status: "ACTIVE"
};
const buildReportMainSettingsDraft = (report) => ({
  codeReport: String(report?.codeReport ?? report?.code_report ?? "").trim(),
  name: String(report?.name ?? "").trim(),
  version: String(report?.version ?? "").trim(),
  method: String(report?.method ?? "").trim(),
  numberDays: String(report?.numberDays ?? report?.number_days ?? "").trim(),
  outputFileName: String(report?.outputFileName ?? report?.output_file_name ?? "").trim(),
  outputFileType: String(report?.outputFileType ?? report?.output_file_type ?? "").trim(),
  status: String(report?.status ?? "").trim()
});
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
  { key: "organUnitTypeNames", title: "Тип организации", sortField: "organUnitTypeNames" },
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
const REPORT_SETTINGS_COLUMNS = [
  { key: "codeReport", title: "Код отчета", sortField: "codeReport" },
  { key: "name", title: "Название отчета", sortField: "name" },
  { key: "version", title: "Версия отчета", sortField: "version" },
  { key: "method", title: "Метод формирования", sortField: "method" },
  { key: "outputFileName", title: "Название выходного файла", sortField: "outputFileName" },
  { key: "outputFileType", title: "Тип выходного файла", sortField: "outputFileType" },
  { key: "numberDays", title: "Количество дней" },
  { key: "status", title: "Статус", sortField: "status" }
];
const REPORT_SETTINGS_FILTERABLE_FIELDS = new Set([
  "codeReport",
  "name",
  "outputFileName",
  "outputFileType",
  "version",
  "status",
  "method"
]);
const RELATIONS_PAGE_DEFAULT_SORT_RULES = [{ field: "employeeName", direction: "ASC" }];
const REPORT_TEMPLATE_DATA_TYPE_OPTIONS = [
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "boolean", label: "Булево (true/false)" },
  { value: "date", label: "Дата" },
  { value: "datetime", label: "Дата/время" }
];
const REPORT_TEMPLATE_DATA_FORMAT_OPTIONS = {
  text: [
    { value: "", label: "Без формата" },
    { value: "@", label: "Текст (@)" }
  ],
  number: [
    { value: "0", label: "Целое (0)" },
    { value: "0.0", label: "С 1 знаком (0.0)" },
    { value: "0.00", label: "С 2 знаками (0.00)" },
    { value: "0.000", label: "С 3 знаками (0.000)" },
    { value: "#,##0.00", label: "Разделитель тысяч (#,##0.00)" }
  ],
  boolean: [
    { value: "", label: "Без формата" }
  ],
  date: [
    { value: "ДД.ММ.ГГГГ", label: "ДД.ММ.ГГГГ" },
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }
  ],
  datetime: [
    { value: "ДД.ММ.ГГГГ чч:мм;@", label: "ДД.ММ.ГГГГ чч:мм;@" },
    { value: "YYYY-MM-DD HH:mm:ss", label: "YYYY-MM-DD HH:mm:ss" }
  ]
};
const REPORT_TEMPLATE_VERTICAL_ALIGN_OPTIONS = [
  { value: "ВЕРХ", label: "ВЕРХ" },
  { value: "СЕРЕДИНА", label: "СЕРЕДИНА" },
  { value: "НИЗ", label: "НИЗ" }
];
const REPORT_TEMPLATE_HORIZONTAL_ALIGN_OPTIONS = [
  { value: "СЛЕВА", label: "СЛЕВА" },
  { value: "ЦЕНТР", label: "ЦЕНТР" },
  { value: "СПРАВА", label: "СПРАВА" }
];
const REPORT_TEMPLATE_FIELDS_COLUMNS = [
  { key: "fieldOrderNumber", title: "Пор.№" },
  { key: "fieldName", title: "Название поля" },
  { key: "reportVisible", title: "Показывать" },
  { key: "fieldCaption", title: "Заголовок поля" },
  { key: "fieldDataType", title: "Тип данных" },
  { key: "fieldDataFormat", title: "Формат данных" },
  { key: "fieldVertAlign", title: "Выр. по вертикали" },
  { key: "fieldHorizAlign", title: "Выр. по горизонтали" },
  { key: "fieldLink", title: "Ссылка" },
  { key: "fieldAutoWidth", title: "Автоширина" },
  { key: "filedWidth", title: "Ширина (Excel)" },
  { key: "fieldAutoTransfer", title: "Автоперенос" },
  { key: "fieldBoldFont", title: "Жирный шрифт" }
];
const REPORT_TEMPLATE_FIELDS_MIN_COLUMN_WIDTH_PX = 120;
const REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS = {
  fieldOrderNumber: 150,
  fieldName: 240,
  reportVisible: 130,
  fieldCaption: 240,
  fieldDataType: 140,
  fieldDataFormat: 170,
  fieldVertAlign: 170,
  fieldHorizAlign: 170,
  fieldLink: 160,
  filedWidth: 140,
  fieldAutoWidth: 120,
  fieldAutoTransfer: 130,
  fieldBoldFont: 120
};
const REPORT_TEMPLATE_GENERAL_SETTINGS_COLUMNS = {
  parameter: { key: "parameter", title: "Параметр" },
  value: { key: "value", title: "Значение параметра" }
};
const REPORT_TEMPLATE_GENERAL_SETTINGS_MIN_PARAMETER_COL_PX = 220;
const REPORT_TEMPLATE_GENERAL_SETTINGS_MIN_VALUE_COL_PX = 220;
const REPORT_TEMPLATE_GENERAL_SETTINGS_DEFAULT_PARAMETER_COL_PX = 360;
const REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS = {
  ASC: "ASC",
  DESC: "DESC"
};
const REPORT_TEMPLATE_GENERAL_SETTINGS_ROWS = [
  { key: "showLogoReport", label: "Отображение логотипа", type: "boolean" },
  { key: "headerCaption", label: "Заголовок отчета", type: "text" },
  { key: "headerFontSize", label: "Размер шрифта заголовка отчета, px", type: "number" },
  { key: "headerFontColor", label: "Цвет шрифта заголовка отчета", type: "color" },
  { key: "heightTabCaption", label: "Высота табличного заголовка, px", type: "number" },
  { key: "backTabCaptionColor", label: "Цвет фона табличного заголовка", type: "color" },
  { key: "fontTabCaptionColor", label: "Цвет шрифта табличного заголовка", type: "color" },
  { key: "fontTabCaptionSize", label: "Размер шрифта табличного заголовка, px", type: "number" },
  { key: "recordFontSize", label: "Размер шрифта записей таблицы, px", type: "number" },
  { key: "startReportRow", label: "Номер начальной строки отчета", type: "number" },
  { key: "startReportCol", label: "Номер начальной колонки отчета", type: "number" },
  { key: "filtrSet", label: "Включить фильтр", type: "boolean" }
];
const REPORT_TEMPLATE_GENERAL_SETTINGS_ROWS_ASC = [...REPORT_TEMPLATE_GENERAL_SETTINGS_ROWS].sort((left, right) =>
  left.label.localeCompare(right.label, "ru-RU", {
    sensitivity: "base",
    numeric: true
  })
);
const REPORT_TEMPLATE_JSON_LINE_HEIGHT_PX = 18;
const REPORT_TEMPLATE_JSON_PADDING_PX = 10;
const REPORT_TEMPLATE_JSON_GUTTER_WIDTH_PX = 48;
const REPORT_TEMPLATE_JSON_BASE_FONT_SIZE_PX = 13;
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
  organUnitTypeNames: [],
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
const REPORT_SETTINGS_INITIAL_FILTERS = {
  codeReport: "",
  name: "",
  version: "",
  method: "",
  outputFileName: "",
  outputFileType: "",
  status: ""
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
  organUnitTypeNames: 260,
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
const REPORT_SETTINGS_DEFAULT_COLUMN_WIDTHS = {
  codeReport: 160,
  name: 320,
  version: 160,
  method: 220,
  outputFileName: 280,
  outputFileType: 180,
  numberDays: 180,
  status: 160
};
const MIN_COLUMN_WIDTH = 90;
const RELATION_COMBO_VISIBLE_OPTION_COUNT = 15;
const RELATION_COMBO_OPTION_HEIGHT_PX = 32;
const RELATION_COMBO_MENU_PADDING_PX = 12;
const URL_EMPLOYEE_ID_PARAM = "employeeId";
const URL_ORGANIZATION_ID_PARAM = "organUnitId";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizePathname = (value) => {
  const trimmed = String(value ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed.toLowerCase()}` : "/";
};

const getPageIdFromUrl = () => {
  if (typeof window === "undefined") {
    return PAGE_IDS.EMPLOYEES;
  }
  const normalized = normalizePathname(window.location.pathname);
  const pair = Object.entries(PAGE_PATHNAMES).find(([, path]) => normalizePathname(path) === normalized);
  return pair?.[0] ?? PAGE_IDS.EMPLOYEES;
};

const setPageIdToUrl = (pageId) => {
  if (typeof window === "undefined") {
    return;
  }
  const targetPath = PAGE_PATHNAMES[pageId] ?? PAGE_PATHNAMES[PAGE_IDS.EMPLOYEES];
  const currentPath = normalizePathname(window.location.pathname);
  if (normalizePathname(targetPath) === currentPath) {
    return;
  }
  const nextUrl = `${targetPath}${window.location.search}${window.location.hash}`;
  window.history.pushState(window.history.state, "", nextUrl);
};

const normalizeEmployeeId = (value) => {
  const normalized = String(value ?? "").trim();
  return UUID_PATTERN.test(normalized) ? normalized : "";
};

const normalizeOrganizationId = (value) => {
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
  return `${PAGE_PATHNAMES[PAGE_IDS.EMPLOYEES]}?${params.toString()}`;
};

const buildOrganizationCardUrl = (organUnitId) => {
  if (typeof window === "undefined") {
    return "#";
  }
  const normalized = normalizeOrganizationId(organUnitId);
  if (!normalized) {
    return "#";
  }
  const params = new URLSearchParams();
  params.set(URL_ORGANIZATION_ID_PARAM, normalized);
  return `${PAGE_PATHNAMES[PAGE_IDS.ORGANIZATIONS]}?${params.toString()}`;
};

const getOrganizationIdFromUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }
  const params = new URLSearchParams(window.location.search);
  return (
    normalizeOrganizationId(params.get(URL_ORGANIZATION_ID_PARAM)) ||
    normalizeOrganizationId(params.get("organ_unit_id"))
  );
};

const setOrganizationIdToUrl = (organUnitId) => {
  if (typeof window === "undefined") {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const normalized = normalizeOrganizationId(organUnitId);
  if (normalized) {
    params.set(URL_ORGANIZATION_ID_PARAM, normalized);
  } else {
    params.delete(URL_ORGANIZATION_ID_PARAM);
    params.delete("organ_unit_id");
  }
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
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

const toBooleanOrDefault = (value, fallbackValue) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "да") {
      return true;
    }
    if (normalized === "false" || normalized === "нет") {
      return false;
    }
  }
  return fallbackValue;
};

const toNumberOrDefault = (value, fallbackValue) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
};

const normalizeHexColorOrDefault = (value, fallbackValue) => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(normalized)) {
    return normalized;
  }
  return fallbackValue;
};

const sanitizePositiveIntegerDraftValue = (value) => String(value ?? "").replace(/[^\d]/g, "");

const sanitizeHexColorDraftValue = (value) => {
  const source = String(value ?? "").toUpperCase();
  const hexOnly = source.replace(/[^0-9A-F#]/g, "");
  const noSharp = hexOnly.replace(/#/g, "");
  return `#${noSharp.slice(0, 6)}`;
};

const isReportTemplateFieldVisible = (field) =>
  toBooleanOrDefault(field?.reportVisible, true);

const normalizeReportTemplateField = (field, index) => {
  const source = field && typeof field === "object" ? field : {};
  const dataType = String(source.fieldDataType ?? "text").trim().toLowerCase() || "text";
  const verticalAlignRaw = String(source.fieldVertAlign ?? "").trim().toUpperCase();
  const horizontalAlignRaw = String(source.fieldHorizAlign ?? "").trim().toUpperCase();
  const reportVisible = toBooleanOrDefault(source.reportVisible, true);
  const rawOrderNumber = source.fieldOrderNumber ?? source.fielOrderNumber;
  const hasOrderNumber =
    rawOrderNumber !== null &&
    rawOrderNumber !== undefined &&
    String(rawOrderNumber).trim() !== "";
  const normalizedOrderNumber = reportVisible && hasOrderNumber
    ? String(Math.max(1, Number(rawOrderNumber) || index + 1))
    : "";
  const filedWidthRaw = source.filedWidth ?? source.fieldWidth;
  const filedWidth = sanitizePositiveIntegerDraftValue(filedWidthRaw);
  return {
    direction: String(source.direction ?? "").trim(),
    fieldName: String(source.fieldName ?? "").trim(),
    reportVisible,
    fieldCaption: String(source.fieldCaption ?? "").trim(),
    fieldOrderNumber: normalizedOrderNumber,
    fieldDataType: REPORT_TEMPLATE_DATA_TYPE_OPTIONS.some((item) => item.value === dataType)
      ? dataType
      : "text",
    fieldDataFormat: String(source.fieldDataFormat ?? "").trim(),
    fieldVertAlign: REPORT_TEMPLATE_VERTICAL_ALIGN_OPTIONS.some((item) => item.value === verticalAlignRaw)
      ? verticalAlignRaw
      : "ВЕРХ",
    fieldHorizAlign: REPORT_TEMPLATE_HORIZONTAL_ALIGN_OPTIONS.some((item) => item.value === horizontalAlignRaw)
      ? horizontalAlignRaw
      : "СЛЕВА",
    fieldLink: String(source.fieldLink ?? "").trim(),
    filedWidth,
    fieldAutoWidth: toBooleanOrDefault(source.fieldAutoWidth, true),
    fieldAutoTransfer: toBooleanOrDefault(source.fieldAutoTransfer, true),
    fieldBoldFont: toBooleanOrDefault(source.fieldBoldFont, false)
  };
};

const buildDefaultReportTemplateSettings = (reportName) => ({
  showLogoReport: true,
  headerCaption: String(reportName ?? "").trim(),
  headerFontSize: 16,
  headerFontColor: "#000000",
  heightTabCaption: 70,
  backTabCaptionColor: "#FFFFFF",
  fontTabCaptionColor: "#000000",
  fontTabCaptionSize: 12,
  startReportRow: 4,
  startReportCol: 1,
  filtrSet: true,
  recordFontSize: 11,
  fields: []
});

const normalizeReportTemplateSettings = (reportInfoRaw, reportName) => {
  const defaults = buildDefaultReportTemplateSettings(reportName);
  const source = reportInfoRaw && typeof reportInfoRaw === "object" ? reportInfoRaw : {};
  const fieldsRaw = Array.isArray(source.fields) ? source.fields : [];
  return {
    showLogoReport: toBooleanOrDefault(source.showLogoReport, defaults.showLogoReport),
    headerCaption: String(source.headerCaption ?? defaults.headerCaption).trim() || defaults.headerCaption,
    headerFontSize: Math.max(1, toNumberOrDefault(source.headerFontSize, defaults.headerFontSize)),
    headerFontColor: normalizeHexColorOrDefault(source.headerFontColor, defaults.headerFontColor),
    heightTabCaption: Math.max(
      1,
      toNumberOrDefault(source.heightTabCaption ?? source.headerHeight, defaults.heightTabCaption)
    ),
    backTabCaptionColor: normalizeHexColorOrDefault(
      source.backTabCaptionColor,
      defaults.backTabCaptionColor
    ),
    fontTabCaptionColor: normalizeHexColorOrDefault(
      source.fontTabCaptionColor,
      defaults.fontTabCaptionColor
    ),
    fontTabCaptionSize: Math.max(1, toNumberOrDefault(source.fontTabCaptionSize, defaults.fontTabCaptionSize)),
    startReportRow: Math.max(1, toNumberOrDefault(source.startReportRow, defaults.startReportRow)),
    startReportCol: Math.max(1, toNumberOrDefault(source.startReportCol, defaults.startReportCol)),
    filtrSet: toBooleanOrDefault(source.filtrSet, defaults.filtrSet),
    recordFontSize: Math.max(1, toNumberOrDefault(source.recordFontSize, defaults.recordFontSize)),
    fields: fieldsRaw.map((field, index) => normalizeReportTemplateField(field, index))
  };
};

const getSortedReportTemplateFieldDescriptorsBase = (fields) => {
  const withSourceIndex = (Array.isArray(fields) ? fields : []).map((field, sourceIndex) => ({
    field,
    sourceIndex
  }));
  withSourceIndex.sort((left, right) => {
    const leftVisible = isReportTemplateFieldVisible(left.field);
    const rightVisible = isReportTemplateFieldVisible(right.field);
    if (leftVisible !== rightVisible) {
      return leftVisible ? -1 : 1;
    }
    const leftOrder = Number(left.field?.fieldOrderNumber);
    const rightOrder = Number(right.field?.fieldOrderNumber);
    const leftHasOrder = Number.isFinite(leftOrder) && leftOrder > 0;
    const rightHasOrder = Number.isFinite(rightOrder) && rightOrder > 0;
    if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    if (leftHasOrder && !rightHasOrder) {
      return -1;
    }
    if (!leftHasOrder && rightHasOrder) {
      return 1;
    }
    return left.sourceIndex - right.sourceIndex;
  });
  return withSourceIndex;
};

const reconcileReportTemplateFieldsWithSqlColumns = (
  fieldsRaw,
  sqlColumnsRaw,
  { addMissing = false } = {}
) => {
  const sqlColumns = Array.isArray(sqlColumnsRaw)
    ? sqlColumnsRaw.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const dataColumns = sqlColumns.filter((value) => !/^LINK_/i.test(value));
  const linkColumns = sqlColumns.filter((value) => /^LINK_/i.test(value));
  const dataColumnSet = new Set(dataColumns);
  const linkColumnSet = new Set(linkColumns);
  const seenFieldNames = new Set();
  const normalized = (Array.isArray(fieldsRaw) ? fieldsRaw : []).map((field, index) =>
    normalizeReportTemplateField(field, index)
  );

  const nextFields = [];
  normalized.forEach((field) => {
    const fieldName = String(field?.fieldName ?? "").trim();
    if (!fieldName || !dataColumnSet.has(fieldName) || seenFieldNames.has(fieldName)) {
      return;
    }
    seenFieldNames.add(fieldName);
    const nextField = { ...field };
    const normalizedLink = String(nextField.fieldLink ?? "").trim();
    if (/^LINK_/i.test(normalizedLink) && !linkColumnSet.has(normalizedLink)) {
      nextField.fieldLink = "";
    }
    nextFields.push(nextField);
  });

  if (addMissing) {
    dataColumns.forEach((columnName) => {
      if (seenFieldNames.has(columnName)) {
        return;
      }
      seenFieldNames.add(columnName);
      nextFields.push(
        normalizeReportTemplateField(
          {
            fieldName: columnName,
            reportVisible: true,
            fieldCaption: columnName,
            fieldDataType: "text",
            fieldDataFormat: "",
            fieldVertAlign: "ВЕРХ",
            fieldHorizAlign: "СЛЕВА",
            fieldLink: "",
            filedWidth: "",
            fieldAutoWidth: true,
            fieldAutoTransfer: true,
            fieldBoldFont: false
          },
          nextFields.length
        )
      );
    });
  }

  const sortedDescriptors = getSortedReportTemplateFieldDescriptorsBase(nextFields);
  let visibleOrder = 0;
  sortedDescriptors.forEach(({ field, sourceIndex }) => {
    if (!isReportTemplateFieldVisible(field)) {
      nextFields[sourceIndex] = {
        ...nextFields[sourceIndex],
        fieldOrderNumber: ""
      };
      return;
    }
    visibleOrder += 1;
    nextFields[sourceIndex] = {
      ...nextFields[sourceIndex],
      fieldOrderNumber: String(visibleOrder)
    };
  });
  return {
    fields: nextFields,
    linkColumns
  };
};

const loadSqlColumnsForReportTemplate = async (reportTemplateId, executionPayload = {}) => {
  let response = await fetch(REPORT_TEMPLATE_SQL_RESULTS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(
      toCamelApiPayload({
        reportTemplateId,
        limit: 1,
        offset: 1,
        ...(executionPayload && typeof executionPayload === "object" ? executionPayload : {})
      })
    )
  });
  if (response.status === 404) {
    response = await fetch(REPORT_TEMPLATES_SQL_RESULTS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        toCamelApiPayload({
          reportTemplateId,
          limit: 1,
          offset: 1,
          ...(executionPayload && typeof executionPayload === "object" ? executionPayload : {})
        })
      )
    });
  }
  const data = await response.json();
  if (!response.ok) {
    const errorMessage = String(data?.error ?? "").trim();
    if (/сохраненн(ый|ого)\s+sql-скрипт\s+пуст/i.test(errorMessage)) {
      return [];
    }
    throw new Error(errorMessage || "Не удалось получить поля SQL-скрипта");
  }
  const columns = Array.isArray(data?.columns)
    ? data.columns.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  return columns;
};

const normalizeEmployeePositionItem = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const source = value;
  return {
    ...source,
    employeeOrganId: String(source.employeeOrganId ?? source.employee_organ_id ?? "").trim(),
    organUnitId: String(source.organUnitId ?? source.organ_unit_id ?? "").trim(),
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
    organUnitId: String(source.organUnitId ?? source.organ_unit_id ?? "").trim(),
    relationTypeId: String(source.relationTypeId ?? source.relation_type_id ?? "").trim(),
    salesOrganizationId: String(
      source.salesOrganizationId ??
        source.salesOrganUnitId ??
        source.sales_organization_id ??
        source.sales_organ_unit_id ??
        ""
    ).trim(),
    productGroupsId: String(
      source.productGroupsId ??
        source.productGroupId ??
        source.product_groups_id ??
        source.product_group_id ??
        ""
    ).trim(),
    employeeName: normalizeUiText(source.employeeName ?? source.employee_name),
    organName: normalizeUiText(source.organName ?? source.organ_name),
    organSapId: normalizeUiText(source.organSapId ?? source.organ_sap_id),
    organInn: normalizeUiText(source.organInn ?? source.organ_inn),
    organKpp: normalizeUiText(source.organKpp ?? source.organ_kpp),
    organOgrn: normalizeUiText(source.organOgrn ?? source.organ_ogrn),
    organFullAddress: normalizeUiText(source.organFullAddress ?? source.organ_full_address),
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
const REPORT_SETTINGS_DEFAULT_COLUMN_SETTINGS = REPORT_SETTINGS_COLUMNS.map((column) => ({
  key: column.key,
  visible: true,
  pin: "none"
}));
const ORGANIZATION_SORT_FIELDS = new Set(ORGANIZATION_COLUMNS.map((column) => column.sortField));
const RELATIONS_PAGE_SORT_FIELDS = new Set(RELATIONS_PAGE_COLUMNS.map((column) => column.sortField));
const REPORT_SETTINGS_SORT_FIELDS = new Set(REPORT_SETTINGS_COLUMNS.map((column) => column.sortField));

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
      organUnitTypeNames: Array.isArray(parsed.organUnitTypeNames)
        ? parsed.organUnitTypeNames.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [],
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

function parseStoredReportSettingsSortRules() {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(REPORT_SETTINGS_SORT_RULES_STORAGE_KEY);
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
        !REPORT_SETTINGS_SORT_FIELDS.has(field) ||
        !ALLOWED_SORT_DIRECTIONS.has(direction) ||
        seenFields.has(field)
      ) {
        continue;
      }
      normalized.push({ field, direction });
      seenFields.add(field);
    }
    return normalized;
  } catch {
    return [];
  }
}

function parseStoredReportSettingsFilters() {
  if (typeof window === "undefined") {
    return REPORT_SETTINGS_INITIAL_FILTERS;
  }

  const rawValue = window.localStorage.getItem(REPORT_SETTINGS_FILTERS_STORAGE_KEY);
  if (!rawValue) {
    return REPORT_SETTINGS_INITIAL_FILTERS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return REPORT_SETTINGS_INITIAL_FILTERS;
    }

    return {
      codeReport: String(parsed.codeReport ?? parsed.reportCode ?? ""),
      name: String(parsed.name ?? ""),
      version: String(parsed.version ?? ""),
      method: String(parsed.method ?? ""),
      outputFileName: String(parsed.outputFileName ?? ""),
      outputFileType: String(parsed.outputFileType ?? ""),
      status: String(parsed.status ?? "")
    };
  } catch {
    return REPORT_SETTINGS_INITIAL_FILTERS;
  }
}

function parseStoredReportSettingsColumnWidths() {
  if (typeof window === "undefined") {
    return REPORT_SETTINGS_DEFAULT_COLUMN_WIDTHS;
  }

  const rawValue = window.localStorage.getItem(REPORT_SETTINGS_COLUMN_WIDTHS_STORAGE_KEY);
  if (!rawValue) {
    return REPORT_SETTINGS_DEFAULT_COLUMN_WIDTHS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return REPORT_SETTINGS_DEFAULT_COLUMN_WIDTHS;
    }

    const normalized = { ...REPORT_SETTINGS_DEFAULT_COLUMN_WIDTHS };
    for (const key of Object.keys(REPORT_SETTINGS_DEFAULT_COLUMN_WIDTHS)) {
      const value = Number(parsed[key]);
      if (Number.isFinite(value) && value >= MIN_COLUMN_WIDTH) {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return REPORT_SETTINGS_DEFAULT_COLUMN_WIDTHS;
  }
}

function parseStoredReportSettingsColumnSettings() {
  if (typeof window === "undefined") {
    return REPORT_SETTINGS_DEFAULT_COLUMN_SETTINGS;
  }

  const rawValue = window.localStorage.getItem(REPORT_SETTINGS_COLUMN_SETTINGS_STORAGE_KEY);
  if (!rawValue) {
    return REPORT_SETTINGS_DEFAULT_COLUMN_SETTINGS;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return REPORT_SETTINGS_DEFAULT_COLUMN_SETTINGS;
    }

    const byKey = new Map();
    const normalized = [];
    for (const item of parsed) {
      const key = String(item?.key ?? "").trim();
      const visible = item?.visible !== false;
      const pin = item?.pin === "left" || item?.pin === "right" ? item.pin : "none";
      if (REPORT_SETTINGS_DEFAULT_COLUMN_WIDTHS[key] !== undefined && !byKey.has(key)) {
        const setting = { key, visible, pin };
        byKey.set(key, setting);
        normalized.push(setting);
      }
    }

    for (const column of REPORT_SETTINGS_COLUMNS) {
      if (!byKey.has(column.key)) {
        normalized.push({ key: column.key, visible: true, pin: "none" });
      }
    }

    return normalized.length > 0 ? normalized : REPORT_SETTINGS_DEFAULT_COLUMN_SETTINGS;
  } catch {
    return REPORT_SETTINGS_DEFAULT_COLUMN_SETTINGS;
  }
}

function parseStoredReportTemplateFieldsColumnWidths() {
  if (typeof window === "undefined") {
    return REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS;
  }
  const rawValue = window.localStorage.getItem(REPORT_TEMPLATE_FIELDS_COLUMN_WIDTHS_STORAGE_KEY);
  if (!rawValue) {
    return REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS;
  }
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS;
    }
    const normalized = { ...REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS };
    for (const key of Object.keys(REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS)) {
      const value = Number(parsed[key]);
      if (Number.isFinite(value) && value >= REPORT_TEMPLATE_FIELDS_MIN_COLUMN_WIDTH_PX) {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS;
  }
}

function parseStoredReportTemplateGeneralParameterColumnWidth() {
  if (typeof window === "undefined") {
    return REPORT_TEMPLATE_GENERAL_SETTINGS_DEFAULT_PARAMETER_COL_PX;
  }
  const rawValue = window.localStorage.getItem(
    REPORT_TEMPLATE_GENERAL_PARAMETER_COLUMN_WIDTH_STORAGE_KEY
  );
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < REPORT_TEMPLATE_GENERAL_SETTINGS_MIN_PARAMETER_COL_PX) {
    return REPORT_TEMPLATE_GENERAL_SETTINGS_DEFAULT_PARAMETER_COL_PX;
  }
  return parsed;
}

function parseStoredReportTemplateGeneralSortDirection() {
  if (typeof window === "undefined") {
    return REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.ASC;
  }
  const rawValue = String(
    window.localStorage.getItem(REPORT_TEMPLATE_GENERAL_SORT_DIRECTION_STORAGE_KEY) ?? ""
  )
    .trim()
    .toUpperCase();
  if (rawValue === REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.DESC) {
    return REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.DESC;
  }
  return REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.ASC;
}

function parseStoredReportTemplateLevelExpandedMap() {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const rawValue = window.localStorage.getItem(REPORT_TEMPLATE_LEVEL_EXPANDED_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseStoredDadataHiddenAttributes() {
  if (!IS_BROWSER) {
    return {};
  }
  try {
    const rawValue = window.localStorage.getItem(DADATA_HIDDEN_ATTRIBUTES_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (value === true) {
        out[String(key)] = true;
      }
    });
    return out;
  } catch {
    return {};
  }
}

function parseStoredDadataVisibleOnly() {
  if (!IS_BROWSER) {
    return true;
  }
  try {
    const rawValue = String(window.localStorage.getItem(DADATA_VISIBLE_ONLY_STORAGE_KEY) ?? "").trim();
    if (rawValue === "false") {
      return false;
    }
    if (rawValue === "true") {
      return true;
    }
    return true;
  } catch {
    return true;
  }
}

function normalizeDadataOrderKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function parseStoredDadataAttributeOrder() {
  if (!IS_BROWSER) {
    return { company: [], address: [] };
  }
  try {
    const rawValue = window.localStorage.getItem(DADATA_ATTRIBUTE_ORDER_STORAGE_KEY);
    if (!rawValue) {
      return { company: [], address: [] };
    }
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { company: [], address: [] };
    }
    const normalizeList = (value) =>
      (Array.isArray(value) ? value : [])
        .map((item) => normalizeDadataOrderKey(item))
        .filter(Boolean)
        .filter((item, index, source) => source.indexOf(item) === index);
    return {
      company: normalizeList(parsed.company),
      address: normalizeList(parsed.address)
    };
  } catch {
    return { company: [], address: [] };
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
      organUnitId: "",
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
      organUnitId: String(positions[0]?.organUnitId ?? positions[0]?.organ_unit_id ?? ""),
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
    organUnitId: "",
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

function formatDateByPatternForFileName(dateValue, rawPattern) {
  const date = dateValue instanceof Date && !Number.isNaN(dateValue.getTime()) ? dateValue : new Date();
  const pattern = String(rawPattern || "dd.MM.yyyy_HH-mm-ss").trim() || "dd.MM.yyyy_HH-mm-ss";
  const pad2 = (value) => String(Math.max(0, Number(value) || 0)).padStart(2, "0");
  return pattern
    .replace(/yyyy/g, String(date.getFullYear()))
    .replace(/MM/g, pad2(date.getMonth() + 1))
    .replace(/dd/g, pad2(date.getDate()))
    .replace(/HH/g, pad2(date.getHours()))
    .replace(/mm/g, pad2(date.getMinutes()))
    .replace(/ss/g, pad2(date.getSeconds()));
}

function resolveExportFileNameTemplate(fileNameTemplate, reportName) {
  const rawTemplate = String(fileNameTemplate || "").trim();
  if (!rawTemplate) {
    return "";
  }
  const safeReportName = String(reportName || "").trim() || "report";
  const now = new Date();
  let resolved = rawTemplate
    .replace(/\{reportName\}/g, safeReportName)
    .replace(/\{REPORT_NAME\}/g, safeReportName)
    .replace(/\{now(?::([^{}]+))?\}/gi, (_, rawPattern) =>
      formatDateByPatternForFileName(now, String(rawPattern || "dd.MM.yyyy_HH-mm-ss"))
    );
  resolved = resolved.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return resolved;
}

function stripExpectedExtension(fileNameValue, extensionValue) {
  const fileName = String(fileNameValue || "").trim();
  const extension = String(extensionValue || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (!fileName || !extension) {
    return fileName;
  }
  const suffix = `.${extension}`;
  if (fileName.toLowerCase().endsWith(suffix)) {
    return fileName.slice(0, fileName.length - suffix.length).trim();
  }
  return fileName;
}

const ReportSqlResultsContent = ({
  isLoading,
  error,
  columns,
  rows,
  getSortDirectionForField,
  getSortOrderForField,
  onSortClick,
  formatCellValue
}) => {
  if (isLoading) {
    return (
      <div className="report-sql-results-loader">
        <div
          className="report-sql-execution-loader"
          aria-label="Идет выполнение SQL-скрипта"
        />
        <p>Выполняется SQL-скрипт...</p>
      </div>
    );
  }
  if (error) {
    return <div className="report-sql-results-empty-state">{error}</div>;
  }
  if (columns.length === 0) {
    return <div className="report-sql-results-empty-state">Результаты не найдены</div>;
  }
  return (
    <table className="report-sql-results-table">
      <thead>
        <tr>
          <th className="report-sql-results-row-number-header">№</th>
          {columns.map((columnName) => (
            <th key={columnName}>
              <button
                type="button"
                className={`column-sort-button${
                  getSortDirectionForField(columnName) ? " active" : ""
                }`}
                onClick={() => onSortClick(columnName)}
              >
                <span>{columnName}</span>
                {getSortDirectionForField(columnName) && (
                  <span className="sort-icon-group">
                    <span className="sort-icon">
                      {getSortDirectionForField(columnName) === "ASC" ? "▲" : "▼"}
                    </span>
                    {getSortOrderForField(columnName) && (
                      <span className="sort-order-index">
                        {getSortOrderForField(columnName)}
                      </span>
                    )}
                  </span>
                )}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`report-sql-row-${rowIndex}`}>
            <td className="report-sql-results-row-number-cell">{rowIndex + 1}</td>
            {columns.map((columnName) => (
              <td key={`report-sql-cell-${rowIndex}-${columnName}`}>
                {formatCellValue(row?.[columnName])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const MemoizedReportSqlResultsContent = memo(ReportSqlResultsContent);

function App() {
  const initialPageId = getPageIdFromUrl();
  const EMPLOYEE_CARD_TABS = {
    MAIN: "main",
    RELATIONS: "relations"
  };
  const ORGANIZATION_CARD_TABS = {
    MAIN: "main",
    DADATA: "dadata"
  };
const REPORT_SQL_BASE_FONT_SIZE_PX = 13;
const REPORT_SQL_EDITOR_PADDING_PX = 12;
const REPORT_SQL_EDITOR_LINE_HEIGHT_PX = 18;
  const REPORT_SQL_VIEW_MODES = {
    EDITOR: "editor",
    RESULTS: "results"
  };
  const REPORT_CARD_TABS = {
    MAIN: "main",
    SQL: "sql",
    TEMPLATE: "template",
    PREVIEW: "preview"
  };
  const REPORT_TEMPLATE_VIEW_MODES = {
    SETTINGS: "settings",
    JSON: "json"
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
    const weekdayRaw = now.toLocaleDateString("ru-RU", {
      weekday: "long"
    });
    const weekday =
      typeof weekdayRaw === "string" && weekdayRaw.length > 0
        ? `${weekdayRaw.slice(0, 1).toUpperCase()}${weekdayRaw.slice(1)}`
        : "";

    return { time, date, weekday };
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
  const [isReportBuilderExpanded, setIsReportBuilderExpanded] = useState(true);
  const [activePage, setActivePage] = useState(initialPageId);
  const [activePrintFormsTab, setActivePrintFormsTab] = useState(PRINT_FORMS_TABS.LIST);
  const [printFormsLoading, setPrintFormsLoading] = useState(false);
  const [printFormsError, setPrintFormsError] = useState("");
  const [printFormsItems, setPrintFormsItems] = useState([]);
  const [printFormsRefreshToken, setPrintFormsRefreshToken] = useState(0);
  const [printFormName, setPrintFormName] = useState("");
  const [printFormCode, setPrintFormCode] = useState("");
  const [printFormDescription, setPrintFormDescription] = useState("");
  const [printFormDataSql, setPrintFormDataSql] = useState("select 1 as sample_value");
  const [printFormFieldMappingText, setPrintFormFieldMappingText] = useState(
    `[
  { "sourceField": "sample_value", "page": 1, "x": 80, "y": 720, "fontSize": 12 }
]`
  );
  const [printFormOverlaySettingsText, setPrintFormOverlaySettingsText] = useState(
    `{
  "enabled": true,
  "text": "Черновик",
  "page": "ALL",
  "x": 40,
  "y": 24,
  "fontSize": 10,
  "opacity": 0.35,
  "color": "#6b7280"
}`
  );
  const [printFormPdfName, setPrintFormPdfName] = useState("");
  const [printFormPdfBase64, setPrintFormPdfBase64] = useState("");
  const [isPrintFormSaving, setIsPrintFormSaving] = useState(false);
  const [isPrintFormRecognizing, setIsPrintFormRecognizing] = useState(false);
  const [printFormDetectedFields, setPrintFormDetectedFields] = useState([]);
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
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window === "undefined") {
      return 20;
    }

    const stored = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return ALLOWED_PAGE_SIZES.has(stored) ? stored : 20;
  });
  const [totalCount, setTotalCount] = useState(0);
  const [employeesListRefreshToken, setEmployeesListRefreshToken] = useState(0);
  const [sortRules, setSortRules] = useState(() => {
    if (initialPageId === PAGE_IDS.ORGANIZATIONS) {
      return parseStoredOrganizationSortRules();
    }
    if (initialPageId === PAGE_IDS.EMPLOYEE_RELATIONS) {
      return parseStoredRelationsPageSortRules();
    }
    if (initialPageId === PAGE_IDS.REPORT_SETTINGS) {
      return parseStoredReportSettingsSortRules();
    }
    return parseStoredSortRules();
  });
  const [filters, setFilters] = useState(() => {
    if (initialPageId === PAGE_IDS.ORGANIZATIONS) {
      return parseStoredOrganizationFilters();
    }
    if (initialPageId === PAGE_IDS.EMPLOYEE_RELATIONS) {
      return parseStoredRelationsPageFilters();
    }
    if (initialPageId === PAGE_IDS.REPORT_SETTINGS) {
      return parseStoredReportSettingsFilters();
    }
    return parseStoredFilters();
  });
  const [debouncedEmployeeFilters, setDebouncedEmployeeFilters] = useState(() =>
    initialPageId === PAGE_IDS.EMPLOYEES ? parseStoredFilters() : INITIAL_FILTERS
  );
  const [debouncedOrganizationFilters, setDebouncedOrganizationFilters] = useState(() =>
    initialPageId === PAGE_IDS.ORGANIZATIONS
      ? parseStoredOrganizationFilters()
      : ORGANIZATION_INITIAL_FILTERS
  );
  const [debouncedRelationsPageFilters, setDebouncedRelationsPageFilters] = useState(() =>
    initialPageId === PAGE_IDS.EMPLOYEE_RELATIONS
      ? parseStoredRelationsPageFilters()
      : RELATIONS_PAGE_INITIAL_FILTERS
  );
  const [debouncedReportSettingsFilters, setDebouncedReportSettingsFilters] = useState(() =>
    initialPageId === PAGE_IDS.REPORT_SETTINGS
      ? parseStoredReportSettingsFilters()
      : REPORT_SETTINGS_INITIAL_FILTERS
  );
  const [columnWidths, setColumnWidths] = useState(() => {
    if (initialPageId === PAGE_IDS.ORGANIZATIONS) {
      return parseStoredOrganizationColumnWidths();
    }
    if (initialPageId === PAGE_IDS.EMPLOYEE_RELATIONS) {
      return parseStoredRelationsPageColumnWidths();
    }
    if (initialPageId === PAGE_IDS.REPORT_SETTINGS) {
      return parseStoredReportSettingsColumnWidths();
    }
    return parseStoredColumnWidths();
  });
  const [columnSettings, setColumnSettings] = useState(() => {
    if (initialPageId === PAGE_IDS.ORGANIZATIONS) {
      return parseStoredOrganizationColumnSettings();
    }
    if (initialPageId === PAGE_IDS.EMPLOYEE_RELATIONS) {
      return parseStoredRelationsPageColumnSettings();
    }
    if (initialPageId === PAGE_IDS.REPORT_SETTINGS) {
      return parseStoredReportSettingsColumnSettings();
    }
    return parseStoredColumnSettings();
  });
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployeeSnapshot, setSelectedEmployeeSnapshot] = useState(null);
  const [isEmployeeCardPanelOpen, setIsEmployeeCardPanelOpen] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedOrganizationSnapshot, setSelectedOrganizationSnapshot] = useState(null);
  const [isOrganizationCardPanelOpen, setIsOrganizationCardPanelOpen] = useState(false);
  const [activeOrganizationCardTab, setActiveOrganizationCardTab] = useState(ORGANIZATION_CARD_TABS.MAIN);
  const [isOrganizationCardEditMode, setIsOrganizationCardEditMode] = useState(false);
  const [isOrganizationDadataRefreshing, setIsOrganizationDadataRefreshing] = useState(false);
  const [dadataHiddenAttributes, setDadataHiddenAttributes] = useState(() =>
    parseStoredDadataHiddenAttributes()
  );
  const [isDadataVisibleOnlyEnabled, setIsDadataVisibleOnlyEnabled] = useState(() =>
    parseStoredDadataVisibleOnly()
  );
  const [dadataAttributeOrderMap, setDadataAttributeOrderMap] = useState(() =>
    parseStoredDadataAttributeOrder()
  );
  const [dadataDraggingRowKey, setDadataDraggingRowKey] = useState("");
  const [selectedDadataRowBySection, setSelectedDadataRowBySection] = useState({
    company: "",
    address: ""
  });
  const [organizationDadataCollapsedSections, setOrganizationDadataCollapsedSections] = useState({
    company: false,
    address: false
  });
  const [organizationCardEditForm, setOrganizationCardEditForm] = useState(
    INITIAL_ORGANIZATION_CARD_EDIT_FORM
  );
  const [activeOrganizationEditCombo, setActiveOrganizationEditCombo] = useState(null);
  const [organizationTypeEditFilter, setOrganizationTypeEditFilter] = useState("");
  const [countryEditFilter, setCountryEditFilter] = useState("");
  const [selectedReportTemplateId, setSelectedReportTemplateId] = useState("");
  const [selectedReportSnapshot, setSelectedReportSnapshot] = useState(null);
  const [isReportCardPanelOpen, setIsReportCardPanelOpen] = useState(false);
  const [isReportCardTransitioning, setIsReportCardTransitioning] = useState(false);
  const [isEmployeeCardTransitioning, setIsEmployeeCardTransitioning] = useState(false);
  const [isCreatingReportCard, setIsCreatingReportCard] = useState(false);
  const [isReportMainSettingsEditMode, setIsReportMainSettingsEditMode] = useState(false);
  const [isReportMainSettingsSaving, setIsReportMainSettingsSaving] = useState(false);
  const [isReportDeleting, setIsReportDeleting] = useState(false);
  const [pendingReportDelete, setPendingReportDelete] = useState(null);
  const [reportMainSettingsDraft, setReportMainSettingsDraft] = useState(
    INITIAL_REPORT_MAIN_SETTINGS_DRAFT
  );
  const [activeReportCardTab, setActiveReportCardTab] = useState(REPORT_CARD_TABS.MAIN);
  const [reportSqlViewMode, setReportSqlViewMode] = useState(REPORT_SQL_VIEW_MODES.EDITOR);
  const [isReportSqlEditMode, setIsReportSqlEditMode] = useState(false);
  const [reportSqlDraft, setReportSqlDraft] = useState("");
  const [reportSqlZoom, setReportSqlZoom] = useState(1);
  const [, setReportSqlValidationState] = useState("idle");
  const [, setReportSqlErrorDetails] = useState("");
  const [isReportSqlResultsLoading, setIsReportSqlResultsLoading] = useState(false);
  const [isReportSqlResultsLoadingMore, setIsReportSqlResultsLoadingMore] = useState(false);
  const [reportSqlResultsColumns, setReportSqlResultsColumns] = useState([]);
  const [reportSqlResultsRows, setReportSqlResultsRows] = useState([]);
  const [reportSqlResultsPage, setReportSqlResultsPage] = useState(1);
  const [reportSqlResultsHasMore, setReportSqlResultsHasMore] = useState(false);
  const [reportSqlResultsError, setReportSqlResultsError] = useState("");
  const [reportSqlResultsSortRules, setReportSqlResultsSortRules] = useState([]);
  const [reportSqlResultsStats, setReportSqlResultsStats] = useState({
    executionTime: "00:00:000",
    executionMs: 0,
    selectedRows: 0
  });
  const [isReportPreviewLoading, setIsReportPreviewLoading] = useState(false);
  const [reportPreviewError, setReportPreviewError] = useState("");
  const [reportPreviewSheetRows, setReportPreviewSheetRows] = useState([]);
  const [reportPreviewSheetMeta, setReportPreviewSheetMeta] = useState({
    rangeStartCol: 0,
    dataRowStartRelative: Number.MAX_SAFE_INTEGER,
    columnAlignByAbsoluteCol: {}
  });
  const [reportPreviewStats, setReportPreviewStats] = useState({
    executionTime: "00:00:000",
    executionMs: 0,
    selectedRows: 0,
    queryExecutionMs: 0,
    templateFillMs: 0
  });
  const [isReportTemplateSettingsLoading, setIsReportTemplateSettingsLoading] = useState(false);
  const [hasReportTemplateContentLoaded, setHasReportTemplateContentLoaded] = useState(false);
  const [isReportTemplateSettingsSaving, setIsReportTemplateSettingsSaving] = useState(false);
  const [isReportTemplateSqlSyncing, setIsReportTemplateSqlSyncing] = useState(false);
  const [isReportTemplateEditMode, setIsReportTemplateEditMode] = useState(false);
  const [reportTemplateViewMode, setReportTemplateViewMode] = useState(REPORT_TEMPLATE_VIEW_MODES.SETTINGS);
  const [isReportTemplateJsonEditMode, setIsReportTemplateJsonEditMode] = useState(false);
  const [reportTemplateJsonInitial, setReportTemplateJsonInitial] = useState("{}");
  const [reportTemplateJsonDraft, setReportTemplateJsonDraft] = useState("{}");
  const [reportTemplateJsonZoom, setReportTemplateJsonZoom] = useState(1);
  const [reportTemplateJsonActiveLine, setReportTemplateJsonActiveLine] = useState(1);
  const [reportTemplateJsonEditorScrollTop, setReportTemplateJsonEditorScrollTop] = useState(0);
  const [isReportTemplateLevelTwoExpanded, setIsReportTemplateLevelTwoExpanded] = useState(false);
  const [isReportTemplateLevelThreeExpanded, setIsReportTemplateLevelThreeExpanded] = useState(false);
  const [deletingReportOrganizationId, setDeletingReportOrganizationId] = useState("");
  const [deletingReportAccessGroupCode, setDeletingReportAccessGroupCode] = useState("");
  const [deletingReportRecipientEmail, setDeletingReportRecipientEmail] = useState("");
  const [addingReportOrganization, setAddingReportOrganization] = useState(false);
  const [addingReportAccessGroup, setAddingReportAccessGroup] = useState(false);
  const [addingReportRecipient, setAddingReportRecipient] = useState(false);
  const [isReportOrganizationAddMode, setIsReportOrganizationAddMode] = useState(false);
  const [isReportOrganizationComboOpen, setIsReportOrganizationComboOpen] = useState(false);
  const [isReportAccessGroupAddMode, setIsReportAccessGroupAddMode] = useState(false);
  const [isReportRecipientAddMode, setIsReportRecipientAddMode] = useState(false);
  const [reportOrganizationSearch, setReportOrganizationSearch] = useState("");
  const [reportOrganizationOptions, setReportOrganizationOptions] = useState([]);
  const [selectedReportOrganizationIdForAdd, setSelectedReportOrganizationIdForAdd] = useState("");
  const [newReportAccessGroupCode, setNewReportAccessGroupCode] = useState(REPORT_ACCESS_GROUP_ENUM[0]);
  const [newReportRecipientEmail, setNewReportRecipientEmail] = useState("");
  const [reportTemplateSettingsInitial, setReportTemplateSettingsInitial] = useState(() =>
    buildDefaultReportTemplateSettings("")
  );
  const [reportTemplateSettingsDraft, setReportTemplateSettingsDraft] = useState(() =>
    buildDefaultReportTemplateSettings("")
  );
  const [reportTemplateLogoBase64, setReportTemplateLogoBase64] = useState(null);
  const [reportTemplateLogoMimeType, setReportTemplateLogoMimeType] = useState(null);
  const [reportTemplateLogoInitialBase64, setReportTemplateLogoInitialBase64] = useState(null);
  const [reportTemplateLogoInitialMimeType, setReportTemplateLogoInitialMimeType] = useState(null);
  const [reportTemplateLinkFieldOptions, setReportTemplateLinkFieldOptions] = useState([]);
  const [reportTemplateFieldsColumnWidths, setReportTemplateFieldsColumnWidths] = useState(
    parseStoredReportTemplateFieldsColumnWidths()
  );
  const [reportTemplateGeneralSettingsSortDirection, setReportTemplateGeneralSettingsSortDirection] = useState(
    parseStoredReportTemplateGeneralSortDirection()
  );
  const [reportTemplateGeneralParameterColumnWidth, setReportTemplateGeneralParameterColumnWidth] = useState(
    parseStoredReportTemplateGeneralParameterColumnWidth()
  );
  const [reportSqlActiveLine, setReportSqlActiveLine] = useState(1);
  const [reportSqlCaretInfo, setReportSqlCaretInfo] = useState({
    line: 1,
    column: 1,
    position: 1
  });
  const [reportSqlEditorScrollTop, setReportSqlEditorScrollTop] = useState(0);
  const [isCreatingEmployeeCard, setIsCreatingEmployeeCard] = useState(false);
  const [employeeCardEditForm, setEmployeeCardEditForm] = useState(INITIAL_EMPLOYEE_CARD_EDIT_FORM);
  const [linkedEmployeeIdFilter, setLinkedEmployeeIdFilter] = useState(() =>
    initialPageId === PAGE_IDS.EMPLOYEES ? getEmployeeIdFromUrl() : ""
  );
  const [isLinkedEmployeeLookupActive, setIsLinkedEmployeeLookupActive] = useState(
    () => initialPageId === PAGE_IDS.EMPLOYEES && Boolean(getEmployeeIdFromUrl())
  );
  const [hasLinkedEmployeeLookupAttempt, setHasLinkedEmployeeLookupAttempt] = useState(false);
  const [linkedOrganizationIdFilter, setLinkedOrganizationIdFilter] = useState(() =>
    initialPageId === PAGE_IDS.ORGANIZATIONS ? getOrganizationIdFromUrl() : ""
  );
  const [isLinkedOrganizationLookupActive, setIsLinkedOrganizationLookupActive] = useState(
    () => initialPageId === PAGE_IDS.ORGANIZATIONS && Boolean(getOrganizationIdFromUrl())
  );
  const [hasLinkedOrganizationLookupAttempt, setHasLinkedOrganizationLookupAttempt] = useState(false);
  const [activeEmployeeCardTab, setActiveEmployeeCardTab] = useState(EMPLOYEE_CARD_TABS.MAIN);
  const [isEmployeeCardEditMode, setIsEmployeeCardEditMode] = useState(false);
  const [employeeRelations, setEmployeeRelations] = useState([]);
  const [employeeRelationsLoading, setEmployeeRelationsLoading] = useState(false);
  const [employeeRelationsError, setEmployeeRelationsError] = useState("");
  const [systemErrorToast, setSystemErrorToast] = useState({ id: 0, message: "", type: "error" });
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
  const [pendingOrganizationDelete, setPendingOrganizationDelete] = useState(null);
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
        message: normalizedMessage,
        type: "error"
      };
    });
    setIsSystemErrorToastClosing(false);
  }, []);
  const showSystemSuccessToast = useCallback((message) => {
    const normalizedMessage = String(message ?? "").trim();
    if (!normalizedMessage) {
      return;
    }
    setSystemErrorToast((prev) => {
      return {
        id: Number(prev?.id ?? 0) + 1,
        message: normalizedMessage,
        type: "success"
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
  const getOrganizationCardEditFormFromOrganization = useCallback((organization) => {
    const signResidentRaw = String(organization?.signResident ?? organization?.sign_resident ?? "")
      .trim()
      .toUpperCase();
    const signResident = signResidentRaw === "ДА" ? "ДА" : "НЕТ";
    const fastTrackRaw = String(organization?.fastTrack ?? organization?.fast_track ?? "")
      .trim()
      .toUpperCase();
    const fastTrack = fastTrackRaw === "ДА" ? "ДА" : fastTrackRaw === "НЕТ" ? "НЕТ" : "";
    const sourceTypes = Array.isArray(organization?.organUnitTypes)
      ? organization.organUnitTypes
      : Array.isArray(organization?.organ_unit_types)
        ? organization.organ_unit_types
        : [];
    const typeIds = sourceTypes
      .map((item) => String(item?.organUnitTypeId ?? item?.organ_unit_type_id ?? "").trim())
      .filter(Boolean);
    return {
      sapId: String(organization?.sapId ?? organization?.sap_id ?? "").trim(),
      inn: String(organization?.inn ?? "").trim(),
      kpp: String(organization?.kpp ?? "").trim(),
      name: String(organization?.name ?? "").trim(),
      shName: String(organization?.shName ?? organization?.sh_name ?? "").trim(),
      ogrn: String(organization?.ogrn ?? "").trim(),
      okpo: String(organization?.okpo ?? "").trim(),
      shortCode: String(organization?.shortCode ?? organization?.short_code ?? "").trim(),
      signResident,
      countryId: String(organization?.countryId ?? organization?.country_id ?? "").trim(),
      organUnitTypeIds: typeIds,
      address: String(organization?.address ?? "").trim(),
      kcehNumber: String(organization?.kcehNumber ?? organization?.kceh_number ?? "").trim(),
      claimPrefix: String(organization?.claimPrefix ?? organization?.claim_prefix ?? "").trim(),
      fastTrack
    };
  }, []);
  const [isAddingEmployeePosition, setIsAddingEmployeePosition] = useState(false);
  const [editingEmployeePositionId, setEditingEmployeePositionId] = useState("");
  const [newEmployeePositionForm, setNewEmployeePositionForm] = useState(INITIAL_NEW_POSITION_FORM);
  const [positionOrganizationOptions, setPositionOrganizationOptions] = useState([]);
  const [positionTitleOptions, setPositionTitleOptions] = useState([]);
  const [positionEmployeeOptions, setPositionEmployeeOptions] = useState([]);
  const [relationEmployeeOptions, setRelationEmployeeOptions] = useState([]);
  const [organizationUnitTypeOptions, setOrganizationUnitTypeOptions] = useState([]);
  const [organizationUnitTypeCatalog, setOrganizationUnitTypeCatalog] = useState([]);
  const [countryOptions, setCountryOptions] = useState([]);
  const [isOrganizationTypeFilterOpen, setIsOrganizationTypeFilterOpen] = useState(false);
  const [activeNewPositionCombo, setActiveNewPositionCombo] = useState(null);
  const [positionComboMenuLayouts, setPositionComboMenuLayouts] = useState({});
  const [organizationEditComboMenuLayouts, setOrganizationEditComboMenuLayouts] = useState({});
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
  const organizationEditComboInputRefs = useRef({});
  const reportOrganizationComboRef = useRef(null);
  const reportSqlEditorRef = useRef(null);
  const reportSqlGutterRef = useRef(null);
  const reportSqlHighlightRef = useRef(null);
  const reportSqlResultsWrapperRef = useRef(null);
  const reportTemplateGeneralSettingsTableWrapperRef = useRef(null);
  const reportTemplateGeneralSettingsResizeRef = useRef(null);
  const reportTemplateFieldsTableWrapperRef = useRef(null);
  const reportTemplateFieldsResizeRef = useRef(null);
  const reportTemplateFieldsDragSourceRef = useRef(null);
  const reportTemplateFieldsDragImageRef = useRef(null);
  const reportTemplateFieldsDragAutoScrollStateRef = useRef({
    rafId: 0,
    wrapper: null,
    direction: 0,
    speed: 0
  });
  const reportTemplateJsonTextareaRef = useRef(null);
  const reportTemplateJsonCaretRafRef = useRef(0);
  const reportTemplateJsonFileInputRef = useRef(null);
  const reportCardTransitionTimeoutRef = useRef(0);
  const employeeCardTransitionTimeoutRef = useRef(0);
  const employeeCardCloseCleanupTimeoutRef = useRef(0);
  const employeeListSnapshotRef = useRef(null);
  const reportSettingsListSnapshotRef = useRef(null);
  const reportTemplateSettingsLoadedForIdRef = useRef("");
  const reportSqlResultsRequestRef = useRef(0);
  const selectedOrganizationRowRef = useRef(null);
  const pageJumpInputRef = useRef(null);
  const reportSqlResultsLastScrollTopRef = useRef(0);
  const lastAutoValidatedReportSqlRef = useRef("");
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
  useEffect(
    () => () => {
      if (reportTemplateJsonCaretRafRef.current) {
        cancelAnimationFrame(reportTemplateJsonCaretRafRef.current);
      }
    },
    []
  );
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
  const organizationDadataAutoRefreshAttemptedRef = useRef(new Set());
  const organizationDadataCompanyTableWrapperRef = useRef(null);
  const organizationDadataAddressTableWrapperRef = useRef(null);
  const dadataDragAutoScrollStateRef = useRef({
    rafId: 0,
    wrapper: null,
    direction: 0,
    speed: 0
  });
  const dadataDraggingSectionRef = useRef("");
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
  const buttonTooltipElementRef = useRef(null);
  const buttonTooltipVisibleRef = useRef(false);
  const buttonTooltipMoveRafRef = useRef(0);
  const buttonTooltipPendingPositionRef = useRef({ x: 0, y: 0 });
  const [nowDisplay, setNowDisplay] = useState(() => formatNow());
  const currentPageTitle = PAGE_TITLES[activePage] ?? PAGE_TITLES[PAGE_IDS.EMPLOYEES];
  const isEmployeesPage = activePage === PAGE_IDS.EMPLOYEES;
  const isOrganizationsPage = activePage === PAGE_IDS.ORGANIZATIONS;
  const isEmployeeRelationsPage = activePage === PAGE_IDS.EMPLOYEE_RELATIONS;
  const isReportSettingsPage = activePage === PAGE_IDS.REPORT_SETTINGS;
  const isEmployeeOrganizationPage = isEmployeesPage || isOrganizationsPage;
  const isPrintFormsPage = activePage === PAGE_IDS.PRINT_FORMS;
  const isMainGridCellTooltipEnabled = !isOrganizationsPage;

  const scheduleButtonTooltipPositionUpdate = useCallback((clientX, clientY) => {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }
    buttonTooltipPendingPositionRef.current = {
      x: clientX + 12,
      y: clientY + 12
    };
    if (buttonTooltipMoveRafRef.current) {
      return;
    }
    buttonTooltipMoveRafRef.current = requestAnimationFrame(() => {
      buttonTooltipMoveRafRef.current = 0;
      const tooltipElement = buttonTooltipElementRef.current;
      if (!(tooltipElement instanceof HTMLElement)) {
        return;
      }
      const nextPosition = buttonTooltipPendingPositionRef.current;
      tooltipElement.style.left = `${nextPosition.x}px`;
      tooltipElement.style.top = `${nextPosition.y}px`;
    });
  }, []);
  const isListPage =
    isEmployeesPage || isOrganizationsPage || isEmployeeRelationsPage || isReportSettingsPage;
  const tableColumns = isEmployeesPage
    ? ALL_COLUMNS
    : isOrganizationsPage
      ? ORGANIZATION_COLUMNS
      : isEmployeeRelationsPage
        ? RELATIONS_PAGE_COLUMNS
        : REPORT_SETTINGS_COLUMNS;
  const initialFiltersForPage = isEmployeesPage
    ? INITIAL_FILTERS
    : isOrganizationsPage
      ? ORGANIZATION_INITIAL_FILTERS
      : isEmployeeRelationsPage
        ? RELATIONS_PAGE_INITIAL_FILTERS
        : REPORT_SETTINGS_INITIAL_FILTERS;
  const defaultColumnSettingsForPage = isEmployeesPage
    ? DEFAULT_COLUMN_SETTINGS
    : isOrganizationsPage
      ? ORGANIZATION_DEFAULT_COLUMN_SETTINGS
      : isEmployeeRelationsPage
        ? RELATIONS_PAGE_DEFAULT_COLUMN_SETTINGS
        : REPORT_SETTINGS_DEFAULT_COLUMN_SETTINGS;
  const defaultColumnWidthsForPage = isEmployeesPage
    ? DEFAULT_COLUMN_WIDTHS
    : isOrganizationsPage
      ? ORGANIZATION_DEFAULT_COLUMN_WIDTHS
      : isEmployeeRelationsPage
        ? RELATIONS_PAGE_DEFAULT_COLUMN_WIDTHS
        : REPORT_SETTINGS_DEFAULT_COLUMN_WIDTHS;
  const activeApiUrl = isEmployeesPage
    ? EMPLOYEES_API_URL
    : isOrganizationsPage
      ? ORGANIZATIONS_API_URL
      : isEmployeeRelationsPage
        ? RELATIONS_API_URL
        : REPORT_TEMPLATES_API_URL;
  const activeListErrorMessage = isEmployeesPage
    ? "Не удалось получить список сотрудников"
    : isOrganizationsPage
      ? "Не удалось получить список организаций"
      : isEmployeeRelationsPage
        ? "Не удалось получить список связей сотрудников"
        : "Не удалось получить список настроек отчетов";
  const selectedEmployeeFromList = isEmployeesPage
    ? employees.find(
        (row) => String(row?.id ?? row?.employeeId ?? "").trim() === String(selectedEmployeeId).trim()
      ) ?? null
    : null;
  const selectedOrganizationFromList = isOrganizationsPage
    ? employees.find(
        (row) =>
          String(row?.organUnitId ?? row?.organ_unit_id ?? row?.id ?? "").trim() ===
          String(selectedOrganizationId).trim()
      ) ?? null
    : null;
  const selectedReportFromList = isReportSettingsPage
    ? employees.find(
        (row) =>
          String(row?.reportTemplateId ?? "").trim() === String(selectedReportTemplateId).trim()
      ) ?? null
    : null;
  const selectedEmployee =
    selectedEmployeeFromList ??
    (String(selectedEmployeeSnapshot?.id ?? selectedEmployeeSnapshot?.employeeId ?? "").trim() ===
    String(selectedEmployeeId).trim()
      ? selectedEmployeeSnapshot
      : null);
  const selectedReport =
    selectedReportFromList ??
    (String(selectedReportSnapshot?.reportTemplateId ?? "").trim() ===
    String(selectedReportTemplateId).trim()
      ? selectedReportSnapshot
      : null);
  const selectedOrganization = (() => {
    const organizationId = String(selectedOrganizationId ?? "").trim();
    const snapshotMatchesId =
      String(selectedOrganizationSnapshot?.organUnitId ?? selectedOrganizationSnapshot?.organ_unit_id ?? "").trim() ===
      organizationId;
    if (selectedOrganizationFromList && snapshotMatchesId) {
      return {
        ...selectedOrganizationFromList,
        ...selectedOrganizationSnapshot
      };
    }
    if (selectedOrganizationFromList) {
      return selectedOrganizationFromList;
    }
    return snapshotMatchesId ? selectedOrganizationSnapshot : null;
  })();
  const isSelectedOrganizationResident = useMemo(() => {
    const rawResident = selectedOrganization?.signResident ?? selectedOrganization?.sign_resident;
    if (typeof rawResident === "boolean") {
      return rawResident;
    }
    const normalizedResident = String(rawResident ?? "")
      .trim()
      .toUpperCase();
    if (normalizedResident === "НЕТ" || normalizedResident === "FALSE" || normalizedResident === "0") {
      return false;
    }
    if (normalizedResident === "ДА" || normalizedResident === "TRUE" || normalizedResident === "1") {
      return true;
    }
    return true;
  }, [selectedOrganization?.signResident, selectedOrganization?.sign_resident]);
  const isSelectedOrganizationResidentForAutoRefresh = useMemo(() => {
    const rawResident = selectedOrganization?.signResident ?? selectedOrganization?.sign_resident;
    if (typeof rawResident === "boolean") {
      return rawResident;
    }
    const normalizedResident = String(rawResident ?? "")
      .trim()
      .toUpperCase();
    return normalizedResident === "ДА" || normalizedResident === "TRUE" || normalizedResident === "1";
  }, [selectedOrganization?.signResident, selectedOrganization?.sign_resident]);
  const selectedOrganizationDataInfo = useMemo(() => {
    const rawDataInfo = selectedOrganization?.dataInfo ?? selectedOrganization?.data_info;
    if (!rawDataInfo) {
      return {};
    }
    if (typeof rawDataInfo === "string") {
      try {
        const parsed = JSON.parse(rawDataInfo);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    if (typeof rawDataInfo === "object" && !Array.isArray(rawDataInfo)) {
      return rawDataInfo;
    }
    return {};
  }, [selectedOrganization?.dataInfo, selectedOrganization?.data_info]);
  const toSnakeCaseDadataKey = useCallback((key) => {
    return String(key ?? "")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase();
  }, []);
  const areDadataValuesEqual = useCallback((left, right) => {
    if (left === right) {
      return true;
    }
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }, []);
  const normalizeDadataDisplayValue = useCallback(
    (value) => {
      if (Array.isArray(value)) {
        return value.map((item) => normalizeDadataDisplayValue(item));
      }
      if (!value || typeof value !== "object") {
        return value;
      }
      const out = {};
      Object.entries(value).forEach(([rawKey, rawValue]) => {
        out[rawKey] = normalizeDadataDisplayValue(rawValue);
      });
      Object.keys(out).forEach((rawKey) => {
        const key = String(rawKey ?? "");
        const snakeKey = toSnakeCaseDadataKey(key);
        const looksCamelCase = key !== snakeKey && !key.includes("_");
        if (!looksCamelCase) {
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(out, snakeKey)) {
          return;
        }
        if (areDadataValuesEqual(out[key], out[snakeKey])) {
          delete out[key];
        }
      });
      return out;
    },
    [areDadataValuesEqual, toSnakeCaseDadataKey]
  );
  const selectedOrganizationDataInfoForDisplay = useMemo(() => {
    return normalizeDadataDisplayValue(selectedOrganizationDataInfo);
  }, [normalizeDadataDisplayValue, selectedOrganizationDataInfo]);
  const getDadataValueByPath = useCallback((source, path) => {
    if (!source || typeof source !== "object") {
      return null;
    }
    const parts = String(path ?? "")
      .split(".")
      .map((part) => String(part).trim())
      .filter(Boolean);
    let cursor = source;
    for (const part of parts) {
      if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
        return null;
      }
      cursor = cursor[part];
    }
    return cursor;
  }, []);
  const normalizeComparisonValue = useCallback((value) => String(value ?? "").trim(), []);
  const organizationMainIndicatorsMismatch = useMemo(() => {
    const cardInn = normalizeComparisonValue(selectedOrganization?.inn);
    const cardKpp = normalizeComparisonValue(selectedOrganization?.kpp);
    const cardOgrn = normalizeComparisonValue(selectedOrganization?.ogrn);
    const dadataInn = normalizeComparisonValue(
      getDadataValueByPath(selectedOrganizationDataInfoForDisplay, "data.inn")
    );
    const dadataKpp = normalizeComparisonValue(
      getDadataValueByPath(selectedOrganizationDataInfoForDisplay, "data.kpp")
    );
    const dadataOgrn = normalizeComparisonValue(
      getDadataValueByPath(selectedOrganizationDataInfoForDisplay, "data.ogrn")
    );
    return {
      inn: Boolean(cardInn && dadataInn && cardInn !== dadataInn),
      kpp: Boolean(cardKpp && dadataKpp && cardKpp !== dadataKpp),
      ogrn: Boolean(cardOgrn && dadataOgrn && cardOgrn !== dadataOgrn)
    };
  }, [
    getDadataValueByPath,
    normalizeComparisonValue,
    selectedOrganization?.inn,
    selectedOrganization?.kpp,
    selectedOrganization?.ogrn,
    selectedOrganizationDataInfoForDisplay
  ]);
  const dadataMismatchByPath = useMemo(
    () => ({
      "data.inn": organizationMainIndicatorsMismatch.inn,
      "data.kpp": organizationMainIndicatorsMismatch.kpp,
      "data.ogrn": organizationMainIndicatorsMismatch.ogrn
    }),
    [
      organizationMainIndicatorsMismatch.inn,
      organizationMainIndicatorsMismatch.kpp,
      organizationMainIndicatorsMismatch.ogrn
    ]
  );
  const getDadataDescription = useCallback((fieldPath, fieldValue) => {
    const normalizedPath = String(fieldPath ?? "").trim();
    if (!normalizedPath) {
      return "";
    }
    if (normalizedPath === "data.management.name") {
      const normalizedValue = String(fieldValue ?? "")
        .trim()
        .toUpperCase();
      const looksLikeLegalEntity =
        normalizedValue.includes("ОБЩЕСТВО") ||
        normalizedValue.includes("ООО") ||
        normalizedValue.includes("АО") ||
        normalizedValue.includes("ПАО") ||
        normalizedValue.includes("ЗАО") ||
        normalizedValue.includes("ОАО");
      if (looksLikeLegalEntity) {
        return "Управляющая организация";
      }
    }
    if (Object.prototype.hasOwnProperty.call(DADATA_FIELD_DESCRIPTIONS, normalizedPath)) {
      return DADATA_FIELD_DESCRIPTIONS[normalizedPath];
    }
    const normalizedWithoutArray = normalizedPath.replace(/\[\]/g, "");
    if (Object.prototype.hasOwnProperty.call(DADATA_FIELD_DESCRIPTIONS, normalizedWithoutArray)) {
      return DADATA_FIELD_DESCRIPTIONS[normalizedWithoutArray];
    }
    return normalizedPath;
  }, []);
  const formatDadataValue = useCallback((value) => {
    if (value === null || value === undefined) {
      return "-";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  }, []);
  const getDadataDisplayValueByKey = useCallback(
    (key, rawValue) => {
      const normalizedKey = String(key ?? "").trim().toLowerCase();
      const normalizedValue = String(rawValue ?? "").trim().toUpperCase();
      if (normalizedKey === "data.state.status") {
        return (
          DADATA_ORGANIZATION_STATUS_DESCRIPTIONS[normalizedValue] ??
          formatDadataValue(rawValue)
        );
      }
      if (normalizedKey === "data.branch_type" || normalizedKey === "data.branchtype") {
        return DADATA_BRANCH_TYPE_DESCRIPTIONS[normalizedValue] ?? formatDadataValue(rawValue);
      }
      if (normalizedKey === "data.type") {
        return DADATA_ORGANIZATION_TYPE_DESCRIPTIONS[normalizedValue] ?? formatDadataValue(rawValue);
      }
      const isDateField =
        normalizedKey.endsWith("_date") ||
        normalizedKey.includes(".date") ||
        normalizedKey.includes("_date.");
      if (isDateField && (typeof rawValue === "number" || typeof rawValue === "string")) {
        const rawText = String(rawValue).trim();
        if (/^-?\d+$/.test(rawText)) {
          let timestamp = Number(rawText);
          if (Number.isFinite(timestamp)) {
            if (Math.abs(timestamp) < 100_000_000_000) {
              timestamp *= 1000;
            }
            const date = new Date(timestamp);
            if (!Number.isNaN(date.getTime())) {
              const hasTime =
                date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0;
              const datePart = new Intl.DateTimeFormat("ru-RU", {
                timeZone: "UTC",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
              }).format(date);
              if (!hasTime) {
                return datePart;
              }
              const timePart = new Intl.DateTimeFormat("ru-RU", {
                timeZone: "UTC",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
              }).format(date);
              return `${datePart} ${timePart}`;
            }
          }
        }
      }
      return formatDadataValue(rawValue);
    },
    [formatDadataValue]
  );
  const flattenDadataKeyValuePairs = useCallback((source, prefix = "") => {
    if (Array.isArray(source)) {
      if (!prefix) {
        return [];
      }
      return [
        {
          key: prefix,
          rawValue: source,
          value: getDadataDisplayValueByKey(prefix, source)
        }
      ];
    }
    if (source && typeof source === "object") {
      return Object.entries(source).flatMap(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (Array.isArray(value)) {
          return [
            {
              key: fullKey,
              rawValue: value,
              value: getDadataDisplayValueByKey(fullKey, value)
            }
          ];
        }
        if (value && typeof value === "object") {
          return flattenDadataKeyValuePairs(value, fullKey);
        }
        return [
          {
            key: fullKey,
            rawValue: value,
            value: getDadataDisplayValueByKey(fullKey, value)
          }
        ];
      });
    }
    if (!prefix) {
      return [];
    }
    return [
      {
        key: prefix,
        rawValue: source,
        value: getDadataDisplayValueByKey(prefix, source)
      }
    ];
  }, [getDadataDisplayValueByKey]);
  const selectedOrganizationDataInfoRootRows = useMemo(() => {
    return flattenDadataKeyValuePairs(selectedOrganizationDataInfoForDisplay)
      .map((item) => ({
        ...item,
        orderKey: normalizeDadataOrderKey(item.key),
        label: getDadataDescription(item.key, item.rawValue),
        isMismatch: Boolean(dadataMismatchByPath[item.key])
      }))
      .sort((left, right) => left.key.localeCompare(right.key, "ru"));
  }, [
    dadataMismatchByPath,
    flattenDadataKeyValuePairs,
    getDadataDescription,
    selectedOrganizationDataInfoForDisplay
  ]);
  const isAddressDadataKey = useCallback((key) => {
    const normalized = String(key ?? "").trim();
    return normalized === "data.address" || normalized.startsWith("data.address.");
  }, []);
  const isDadataAttributeVisible = useCallback(
    (key) => !Boolean(dadataHiddenAttributes[String(key ?? "").trim()]),
    [dadataHiddenAttributes]
  );
  const shouldShowDadataAttribute = useCallback(
    (key) => !isDadataVisibleOnlyEnabled || isDadataAttributeVisible(key),
    [isDadataAttributeVisible, isDadataVisibleOnlyEnabled]
  );
  const selectedOrganizationCompanyInfoRows = useMemo(() => {
    const companyOrder = Array.isArray(dadataAttributeOrderMap?.company)
      ? dadataAttributeOrderMap.company
      : [];
    const companyOrderIndexMap = new Map(
      companyOrder.map((key, index) => [normalizeDadataOrderKey(key), index])
    );
    const rows = selectedOrganizationDataInfoRootRows.filter(
      (row) => !isAddressDadataKey(row.key) && shouldShowDadataAttribute(row.key)
    );
    return rows.sort((left, right) => {
      const leftOrderIndex = companyOrderIndexMap.get(normalizeDadataOrderKey(left?.orderKey ?? left?.key));
      const rightOrderIndex = companyOrderIndexMap.get(
        normalizeDadataOrderKey(right?.orderKey ?? right?.key)
      );
      const hasLeftOrder = Number.isInteger(leftOrderIndex);
      const hasRightOrder = Number.isInteger(rightOrderIndex);
      if (hasLeftOrder && hasRightOrder && leftOrderIndex !== rightOrderIndex) {
        return leftOrderIndex - rightOrderIndex;
      }
      if (hasLeftOrder !== hasRightOrder) {
        return hasLeftOrder ? -1 : 1;
      }
      return String(left?.orderKey ?? left?.key ?? "").localeCompare(
        String(right?.orderKey ?? right?.key ?? ""),
        "ru"
      );
    });
  }, [
    dadataAttributeOrderMap?.company,
    isAddressDadataKey,
    selectedOrganizationDataInfoRootRows,
    shouldShowDadataAttribute
  ]);
  const selectedOrganizationAddressInfoRows = useMemo(() => {
    const addressOrder = Array.isArray(dadataAttributeOrderMap?.address)
      ? dadataAttributeOrderMap.address
      : [];
    const addressOrderIndexMap = new Map(
      addressOrder.map((key, index) => [normalizeDadataOrderKey(key), index])
    );
    const rows = selectedOrganizationDataInfoRootRows.filter(
      (row) => isAddressDadataKey(row.key) && shouldShowDadataAttribute(row.key)
    );
    return rows.sort((left, right) => {
      const leftOrderIndex = addressOrderIndexMap.get(normalizeDadataOrderKey(left?.orderKey ?? left?.key));
      const rightOrderIndex = addressOrderIndexMap.get(
        normalizeDadataOrderKey(right?.orderKey ?? right?.key)
      );
      const hasLeftOrder = Number.isInteger(leftOrderIndex);
      const hasRightOrder = Number.isInteger(rightOrderIndex);
      if (hasLeftOrder && hasRightOrder && leftOrderIndex !== rightOrderIndex) {
        return leftOrderIndex - rightOrderIndex;
      }
      if (hasLeftOrder !== hasRightOrder) {
        return hasLeftOrder ? -1 : 1;
      }
      return String(left?.orderKey ?? left?.key ?? "").localeCompare(
        String(right?.orderKey ?? right?.key ?? ""),
        "ru"
      );
    });
  }, [
    dadataAttributeOrderMap?.address,
    isAddressDadataKey,
    selectedOrganizationDataInfoRootRows,
    shouldShowDadataAttribute
  ]);
  const selectedOrganizationTypeNamesForEdit = useMemo(() => {
    const selectedIds = new Set(
      (Array.isArray(organizationCardEditForm.organUnitTypeIds)
        ? organizationCardEditForm.organUnitTypeIds
        : []
      )
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    );
    return organizationUnitTypeCatalog
      .filter((item) => selectedIds.has(String(item.id ?? "").trim()))
      .map((item) => item.name);
  }, [organizationCardEditForm.organUnitTypeIds, organizationUnitTypeCatalog]);
  const selectedOrganizationTypeSummaryForEdit = useMemo(() => {
    if (selectedOrganizationTypeNamesForEdit.length === 0) {
      return "";
    }
    if (selectedOrganizationTypeNamesForEdit.length === 1) {
      return selectedOrganizationTypeNamesForEdit[0];
    }
    return `Выбрано: ${selectedOrganizationTypeNamesForEdit.length}`;
  }, [selectedOrganizationTypeNamesForEdit]);
  const selectedCountryNameForEdit = useMemo(() => {
    const selectedId = String(organizationCardEditForm.countryId ?? "").trim();
    if (!selectedId) {
      return "";
    }
    const item = countryOptions.find((country) => String(country.id ?? "").trim() === selectedId);
    return item?.name ?? "";
  }, [countryOptions, organizationCardEditForm.countryId]);
  const filteredOrganizationTypeCatalogForEdit = useMemo(() => {
    const token = String(organizationTypeEditFilter ?? "").trim().toLowerCase();
    if (!token) {
      return organizationUnitTypeCatalog;
    }
    return organizationUnitTypeCatalog.filter((item) =>
      String(item?.name ?? "")
        .toLowerCase()
        .includes(token)
    );
  }, [organizationTypeEditFilter, organizationUnitTypeCatalog]);
  const filteredCountryOptionsForEdit = useMemo(() => {
    const token = String(countryEditFilter ?? "").trim().toLowerCase();
    if (!token) {
      return countryOptions;
    }
    return countryOptions.filter((item) =>
      String(item?.name ?? "")
        .toLowerCase()
        .includes(token)
    );
  }, [countryEditFilter, countryOptions]);
  const isReportMainSettingsEditable = isCreatingReportCard || isReportMainSettingsEditMode;
  useEffect(() => {
    if (!selectedReport) {
      if (!isCreatingReportCard) {
        setReportMainSettingsDraft(INITIAL_REPORT_MAIN_SETTINGS_DRAFT);
        setIsReportMainSettingsEditMode(false);
      }
      return;
    }
    if (!isReportMainSettingsEditable) {
      setReportMainSettingsDraft(buildReportMainSettingsDraft(selectedReport));
    }
  }, [isCreatingReportCard, isReportMainSettingsEditable, selectedReport]);
  const selectedReportOrganizations = useMemo(() => {
    const rows = Array.isArray(selectedReport?.organizations) ? selectedReport.organizations : [];
    return rows
      .map((item) => ({
        organUnitId: String(item?.organUnitId ?? "").trim(),
        organUnitName: String(item?.organUnitName ?? "").trim()
      }))
      .filter((item) => item.organUnitId || item.organUnitName);
  }, [selectedReport]);
  const selectedReportAccessGroups = useMemo(() => {
    const rows = Array.isArray(selectedReport?.accessGroups) ? selectedReport.accessGroups : [];
    return rows
      .map((item) => ({
        codeAccess: String(item?.codeAccess ?? "").trim()
      }))
      .filter((item) => item.codeAccess)
      .sort((left, right) =>
        String(left.codeAccess).localeCompare(String(right.codeAccess), "ru-RU", {
          numeric: true,
          sensitivity: "base"
        })
      );
  }, [selectedReport]);
  const selectedReportRecipients = useMemo(() => {
    const rows = Array.isArray(selectedReport?.recipients) ? selectedReport.recipients : [];
    return rows
      .map((item) => ({
        email: String(item?.email ?? "").trim().toLowerCase()
      }))
      .filter((item) => item.email)
      .sort((left, right) =>
        String(left.email).localeCompare(String(right.email), "ru-RU", {
          sensitivity: "base"
        })
      );
  }, [selectedReport]);
  useEffect(() => {
    if (isCreatingReportCard) {
      return;
    }
    setIsReportMainSettingsEditMode(false);
    setIsReportMainSettingsSaving(false);
    setIsReportDeleting(false);
    setPendingReportDelete(null);
    setReportMainSettingsDraft(INITIAL_REPORT_MAIN_SETTINGS_DRAFT);
    setIsReportOrganizationAddMode(false);
    setIsReportOrganizationComboOpen(false);
    setIsReportAccessGroupAddMode(false);
    setIsReportRecipientAddMode(false);
    setReportOrganizationSearch("");
    setReportOrganizationOptions([]);
    setSelectedReportOrganizationIdForAdd("");
    setNewReportAccessGroupCode(REPORT_ACCESS_GROUP_ENUM[0]);
    setNewReportRecipientEmail("");
    setDeletingReportOrganizationId("");
    setDeletingReportAccessGroupCode("");
    setDeletingReportRecipientEmail("");
  }, [isCreatingReportCard, selectedReportTemplateId]);
  useEffect(() => {
    setHasReportTemplateContentLoaded(false);
  }, [isCreatingReportCard, selectedReportTemplateId]);
  useEffect(() => {
    if (!isReportOrganizationComboOpen) {
      return;
    }
    const handleMouseDown = (event) => {
      if (event.target instanceof Element && event.target.closest(".report-organization-combobox")) {
        return;
      }
      setIsReportOrganizationComboOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isReportOrganizationComboOpen]);
  useEffect(() => {
    if (!isOrganizationTypeFilterOpen) {
      return;
    }
    const handleMouseDown = (event) => {
      if (event.target instanceof Element && event.target.closest(".organization-type-filter-combobox")) {
        return;
      }
      setIsOrganizationTypeFilterOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOrganizationTypeFilterOpen]);
  useEffect(() => {
    if (!isOrganizationsPage) {
      setIsOrganizationTypeFilterOpen(false);
    }
  }, [isOrganizationsPage]);
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
  const isEmployeeCardVisible = isEmployeesPage && isEmployeeCardPanelOpen;
  const isOrganizationCardVisible =
    isOrganizationsPage && isOrganizationCardPanelOpen && Boolean(String(selectedOrganizationId ?? "").trim());
  const isReportCardVisible =
    isReportSettingsPage &&
    isReportCardPanelOpen &&
    (isCreatingReportCard || Boolean(String(selectedReport?.reportTemplateId ?? "").trim()));
  const isSideCardVisible = isEmployeeCardVisible || isOrganizationCardVisible || isReportCardVisible;
  const isEmployeeOrganizationHeaderContext =
    isEmployeeOrganizationPage || isEmployeeCardPanelOpen || isOrganizationCardPanelOpen;
  const isReportHeaderContext = isReportSettingsPage || isReportCardPanelOpen;
  const isEmployeesHeaderContext = isEmployeesPage || isEmployeeCardPanelOpen;
  const reportSqlText = String(selectedReport?.sqlQuery ?? selectedReport?.sql_query ?? "").trim();
  const hasReportSqlForPreview = reportSqlText.length > 0;
  const hasJsonbWithVisibleFieldsForPreview = useMemo(() => {
    const jsonText = String(reportTemplateJsonInitial ?? "").trim();
    if (!jsonText) {
      return false;
    }
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return false;
      }
      const fields = Array.isArray(parsed.fields) ? parsed.fields : [];
      return fields.some((field) => isReportTemplateFieldVisible(field));
    } catch {
      return false;
    }
  }, [reportTemplateJsonInitial]);
  const reportPreviewPeriodLabel = useMemo(() => {
    const normalizePeriodValue = (value) => {
      const text = String(value ?? "").trim();
      if (!text || /^null\.?$/i.test(text)) {
        return "";
      }
      return text;
    };
    try {
      const parsed = JSON.parse(String(reportTemplateJsonInitial ?? "{}"));
      const startReport = normalizePeriodValue(parsed?.startReport);
      const endReport = normalizePeriodValue(parsed?.endReport);
      if (!startReport && !endReport) {
        return "Отчет за весь период";
      }
      if (startReport && endReport) {
        return `Период формирования отчета: ${startReport} - ${endReport}`;
      }
      return `Период формирования отчета: ${startReport || endReport}`;
    } catch {
      return "Отчет за весь период";
    }
  }, [reportTemplateJsonInitial]);
  const isReportPreviewTabAvailable = hasReportSqlForPreview && hasJsonbWithVisibleFieldsForPreview;
  const getAuthRoleNamesFromJwt = useCallback(() => {
    const decodeJwtPayload = (token) => {
      const text = String(token ?? "").trim();
      const parts = text.split(".");
      if (parts.length < 2) {
        return null;
      }
      const payloadPart = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = payloadPart + "=".repeat((4 - (payloadPart.length % 4 || 4)) % 4);
      try {
        const decoded = atob(padded);
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    };
    const collectRoles = (payload) => {
      if (!payload || typeof payload !== "object") {
        return [];
      }
      const roles = new Set();
      const pushRole = (value) => {
        const text = String(value ?? "").trim();
        if (text) {
          roles.add(text);
        }
      };
      const realmRoles = Array.isArray(payload?.realm_access?.roles) ? payload.realm_access.roles : [];
      realmRoles.forEach(pushRole);
      const resourceAccess =
        payload?.resource_access && typeof payload.resource_access === "object"
          ? payload.resource_access
          : null;
      if (resourceAccess) {
        Object.values(resourceAccess).forEach((entry) => {
          const clientRoles = Array.isArray(entry?.roles) ? entry.roles : [];
          clientRoles.forEach(pushRole);
        });
      }
      const directRoles = Array.isArray(payload?.roles) ? payload.roles : [];
      directRoles.forEach(pushRole);
      const authorities = Array.isArray(payload?.authorities) ? payload.authorities : [];
      authorities.forEach(pushRole);
      return [...roles];
    };
    const getDevFallbackRoles = () => {
      const defaultDevRoles = ["nl-gsg-claim-master-all"];
      const isLocalhost =
        typeof window !== "undefined" &&
        ["localhost", "127.0.0.1"].includes(String(window.location?.hostname ?? "").toLowerCase());
      if (!isLocalhost) {
        return [];
      }
      const parseRoleNames = (rawValue) => {
        const text = String(rawValue ?? "").trim();
        if (!text) {
          return [];
        }
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            return parsed
              .map((value) => String(value ?? "").trim())
              .filter(Boolean);
          }
        } catch {
          // ignore non-JSON value
        }
        return text
          .split(",")
          .map((value) => String(value ?? "").trim())
          .filter(Boolean);
      };
      for (const storage of [window.localStorage, window.sessionStorage]) {
        const storedRoles = parseRoleNames(storage?.getItem?.("adminka_mock_role_names"));
        if (storedRoles.length > 0) {
          return storedRoles;
        }
      }
      try {
        window.localStorage?.setItem?.("adminka_mock_role_names", JSON.stringify(defaultDevRoles));
      } catch {
        // ignore storage write errors in restricted environments
      }
      return defaultDevRoles;
    };
    const extractTokenCandidates = (rawValue) => {
      const text = String(rawValue ?? "").trim();
      if (!text) {
        return [];
      }
      const candidates = new Set();
      if (text.includes(".") && text.split(".").length >= 2) {
        candidates.add(text);
      }
      try {
        const parsed = JSON.parse(text);
        const fromJson = [
          parsed?.access_token,
          parsed?.id_token,
          parsed?.token,
          parsed?.kc_token
        ];
        fromJson.forEach((value) => {
          const tokenText = String(value ?? "").trim();
          if (tokenText && tokenText.includes(".")) {
            candidates.add(tokenText);
          }
        });
      } catch {
        // ignore non-JSON value
      }
      return [...candidates];
    };
    const tokenKeys = ["kc_token", "access_token", "token", "keycloakToken", "id_token"];
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of tokenKeys) {
        const value = storage?.getItem?.(key);
        for (const token of extractTokenCandidates(value)) {
          const payload = decodeJwtPayload(token);
          const roles = collectRoles(payload);
          if (roles.length > 0) {
            return roles;
          }
        }
      }
      if (storage && typeof storage.length === "number") {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (!key || (!key.startsWith("oidc.user:") && !key.toLowerCase().includes("keycloak"))) {
            continue;
          }
          const value = storage.getItem(key);
          for (const token of extractTokenCandidates(value)) {
            const payload = decodeJwtPayload(token);
            const roles = collectRoles(payload);
            if (roles.length > 0) {
              return roles;
            }
          }
        }
      }
    }
    return getDevFallbackRoles();
  }, []);
  const buildReportExecutionPayload = useCallback(
    (reportTemplateId, { includePeriod = false, requireRoleNamesForHand = false } = {}) => {
      const normalizePeriodValue = (value) => {
        const text = String(value ?? "").trim();
        if (!text || /^null\.?$/i.test(text)) {
          return null;
        }
        return text;
      };
      const normalizedReportTemplateId = String(reportTemplateId ?? "").trim();
      const method = String(
        selectedReport?.method ??
          selectedReport?.method_name ??
          reportMainSettingsDraft?.method ??
          ""
      )
        .trim()
        .toUpperCase();
      const roleNames = getAuthRoleNamesFromJwt();
      if (method === "HAND" && roleNames.length === 0) {
        console.warn("JWT roleNames not found for HAND report execution");
        if (requireRoleNamesForHand) {
          throw new Error("Для отчетов с method=HAND параметр roleNames обязателен");
        }
      }
      const payload = {
        reportId: normalizedReportTemplateId || null,
        claimOrganizationId: null,
        roleNames
      };
      if (includePeriod) {
        payload.startReport = normalizePeriodValue(
          reportTemplateSettingsDraft?.startReport ??
            reportTemplateSettingsInitial?.startReport ??
            selectedReport?.startReport ??
            selectedReport?.start_report
        );
        payload.endReport = normalizePeriodValue(
          reportTemplateSettingsDraft?.endReport ??
            reportTemplateSettingsInitial?.endReport ??
            selectedReport?.endReport ??
            selectedReport?.end_report
        );
      }
      return payload;
    },
    [
      getAuthRoleNamesFromJwt,
      reportMainSettingsDraft,
      reportTemplateSettingsDraft,
      reportTemplateSettingsInitial,
      selectedReport
    ]
  );
  const reportSqlSourceText = isReportSqlEditMode ? reportSqlDraft : reportSqlText;
  const reportSqlFontSizePx = REPORT_SQL_BASE_FONT_SIZE_PX * reportSqlZoom;
  const reportSqlLineHeightPx = REPORT_SQL_EDITOR_LINE_HEIGHT_PX * reportSqlZoom;
  const reportSqlLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, String(reportSqlDraft ?? "").split("\n").length);
    return Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
  }, [reportSqlDraft]);
  const reportSqlActiveLineTopPx =
    REPORT_SQL_EDITOR_PADDING_PX +
    (Math.max(1, reportSqlActiveLine) - 1) * reportSqlLineHeightPx -
    reportSqlEditorScrollTop;
  const highlightedReportSql = useMemo(() => {
    const normalizedSql = reportSqlSourceText || "--";
    return Prism.highlight(normalizedSql, Prism.languages.sql, "sql");
  }, [reportSqlSourceText]);

  const compareReportSqlResultValues = useCallback((leftValue, rightValue) => {
    if (leftValue == null && rightValue == null) {
      return 0;
    }
    if (leftValue == null) {
      return 1;
    }
    if (rightValue == null) {
      return -1;
    }
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      if (leftValue < rightValue) {
        return -1;
      }
      if (leftValue > rightValue) {
        return 1;
      }
      return 0;
    }
    if (typeof leftValue === "boolean" && typeof rightValue === "boolean") {
      if (leftValue === rightValue) {
        return 0;
      }
      return leftValue ? 1 : -1;
    }

    const leftDate = Date.parse(String(leftValue));
    const rightDate = Date.parse(String(rightValue));
    if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
      if (leftDate < rightDate) {
        return -1;
      }
      if (leftDate > rightDate) {
        return 1;
      }
      return 0;
    }

    return String(leftValue).localeCompare(String(rightValue), "ru-RU", {
      numeric: true,
      sensitivity: "base"
    });
  }, []);

  const sortedReportSqlResultsRows = useMemo(() => {
    if (reportSqlResultsSortRules.length === 0) {
      return reportSqlResultsRows;
    }
    const rowsWithIndex = reportSqlResultsRows.map((row, index) => ({ row, index }));
    rowsWithIndex.sort((left, right) => {
      for (const sortRule of reportSqlResultsSortRules) {
        const compareResult = compareReportSqlResultValues(
          left.row?.[sortRule.field],
          right.row?.[sortRule.field]
        );
        if (compareResult === 0) {
          continue;
        }
        return sortRule.direction === "DESC" ? -compareResult : compareResult;
      }
      return left.index - right.index;
    });
    return rowsWithIndex.map((item) => item.row);
  }, [compareReportSqlResultValues, reportSqlResultsRows, reportSqlResultsSortRules]);
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
  }, [
    activePage,
    activeEmployeeCardTab,
    activeReportCardTab,
    isReportCardVisible,
    isEmployeeCardVisible,
    reportTemplateViewMode
  ]);

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
      scheduleButtonTooltipPositionUpdate(event.clientX, event.clientY);
      setButtonTooltip({
        visible: true,
        text: tooltipText,
        x: event.clientX + 12,
        y: event.clientY + 12
      });
    };

    const handleMouseMove = (event) => {
      if (!buttonTooltipVisibleRef.current) {
        return;
      }
      scheduleButtonTooltipPositionUpdate(event.clientX, event.clientY);
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
      if (buttonTooltipMoveRafRef.current) {
        cancelAnimationFrame(buttonTooltipMoveRafRef.current);
      }
      buttonTooltipMoveRafRef.current = 0;
    };
  }, [scheduleButtonTooltipPositionUpdate]);

  useEffect(() => {
    buttonTooltipVisibleRef.current = Boolean(buttonTooltip.visible);
  }, [buttonTooltip.visible]);

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

    const normalizedReportSettings = normalizeColumnSettingsForColumns(
      parseStoredReportSettingsColumnSettings(),
      REPORT_SETTINGS_COLUMNS
    );
    window.localStorage.setItem(
      REPORT_SETTINGS_COLUMN_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizedReportSettings)
    );
  }, []);

  useEffect(() => {
    if (isEmployeesPage) {
      window.localStorage.setItem(SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    } else if (isOrganizationsPage) {
      window.localStorage.setItem(ORGANIZATIONS_SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    } else if (isEmployeeRelationsPage) {
      window.localStorage.setItem(RELATIONS_PAGE_SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    } else if (isReportSettingsPage) {
      window.localStorage.setItem(REPORT_SETTINGS_SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    }
  }, [isEmployeesPage, isOrganizationsPage, isEmployeeRelationsPage, isReportSettingsPage, sortRules]);

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
    } else if (isReportSettingsPage) {
      window.localStorage.setItem(REPORT_SETTINGS_FILTERS_STORAGE_KEY, JSON.stringify(filters));
    }
  }, [filters, isEmployeesPage, isOrganizationsPage, isEmployeeRelationsPage, isReportSettingsPage]);

  useEffect(() => {
    if (isEmployeesPage) {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } else if (isOrganizationsPage) {
      window.localStorage.setItem(ORGANIZATIONS_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } else if (isEmployeeRelationsPage) {
      window.localStorage.setItem(RELATIONS_PAGE_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } else if (isReportSettingsPage) {
      window.localStorage.setItem(REPORT_SETTINGS_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    }
  }, [columnWidths, isEmployeesPage, isOrganizationsPage, isEmployeeRelationsPage, isReportSettingsPage]);

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
    window.localStorage.setItem(
      REPORT_TEMPLATE_FIELDS_COLUMN_WIDTHS_STORAGE_KEY,
      JSON.stringify(reportTemplateFieldsColumnWidths)
    );
  }, [reportTemplateFieldsColumnWidths]);

  useEffect(() => {
    window.localStorage.setItem(
      REPORT_TEMPLATE_GENERAL_PARAMETER_COLUMN_WIDTH_STORAGE_KEY,
      String(reportTemplateGeneralParameterColumnWidth)
    );
  }, [reportTemplateGeneralParameterColumnWidth]);

  useEffect(() => {
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    if (!reportTemplateId) {
      setIsReportTemplateLevelTwoExpanded(false);
      setIsReportTemplateLevelThreeExpanded(false);
      return;
    }
    const storedMap = parseStoredReportTemplateLevelExpandedMap();
    const storedState =
      storedMap && typeof storedMap === "object" ? storedMap[reportTemplateId] : null;
    const levelTwo =
      storedState && typeof storedState === "object"
        ? toBooleanOrDefault(storedState.levelTwoExpanded, false)
        : false;
    const levelThree =
      storedState && typeof storedState === "object"
        ? toBooleanOrDefault(storedState.levelThreeExpanded, false)
        : false;
    setIsReportTemplateLevelTwoExpanded(levelTwo);
    setIsReportTemplateLevelThreeExpanded(levelThree);
  }, [selectedReportTemplateId]);


  useEffect(() => {
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    if (!reportTemplateId) {
      return;
    }
    const storedMap = parseStoredReportTemplateLevelExpandedMap();
    const nextMap = {
      ...storedMap,
      [reportTemplateId]: {
        levelTwoExpanded: isReportTemplateLevelTwoExpanded,
        levelThreeExpanded: isReportTemplateLevelThreeExpanded
      }
    };
    window.localStorage.setItem(
      REPORT_TEMPLATE_LEVEL_EXPANDED_STORAGE_KEY,
      JSON.stringify(nextMap)
    );
  }, [isReportTemplateLevelThreeExpanded, isReportTemplateLevelTwoExpanded, selectedReportTemplateId]);

  useEffect(() => {
    window.localStorage.setItem(
      DADATA_HIDDEN_ATTRIBUTES_STORAGE_KEY,
      JSON.stringify(dadataHiddenAttributes)
    );
  }, [dadataHiddenAttributes]);

  useEffect(() => {
    window.localStorage.setItem(
      DADATA_VISIBLE_ONLY_STORAGE_KEY,
      String(isDadataVisibleOnlyEnabled)
    );
  }, [isDadataVisibleOnlyEnabled]);
  useEffect(() => {
    window.localStorage.setItem(
      DADATA_ATTRIBUTE_ORDER_STORAGE_KEY,
      JSON.stringify(dadataAttributeOrderMap)
    );
  }, [dadataAttributeOrderMap]);


  useEffect(() => {
    window.localStorage.setItem(
      REPORT_TEMPLATE_GENERAL_SORT_DIRECTION_STORAGE_KEY,
      reportTemplateGeneralSettingsSortDirection
    );
  }, [reportTemplateGeneralSettingsSortDirection]);

  useEffect(() => {
    if (isEmployeesPage) {
      window.localStorage.setItem(COLUMN_SETTINGS_STORAGE_KEY, JSON.stringify(columnSettings));
    } else if (isOrganizationsPage) {
      window.localStorage.setItem(ORGANIZATIONS_COLUMN_SETTINGS_STORAGE_KEY, JSON.stringify(columnSettings));
    } else if (isEmployeeRelationsPage) {
      window.localStorage.setItem(RELATIONS_PAGE_COLUMN_SETTINGS_STORAGE_KEY, JSON.stringify(columnSettings));
    } else if (isReportSettingsPage) {
      window.localStorage.setItem(REPORT_SETTINGS_COLUMN_SETTINGS_STORAGE_KEY, JSON.stringify(columnSettings));
    }
  }, [
    columnSettings,
    isEmployeesPage,
    isOrganizationsPage,
    isEmployeeRelationsPage,
    isReportSettingsPage
  ]);

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
    if (!isReportSettingsPage) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setDebouncedReportSettingsFilters(filters);
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [filters, isReportSettingsPage]);

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
    if (!linkedOrganizationIdFilter) {
      return;
    }
    setSelectedOrganizationId("");
    setSelectedOrganizationSnapshot(null);
    setSelectedRowIndex(-1);
    setIsOrganizationCardPanelOpen(false);
    setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN);
    setIsOrganizationCardEditMode(false);
    setOrganizationCardEditForm(INITIAL_ORGANIZATION_CARD_EDIT_FORM);
    setActiveOrganizationEditCombo(null);
    setOrganizationTypeEditFilter("");
    setCountryEditFilter("");
    setOrganizationEditComboMenuLayouts({});
  }, [linkedOrganizationIdFilter, ORGANIZATION_CARD_TABS.MAIN]);

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
    if (!isOrganizationsPage || !linkedOrganizationIdFilter || !isLinkedOrganizationLookupActive) {
      return;
    }

    if (hasAnyEmployeeListFilter(filters)) {
      setFilters({ ...ORGANIZATION_INITIAL_FILTERS });
    }
    if (hasAnyEmployeeListFilter(debouncedOrganizationFilters)) {
      setDebouncedOrganizationFilters({ ...ORGANIZATION_INITIAL_FILTERS });
    }
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [
    currentPage,
    debouncedOrganizationFilters,
    filters,
    isOrganizationsPage,
    isLinkedOrganizationLookupActive,
    linkedOrganizationIdFilter
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
    if (!isOrganizationsPage || !linkedOrganizationIdFilter || !isLinkedOrganizationLookupActive) {
      return;
    }
    const currentSelectedId = String(
      selectedOrganization?.organUnitId ?? selectedOrganization?.organ_unit_id ?? ""
    ).trim();
    if (currentSelectedId === linkedOrganizationIdFilter) {
      return;
    }
    setSelectedOrganizationId("");
    setSelectedOrganizationSnapshot(null);
    setSelectedRowIndex(-1);
    setIsOrganizationCardPanelOpen(false);
    setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN);
    setIsOrganizationCardEditMode(false);
    setOrganizationCardEditForm(INITIAL_ORGANIZATION_CARD_EDIT_FORM);
    setActiveOrganizationEditCombo(null);
    setOrganizationTypeEditFilter("");
    setCountryEditFilter("");
    setOrganizationEditComboMenuLayouts({});
  }, [
    isOrganizationsPage,
    isLinkedOrganizationLookupActive,
    linkedOrganizationIdFilter,
    selectedOrganization,
    ORGANIZATION_CARD_TABS.MAIN
  ]);
  useEffect(() => {
    if (isOrganizationCardPanelOpen) {
      return;
    }
    setIsOrganizationCardEditMode(false);
    setOrganizationCardEditForm(INITIAL_ORGANIZATION_CARD_EDIT_FORM);
    setActiveOrganizationEditCombo(null);
    setOrganizationTypeEditFilter("");
    setCountryEditFilter("");
    setOrganizationEditComboMenuLayouts({});
  }, [isOrganizationCardPanelOpen]);

  useEffect(() => {
    if (pageJumpInputRef.current) {
      pageJumpInputRef.current.value = String(currentPage);
    }
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
      setSelectedOrganizationId("");
      setSelectedReportTemplateId("");
      reportTemplateSettingsLoadedForIdRef.current = "";
      setSelectedRowIndex(-1);
      if (!selectedEmployeeId) {
        setIsEmployeeCardPanelOpen(false);
      }
      if (!selectedOrganizationId) {
        setIsOrganizationCardPanelOpen(false);
      }
      if (!selectedReportTemplateId) {
        setIsReportCardPanelOpen(false);
      }
      return;
    }

    if (selectedRowIndex >= employees.length) {
      setSelectedRowIndex(-1);
    }
  }, [employees, selectedEmployeeId, selectedOrganizationId, selectedReportTemplateId, selectedRowIndex]);

  useEffect(() => {
    if (!selectedEmployeeFromList) {
      return;
    }
    setSelectedEmployeeSnapshot(selectedEmployeeFromList);
  }, [selectedEmployeeFromList]);
  useEffect(() => {
    if (!selectedOrganizationFromList) {
      return;
    }
    setSelectedOrganizationSnapshot((previous) => {
      const previousId = String(previous?.organUnitId ?? previous?.organ_unit_id ?? "").trim();
      const nextId = String(
        selectedOrganizationFromList?.organUnitId ??
          selectedOrganizationFromList?.organ_unit_id ??
          selectedOrganizationFromList?.id ??
          ""
      ).trim();
      if (previous && previousId && nextId && previousId === nextId) {
        return {
          ...selectedOrganizationFromList,
          ...previous
        };
      }
      return selectedOrganizationFromList;
    });
  }, [selectedOrganizationFromList]);

  useEffect(() => {
    if (isOrganizationsPage) {
      return;
    }
    selectedOrganizationRowRef.current = null;
  }, [isOrganizationsPage]);

  useEffect(() => {
    if (!selectedReportFromList) {
      return;
    }
    setSelectedReportSnapshot(selectedReportFromList);
  }, [selectedReportFromList]);

  useEffect(() => {
    if (!isReportCardVisible) {
      reportSqlResultsRequestRef.current += 1;
      setReportSqlViewMode(REPORT_SQL_VIEW_MODES.EDITOR);
      setIsReportSqlEditMode(false);
      setReportSqlDraft("");
      setIsReportSqlResultsLoading(false);
      setIsReportSqlResultsLoadingMore(false);
      setReportSqlResultsColumns([]);
      setReportSqlResultsRows([]);
      setReportSqlResultsPage(1);
      setReportSqlResultsHasMore(false);
      setReportSqlResultsError("");
      setReportSqlResultsSortRules([]);
      setReportSqlResultsStats({
        executionTime: "00:00:000",
        executionMs: 0,
        selectedRows: 0
      });
      setReportSqlValidationState("idle");
      setReportSqlErrorDetails("");
      setReportSqlActiveLine(1);
      setReportSqlCaretInfo({
        line: 1,
        column: 1,
        position: 1
      });
      setReportSqlEditorScrollTop(0);
      lastAutoValidatedReportSqlRef.current = "";
      return;
    }
    setReportSqlDraft(reportSqlText);
    setReportSqlActiveLine(1);
    setReportSqlCaretInfo({
      line: 1,
      column: 1,
      position: 1
    });
    setReportSqlEditorScrollTop(0);
  }, [isReportCardVisible, reportSqlText, selectedReportTemplateId]);

  useEffect(() => {
    if (!isReportCardVisible || activeReportCardTab !== REPORT_CARD_TABS.SQL) {
      return;
    }
    setReportSqlViewMode(REPORT_SQL_VIEW_MODES.EDITOR);
  }, [activeReportCardTab, isReportCardVisible, selectedReportTemplateId]);

  const fetchReportPreviewData = async (reportTemplateId) => {
    const requestStartedAt = Date.now();
    const toMeasuredMs = (value, fallbackValue = 0) => {
      const normalized = Number(value);
      if (Number.isFinite(normalized) && normalized > 0) {
        return Math.floor(normalized);
      }
      return Math.max(0, Number(fallbackValue) || 0);
    };
    const formatExecutionTimeFromMs = (rawMs) => {
      const totalMs = Math.max(0, Number(rawMs) || 0);
      const minutes = Math.floor(totalMs / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);
      const milliseconds = Math.floor(totalMs % 1000);
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(
        milliseconds
      ).padStart(3, "0")}`;
    };
    const buildSheetRowsFromWorksheet = (sheet, maxRows, templateSettings) => {
      if (!sheet || !sheet["!ref"]) {
        return {
          rows: [],
          meta: {
            rangeStartCol: 0,
            dataRowStartRelative: Number.MAX_SAFE_INTEGER,
            columnAlignByAbsoluteCol: {}
          }
        };
      }
      const pad2 = (value) => String(Math.max(0, Number(value) || 0)).padStart(2, "0");
      const normalizeDisplayDatePattern = (rawFormat, fieldType) => {
        const source = String(rawFormat ?? "").trim();
        const fallback = fieldType === "date" ? "ДД.ММ.ГГГГ" : "ДД.ММ.ГГГГ чч:мм:сс";
        const base = (source || fallback).replace(/;@/g, "");
        return base
          .replace(/YYYY/g, "ГГГГ")
          .replace(/yyyy/g, "ГГГГ")
          .replace(/YY/g, "ГГ")
          .replace(/yy/g, "ГГ")
          .replace(/HH/g, "чч")
          .replace(/hh/g, "чч")
          .replace(/MM/g, "ММ")
          .replace(/dd/g, "ДД")
          .replace(/SS/g, "сс")
          .replace(/ss/g, "сс");
      };
      const formatExcelSerialByPattern = (serialValue, pattern) => {
        const parsed = XLSX.SSF.parse_date_code(Number(serialValue));
        if (!parsed) {
          return "";
        }
        let result = String(pattern ?? "");
        result = result.replace(/ГГГГ/g, String(parsed.y));
        result = result.replace(/ГГ/g, String(parsed.y).slice(-2));
        result = result.replace(/ММ/g, pad2(parsed.m));
        result = result.replace(/ДД/g, pad2(parsed.d));
        result = result.replace(/чч/g, pad2(parsed.H));
        result = result.replace(/мм/g, pad2(parsed.M));
        result = result.replace(/сс/g, pad2(Math.round(parsed.S || 0)));
        return result;
      };
      const formatDateByPattern = (dateValue, pattern) => {
        if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
          return "";
        }
        let result = String(pattern ?? "");
        result = result.replace(/ГГГГ/g, String(dateValue.getFullYear()));
        result = result.replace(/ГГ/g, String(dateValue.getFullYear()).slice(-2));
        result = result.replace(/ММ/g, pad2(dateValue.getMonth() + 1));
        result = result.replace(/ДД/g, pad2(dateValue.getDate()));
        result = result.replace(/чч/g, pad2(dateValue.getHours()));
        result = result.replace(/мм/g, pad2(dateValue.getMinutes()));
        result = result.replace(/сс/g, pad2(dateValue.getSeconds()));
        return result;
      };
      const parseDateLikeString = (rawValue) => {
        const value = String(rawValue ?? "").trim();
        if (!value) {
          return null;
        }
        // Supports postgres/java timestamp variants used in preview:
        // 2026-03-12 14:48:18.906 / 2026-03-12 10:55 / 2026-03-12T14:48:18
        const directIso = value.replace(" ", "T");
        const isoDate = new Date(directIso);
        if (!Number.isNaN(isoDate.getTime())) {
          return isoDate;
        }
        const match = value.match(
          /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?$/
        );
        if (!match) {
          return null;
        }
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const hours = Number(match[4] ?? 0);
        const minutes = Number(match[5] ?? 0);
        const seconds = Number(match[6] ?? 0);
        const fractionRaw = String(match[7] ?? "");
        const milliseconds = Number((fractionRaw + "000").slice(0, 3) || 0);
        const parsed = new Date(year, month, day, hours, minutes, seconds, milliseconds);
        if (Number.isNaN(parsed.getTime())) {
          return null;
        }
        return parsed;
      };
      const normalizeExcelFormatPattern = (rawFormat, fieldType) => {
        const source = String(rawFormat ?? "").trim();
        if (!source) {
          return fieldType === "date" ? "dd.mm.yyyy" : "dd.mm.yyyy hh:mm:ss";
        }
        return source
          .replace(/ГГГГ/g, "yyyy")
          .replace(/ГГ/g, "yy")
          .replace(/ДД/g, "dd")
          .replace(/дд/g, "dd")
          .replace(/ММ/g, "mm")
          .replace(/ЧЧ/g, "hh")
          .replace(/чч/g, "hh")
          .replace(/СС/g, "ss")
          .replace(/сс/g, "ss")
          .replace(/;@/g, "");
      };
      const looksLikeDateFormat = (rawFormat) =>
        /[dmyhs]|[ДГМЧС]/i.test(String(rawFormat ?? ""));
      const visibleFields = (Array.isArray(templateSettings?.fields) ? templateSettings.fields : [])
        .filter((field) => isReportTemplateFieldVisible(field))
        .map((field, index) => ({
          fieldName: String(field?.fieldName ?? "").trim(),
          fieldCaption: String(field?.fieldCaption ?? "").trim(),
          fieldDataType: String(field?.fieldDataType ?? "text").trim().toLowerCase(),
          fieldDataFormat: String(field?.fieldDataFormat ?? "").trim(),
          fieldHorizAlign: String(field?.fieldHorizAlign ?? "СЛЕВА").trim().toUpperCase(),
          order: Number(field?.fieldOrderNumber) || index + 1,
          sourceIndex: index
        }))
        .sort((left, right) => {
          if (left.order !== right.order) {
            return left.order - right.order;
          }
          return left.sourceIndex - right.sourceIndex;
        });
      const startReportRow = Math.max(1, Number(templateSettings?.startReportRow) || 4);
      const startReportCol = Math.max(1, Number(templateSettings?.startReportCol) || 1);
      const headerAbsoluteRowIndex = startReportRow - 1;
      const dataAbsoluteRowStart = headerAbsoluteRowIndex + 1;
      const layoutFieldMetaByColumn = new Map();
      const fieldMetaByHeaderName = new Map();
      const columnAlignByAbsoluteCol = {};
      const toCssAlign = (value) => {
        const normalized = String(value ?? "").trim().toUpperCase();
        if (normalized === "ЦЕНТР" || normalized === "CENTER" || normalized === "CENTRE") {
          return "center";
        }
        if (normalized === "СПРАВА" || normalized === "RIGHT") {
          return "right";
        }
        return "left";
      };
      visibleFields.forEach((field, index) => {
        const absoluteCol = startReportCol - 1 + index;
        layoutFieldMetaByColumn.set(absoluteCol, field);
        columnAlignByAbsoluteCol[absoluteCol] = toCssAlign(field.fieldHorizAlign);
        const normalizedFieldName = String(field.fieldName ?? "").trim().toLowerCase();
        const normalizedFieldCaption = String(field.fieldCaption ?? "").trim().toLowerCase();
        if (normalizedFieldName) {
          fieldMetaByHeaderName.set(normalizedFieldName, field);
        }
        if (normalizedFieldCaption) {
          fieldMetaByHeaderName.set(normalizedFieldCaption, field);
        }
      });
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      const limitedEndRow = Math.min(range.e.r, range.s.r + Math.max(0, maxRows - 1));
      const rows = [];
      let headerRowIndex = -1;
      const columnFieldMetaByIndex = new Map();
      let headerStartColumn = -1;
      const normalizeHeaderText = (value) => String(value ?? "").trim().toLowerCase();
      const expectedHeaders = visibleFields.map((field) =>
        normalizeHeaderText(field.fieldCaption || field.fieldName)
      );
      for (let rowIndex = range.s.r; rowIndex <= limitedEndRow; rowIndex += 1) {
        const row = [];
        for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
          const cell = sheet[cellAddress];
          if (!cell) {
            row.push("");
            continue;
          }
          let formatted = String(cell.w ?? XLSX.utils.format_cell(cell) ?? "").trim();
          const rowRelativeIndex = rowIndex - range.s.r;
          const isDataRowByDetectedHeader = headerRowIndex >= 0 && rowRelativeIndex > headerRowIndex;
          const isDataRowByTemplateLayout = rowIndex >= dataAbsoluteRowStart;
          const isDataRow = isDataRowByDetectedHeader || isDataRowByTemplateLayout;
          const fieldMeta =
            columnFieldMetaByIndex.get(colIndex) ??
            (isDataRowByTemplateLayout ? layoutFieldMetaByColumn.get(colIndex) : null);
          if (
            isDataRow &&
            fieldMeta &&
            (fieldMeta.fieldDataType === "date" || fieldMeta.fieldDataType === "datetime") &&
            (typeof cell.v === "number" || cell.v instanceof Date || typeof cell.v === "string")
          ) {
            const displayPattern = normalizeDisplayDatePattern(
              fieldMeta.fieldDataFormat,
              fieldMeta.fieldDataType
            );
            let strictFormatted = "";
            if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
              strictFormatted = formatExcelSerialByPattern(cell.v, displayPattern);
            } else if (cell.v instanceof Date) {
              strictFormatted = formatDateByPattern(cell.v, displayPattern);
            } else if (typeof cell.v === "string") {
              const parsedDate = parseDateLikeString(cell.v);
              if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
                strictFormatted = formatDateByPattern(parsedDate, displayPattern);
              }
            }
            if (strictFormatted) {
              formatted = strictFormatted;
            }
          }
          if (
            typeof cell.v === "number" &&
            /^\d+(\.\d+)?$/.test(formatted) &&
            looksLikeDateFormat(cell.z)
          ) {
            try {
              const zFormat = normalizeExcelFormatPattern(String(cell.z ?? ""), "datetime");
              formatted = String(XLSX.SSF.format(zFormat, cell.v));
            } catch {
              // keep existing formatted value
            }
          }
          if (
            headerRowIndex >= 0 &&
            rowRelativeIndex > headerRowIndex &&
            fieldMeta &&
            (fieldMeta.fieldDataType === "date" || fieldMeta.fieldDataType === "datetime") &&
            typeof cell.v === "number" &&
            /^\d+(\.\d+)?$/.test(formatted)
          ) {
            try {
              const excelFormat = normalizeExcelFormatPattern(fieldMeta.fieldDataFormat, fieldMeta.fieldDataType);
              formatted = String(XLSX.SSF.format(excelFormat, cell.v));
            } catch {
              // keep existing formatted value
            }
          }
          row.push(formatted);
        }
        if (headerRowIndex < 0 && row.some((value) => String(value ?? "").trim() !== "")) {
          const normalizedRow = row.map((cellText) => normalizeHeaderText(cellText));
          const isExpectedHeaderRowByTemplate = rowIndex === headerAbsoluteRowIndex;
          let detectedStartByHeaders = -1;
          for (let start = 0; start < normalizedRow.length; start += 1) {
            let matches = 0;
            for (
              let fieldIndex = 0;
              fieldIndex < expectedHeaders.length && start + fieldIndex < normalizedRow.length;
              fieldIndex += 1
            ) {
              if (normalizedRow[start + fieldIndex] === expectedHeaders[fieldIndex]) {
                matches += 1;
              } else {
                break;
              }
            }
            if (matches >= Math.max(1, Math.min(2, expectedHeaders.length))) {
              detectedStartByHeaders = start;
              break;
            }
          }
          const canUseAsHeader =
            isExpectedHeaderRowByTemplate || (visibleFields.length > 0 && detectedStartByHeaders >= 0);
          if (canUseAsHeader) {
            headerRowIndex = rowIndex - range.s.r;
            headerStartColumn = detectedStartByHeaders >= 0 ? range.s.c + detectedStartByHeaders : range.s.c;
            row.forEach((cellText, index) => {
              const normalizedHeader = normalizeHeaderText(cellText);
              const mappedFieldMeta = fieldMetaByHeaderName.get(normalizedHeader);
              if (mappedFieldMeta) {
                columnFieldMetaByIndex.set(range.s.c + index, mappedFieldMeta);
              }
            });
            if (visibleFields.length > 0) {
              for (let fieldIndex = 0; fieldIndex < visibleFields.length; fieldIndex += 1) {
                columnFieldMetaByIndex.set(headerStartColumn + fieldIndex, visibleFields[fieldIndex]);
              }
            }
          }
        }
        rows.push(row);
      }
      const firstNonEmptyRowIndex = rows.findIndex((row) =>
        Array.isArray(row) && row.some((value) => String(value ?? "").trim() !== "")
      );
      const expectedHeaderRowIndex = Math.max(0, Math.min(rows.length - 1, startReportRow - 1 - range.s.r));
      const expectedHeaderHasData =
        expectedHeaderRowIndex >= 0 &&
        Array.isArray(rows[expectedHeaderRowIndex]) &&
        rows[expectedHeaderRowIndex].some((value) => String(value ?? "").trim() !== "");
      const effectiveHeaderRowIndex = expectedHeaderHasData
        ? expectedHeaderRowIndex
        : headerRowIndex >= 0
          ? headerRowIndex
          : firstNonEmptyRowIndex;
      if (visibleFields.length > 0 && effectiveHeaderRowIndex >= 0 && Array.isArray(rows[effectiveHeaderRowIndex])) {
        const normalizedHeaderRow = rows[effectiveHeaderRowIndex].map((value) => normalizeHeaderText(value));
        const sourceIndexByField = visibleFields.map((field, fieldIndex) => {
          const byFieldName = normalizeHeaderText(field.fieldName);
          const byCaption = normalizeHeaderText(field.fieldCaption);
          let foundIndex = byFieldName ? normalizedHeaderRow.findIndex((item) => item === byFieldName) : -1;
          if (foundIndex < 0 && byCaption) {
            foundIndex = normalizedHeaderRow.findIndex((item) => item === byCaption);
          }
          if (foundIndex >= 0) {
            return foundIndex;
          }
          const absoluteColByTemplate = startReportCol - 1 + fieldIndex;
          const relativeColByTemplate = absoluteColByTemplate - range.s.c;
          if (
            relativeColByTemplate >= 0 &&
            relativeColByTemplate < (rows[effectiveHeaderRowIndex]?.length ?? 0)
          ) {
            return relativeColByTemplate;
          }
          return -1;
        });
        const reorderedRows = rows.map((row, rowIndex) => {
          if (rowIndex === effectiveHeaderRowIndex) {
            return visibleFields.map((field) => field.fieldCaption || field.fieldName);
          }
          return sourceIndexByField.map((sourceIndex) =>
            sourceIndex >= 0 && sourceIndex < row.length ? row[sourceIndex] : ""
          );
        });
        const dataStartRelative = Math.max(0, effectiveHeaderRowIndex + 1);
        for (let rowIndex = dataStartRelative; rowIndex < reorderedRows.length; rowIndex += 1) {
          const currentRow = Array.isArray(reorderedRows[rowIndex]) ? reorderedRows[rowIndex] : [];
          for (let columnIndex = 0; columnIndex < visibleFields.length; columnIndex += 1) {
            const fieldMeta = visibleFields[columnIndex];
            if (!fieldMeta) {
              continue;
            }
            const fieldType = String(fieldMeta.fieldDataType ?? "").toLowerCase();
            if (fieldType !== "date" && fieldType !== "datetime") {
              continue;
            }
            const rawCellValue = String(currentRow[columnIndex] ?? "").trim();
            if (!rawCellValue) {
              continue;
            }
            const displayPattern = normalizeDisplayDatePattern(fieldMeta.fieldDataFormat, fieldType);
            let formattedValue = "";
            const numericValue = Number(rawCellValue.replace(",", "."));
            if (Number.isFinite(numericValue) && /^\d+(?:[.,]\d+)?$/.test(rawCellValue)) {
              formattedValue = formatExcelSerialByPattern(numericValue, displayPattern);
            }
            if (!formattedValue) {
              const parsedDate = parseDateLikeString(rawCellValue);
              if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
                formattedValue = formatDateByPattern(parsedDate, displayPattern);
              }
            }
            if (formattedValue) {
              currentRow[columnIndex] = formattedValue;
            }
          }
        }
        const reorderedAlignMap = {};
        visibleFields.forEach((field, index) => {
          reorderedAlignMap[index] = toCssAlign(field.fieldHorizAlign);
        });
        return {
          rows: reorderedRows,
          meta: {
            rangeStartCol: 0,
            dataRowStartRelative: dataStartRelative,
            columnAlignByAbsoluteCol: reorderedAlignMap
          }
        };
      }
      return {
        rows,
        meta: {
          rangeStartCol: range.s.c,
          dataRowStartRelative:
            headerRowIndex >= 0
              ? Math.max(0, headerRowIndex + 1)
              : Math.max(0, dataAbsoluteRowStart - range.s.r),
          columnAlignByAbsoluteCol
        }
      };
    };
    let response = await fetch(REPORT_TEMPLATE_EXCEL_PREVIEW_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        toCamelApiPayload({
          reportTemplateId,
          limit: REPORT_PREVIEW_MAX_RECORDS,
          ...buildReportExecutionPayload(reportTemplateId, {
            includePeriod: true,
            requireRoleNamesForHand: true
          })
        })
      )
    });
    if (response.status === 404) {
      response = await fetch(REPORT_TEMPLATES_EXCEL_PREVIEW_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          toCamelApiPayload({
            reportTemplateId,
            limit: REPORT_PREVIEW_MAX_RECORDS,
            ...buildReportExecutionPayload(reportTemplateId, {
              includePeriod: true,
              requireRoleNamesForHand: true
            })
          })
        )
      });
    }
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "Эндпоинт предпросмотра Excel не найден (/report-template/excel-preview). Перезапустите backend с последними изменениями."
        );
      }
      let errorText = "Ошибка получения предпросмотра отчета";
      try {
        const errorData = await response.json();
        errorText = String(errorData?.error ?? errorText);
      } catch {
        errorText = "Ошибка получения предпросмотра отчета";
      }
      throw new Error(errorText);
    }
    const backendExecutionMs = Number(response.headers.get("x-execution-ms") ?? 0);
    const backendQueryExecutionMs = Number(response.headers.get("x-query-execution-ms") ?? 0);
    const backendTemplateFillMs = Number(response.headers.get("x-template-fill-ms") ?? 0);
    const backendQueryExecutionNs = Number(response.headers.get("x-query-execution-ns") ?? 0);
    const backendTemplateFillNs = Number(response.headers.get("x-template-fill-ns") ?? 0);
    const measuredMs = Math.max(1, Date.now() - requestStartedAt);
    const executionMs = backendExecutionMs > 0 ? backendExecutionMs : measuredMs;
    const queryExecutionMs = backendQueryExecutionMs > 0
      ? backendQueryExecutionMs
      : backendQueryExecutionNs > 0
        ? Math.round((backendQueryExecutionNs / 1_000_000) * 1000) / 1000
        : executionMs;
    const templateFillMs = backendTemplateFillMs > 0
      ? backendTemplateFillMs
      : backendTemplateFillNs > 0
        ? Math.round((backendTemplateFillNs / 1_000_000) * 1000) / 1000
        : toMeasuredMs(executionMs - queryExecutionMs, 0);
    const backendExecutionTime = String(response.headers.get("x-execution-time") ?? "").trim();
    const executionTime =
      backendExecutionTime && backendExecutionMs > 0
        ? backendExecutionTime
        : formatExecutionTimeFromMs(measuredMs);
    const selectedRowsFromHeader = Number(response.headers.get("x-selected-rows") ?? 0);
    const workbookBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(workbookBuffer, {
      type: "array",
      cellDates: true,
      cellNF: true,
      cellStyles: true
    });
    const firstSheetName = Array.isArray(workbook.SheetNames) ? workbook.SheetNames[0] : "";
    const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
    let previewTemplateSettings = null;
    const templateJsonText = String(reportTemplateJsonInitial ?? "").trim();
    if (templateJsonText) {
      try {
        const parsedTemplateJson = JSON.parse(templateJsonText);
        previewTemplateSettings = normalizeReportTemplateSettings(
          parsedTemplateJson,
          String(selectedReport?.name ?? "")
        );
      } catch {
        previewTemplateSettings = null;
      }
    }
    if (
      !previewTemplateSettings ||
      !Array.isArray(previewTemplateSettings.fields) ||
      previewTemplateSettings.fields.length === 0
    ) {
      previewTemplateSettings =
        Array.isArray(reportTemplateSettingsInitial?.fields) && reportTemplateSettingsInitial.fields.length > 0
          ? reportTemplateSettingsInitial
          : normalizeReportTemplateSettings(
              selectedReport?.reportInfo ?? selectedReport?.report_info ?? null,
              String(selectedReport?.name ?? "")
            );
    }
    const parsed = buildSheetRowsFromWorksheet(firstSheet, REPORT_PREVIEW_MAX_RECORDS + 1, previewTemplateSettings);
    const parsedRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
    const selectedRows =
      selectedRowsFromHeader > 0
        ? selectedRowsFromHeader
        : Math.max(
            0,
            (Array.isArray(parsedRows) ? parsedRows : []).filter(
              (row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== "")
            ).length - 1
          );
    return {
      sheetRows: Array.isArray(parsedRows) ? parsedRows.slice(0, REPORT_PREVIEW_MAX_RECORDS + 1) : [],
      sheetMeta: parsed?.meta ?? {
        rangeStartCol: 0,
        dataRowStartRelative: Number.MAX_SAFE_INTEGER,
        columnAlignByAbsoluteCol: {}
      },
      executionMs,
      executionTime,
      selectedRows,
      queryExecutionMs,
      templateFillMs
    };
  };

  useEffect(() => {
    if (!isReportCardVisible) {
      return;
    }
    if (activeReportCardTab !== REPORT_CARD_TABS.PREVIEW) {
      return;
    }
    if (isReportPreviewTabAvailable) {
      return;
    }
    setActiveReportCardTab(REPORT_CARD_TABS.MAIN);
  }, [activeReportCardTab, isReportCardVisible, isReportPreviewTabAvailable]);

  useEffect(() => {
    if (!isReportCardVisible || activeReportCardTab !== REPORT_CARD_TABS.PREVIEW) {
      return;
    }
    if (!isReportPreviewTabAvailable) {
      return;
    }
    if (isReportTemplateSettingsLoading) {
      return;
    }
    if (
      !Array.isArray(reportTemplateSettingsInitial?.fields) ||
      reportTemplateSettingsInitial.fields.length === 0
    ) {
      return;
    }
    if (isReportPreviewLoading || reportPreviewSheetRows.length > 0 || reportPreviewError) {
      return;
    }
    const run = async () => {
      const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
      if (!reportTemplateId) {
        setReportPreviewError("Не удалось определить reportTemplateId");
        return;
      }
      setIsReportPreviewLoading(true);
      setReportPreviewError("");
      try {
        const previewData = await fetchReportPreviewData(reportTemplateId);
        setReportPreviewSheetRows(Array.isArray(previewData.sheetRows) ? previewData.sheetRows : []);
        setReportPreviewSheetMeta(
          previewData.sheetMeta ?? {
            rangeStartCol: 0,
            dataRowStartRelative: Number.MAX_SAFE_INTEGER,
            columnAlignByAbsoluteCol: {}
          }
        );
        setReportPreviewStats({
          executionTime: previewData.executionTime,
          executionMs: previewData.executionMs,
          selectedRows: previewData.selectedRows,
          queryExecutionMs: previewData.queryExecutionMs ?? 0,
          templateFillMs: previewData.templateFillMs ?? 0
        });
      } catch (error) {
        setReportPreviewError(
          error instanceof Error && String(error.message ?? "").trim()
            ? String(error.message)
            : "Ошибка получения предпросмотра отчета"
        );
        setReportPreviewSheetRows([]);
        setReportPreviewSheetMeta({
          rangeStartCol: 0,
          dataRowStartRelative: Number.MAX_SAFE_INTEGER,
          columnAlignByAbsoluteCol: {}
        });
      } finally {
        setIsReportPreviewLoading(false);
      }
    };
    const timeoutId = window.setTimeout(() => {
      void run();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeReportCardTab,
    isReportCardVisible,
    isReportPreviewTabAvailable,
    isReportTemplateSettingsLoading,
    reportTemplateSettingsInitial,
    reportTemplateJsonInitial,
    selectedReport,
    isReportPreviewLoading,
    reportPreviewSheetRows.length,
    reportPreviewError,
    selectedReportTemplateId
  ]);
  useEffect(() => {
    if (
      !isReportCardVisible ||
      activeReportCardTab !== REPORT_CARD_TABS.SQL ||
      isReportSqlEditMode ||
      reportSqlViewMode !== REPORT_SQL_VIEW_MODES.EDITOR
    ) {
      return;
    }
    const normalizedSql = String(reportSqlText ?? "").trim();
    if (!normalizedSql) {
      setReportSqlValidationState("idle");
      setReportSqlErrorDetails("");
      lastAutoValidatedReportSqlRef.current = `${selectedReportTemplateId}::`;
      return;
    }
    const signature = `${selectedReportTemplateId}::${normalizedSql}`;
    if (lastAutoValidatedReportSqlRef.current === signature) {
      return;
    }
    lastAutoValidatedReportSqlRef.current = signature;
    const timeoutId = window.setTimeout(() => {
      void checkReportSqlSyntax(normalizedSql, {
        showSuccessToast: false,
        showErrorToast: false
      });
    }, 120);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeReportCardTab,
    isReportCardVisible,
    isReportSqlEditMode,
    reportSqlText,
    reportSqlViewMode,
    selectedReportTemplateId
  ]);

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
        const response = await fetch(`${ADMIN_API_BASE_URL}/relation/${selectedEmployeeIdForRelations}`, {
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

  useLayoutEffect(() => {
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
      : isReportSettingsPage
        ? debouncedReportSettingsFilters
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
            : isOrganizationsPage && linkedOrganizationIdFilter
              ? ORGANIZATION_INITIAL_FILTERS
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
                : isOrganizationsPage && linkedOrganizationIdFilter
                  ? { organUnitId: linkedOrganizationIdFilter }
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
        if (isOrganizationsPage && linkedOrganizationIdFilter && isLinkedOrganizationLookupActive) {
          setHasLinkedOrganizationLookupAttempt(true);
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
    linkedOrganizationIdFilter,
    pageSize,
    activeSortRules,
    isEmployeesPage,
    isOrganizationsPage,
    isEmployeeRelationsPage,
    isReportSettingsPage,
    isListPage,
    isLinkedOrganizationLookupActive
  ]);

  useEffect(() => {
    if (!isOrganizationsPage) {
      return;
    }
    let cancelled = false;
    const loadOrganizationUnitTypes = async () => {
      try {
        const response = await fetch(LIST_ORGANIZATION_UNIT_TYPES_API_URL);
        const data = await response.json();
        if (!response.ok) {
          if (!cancelled) {
            setOrganizationUnitTypeOptions([]);
            setOrganizationUnitTypeCatalog([]);
          }
          return;
        }
        const items = Array.isArray(data?.items) ? data.items : [];
        const normalized = items
          .map((item) => ({
            id: String(item?.id ?? "").trim(),
            name: String(item?.name ?? "").trim(),
            sortOrder: Number(item?.sortOrder ?? item?.sort_order ?? Number.MAX_SAFE_INTEGER)
          }))
          .filter((item) => item.id && item.name)
          .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) {
              return left.sortOrder - right.sortOrder;
            }
            return left.name.localeCompare(right.name, "ru-RU", { sensitivity: "base", numeric: true });
          });
        if (!cancelled) {
          setOrganizationUnitTypeCatalog(normalized);
          setOrganizationUnitTypeOptions(normalized.map((item) => item.name));
        }
      } catch {
        if (!cancelled) {
          setOrganizationUnitTypeOptions([]);
          setOrganizationUnitTypeCatalog([]);
        }
      }
    };
    loadOrganizationUnitTypes();
    return () => {
      cancelled = true;
    };
  }, [isOrganizationsPage]);
  useEffect(() => {
    if (!isOrganizationsPage) {
      return;
    }
    let cancelled = false;
    const loadCountries = async () => {
      try {
        const response = await fetch(LIST_COUNTRIES_API_URL);
        const data = await response.json();
        if (!response.ok) {
          if (!cancelled) {
            setCountryOptions([]);
          }
          return;
        }
        const items = Array.isArray(data?.items) ? data.items : [];
        const normalized = items
          .map((item) => ({
            id: String(item?.id ?? "").trim(),
            name: String(item?.name ?? "").trim()
          }))
          .filter((item) => item.id && item.name);
        if (!cancelled) {
          setCountryOptions(normalized);
        }
      } catch {
        if (!cancelled) {
          setCountryOptions([]);
        }
      }
    };
    loadCountries();
    return () => {
      cancelled = true;
    };
  }, [isOrganizationsPage]);
  useEffect(() => {
    if (!isOrganizationsPage) {
      return;
    }
    if (!Array.isArray(filters.organUnitTypeNames)) {
      return;
    }
    const selected = filters.organUnitTypeNames
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    if (selected.length === 0) {
      return;
    }
    const allowed = new Set(organizationUnitTypeOptions);
    const normalized = selected.filter((name) => allowed.has(name));
    if (normalized.length === selected.length) {
      return;
    }
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      organUnitTypeNames: normalized
    }));
  }, [filters.organUnitTypeNames, isOrganizationsPage, organizationUnitTypeOptions]);
  useEffect(() => {
    if (!isOrganizationsPage || !isOrganizationCardPanelOpen) {
      return;
    }
    if (!isSelectedOrganizationResidentForAutoRefresh) {
      return;
    }
    const organizationId = String(selectedOrganizationId ?? "").trim();
    if (!organizationId) {
      return;
    }
    let cancelled = false;
    const loadOrganizationDetails = async () => {
      try {
        const response = await fetch(ORGANIZATION_DETAILS_API_PATH(encodeURIComponent(organizationId)));
        const data = await response.json();
        if (cancelled || !response.ok) {
          return;
        }
        setSelectedOrganizationSnapshot(data?.item && typeof data.item === "object" ? data.item : null);
      } catch {
        // keep snapshot from list when details request fails
      }
    };
    void loadOrganizationDetails();
    return () => {
      cancelled = true;
    };
  }, [isOrganizationsPage, isOrganizationCardPanelOpen, selectedOrganizationId]);

  useEffect(() => {
    if (!isPrintFormsPage) {
      return;
    }
    const fetchPrintForms = async () => {
      setPrintFormsLoading(true);
      setPrintFormsError("");
      try {
        const response = await fetch(PRINT_FORM_TEMPLATES_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ limit: 100, offset: 1 })
        });
        const data = await response.json();
        if (!response.ok) {
          setPrintFormsItems([]);
          setPrintFormsError(String(data?.error ?? "Не удалось получить шаблоны печатных форм"));
          return;
        }
        const items = Array.isArray(data?.items) ? data.items : [];
        setPrintFormsItems(items);
      } catch {
        setPrintFormsItems([]);
        setPrintFormsError("Не удалось получить шаблоны печатных форм");
      } finally {
        setPrintFormsLoading(false);
      }
    };
    fetchPrintForms();
  }, [isPrintFormsPage, printFormsRefreshToken]);

  const handlePrintFormPdfSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!/\.pdf$/i.test(file.name)) {
      setPrintFormsError("Для шаблона можно загрузить только PDF-файл");
      return;
    }
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const value = String(reader.result ?? "");
          const commaIndex = value.indexOf(",");
          resolve(commaIndex >= 0 ? value.slice(commaIndex + 1) : value);
        };
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
        reader.readAsDataURL(file);
      });
      setPrintFormPdfName(file.name);
      setPrintFormPdfBase64(String(base64));
      setPrintFormDetectedFields([]);
      setPrintFormsError("");
    } catch {
      setPrintFormsError("Не удалось прочитать PDF-файл");
    }
  };

  const handleCreatePrintFormTemplate = async () => {
    const name = String(printFormName ?? "").trim();
    const dataSql = String(printFormDataSql ?? "").trim();
    const templatePdfBase64 = String(printFormPdfBase64 ?? "").trim();
    if (!name) {
      setPrintFormsError("Укажи название шаблона");
      return;
    }
    if (!dataSql) {
      setPrintFormsError("Укажи SQL для получения данных");
      return;
    }
    if (!templatePdfBase64) {
      setPrintFormsError("Загрузи PDF-шаблон");
      return;
    }
    let fieldMapping;
    let overlaySettings;
    try {
      fieldMapping = JSON.parse(String(printFormFieldMappingText ?? "").trim() || "[]");
      if (!Array.isArray(fieldMapping)) {
        setPrintFormsError("Поле fieldMapping должно быть JSON-массивом");
        return;
      }
    } catch {
      setPrintFormsError("Поле fieldMapping содержит невалидный JSON");
      return;
    }
    try {
      overlaySettings = JSON.parse(String(printFormOverlaySettingsText ?? "").trim() || "{}");
      if (!overlaySettings || typeof overlaySettings !== "object" || Array.isArray(overlaySettings)) {
        setPrintFormsError("Поле overlaySettings должно быть JSON-объектом");
        return;
      }
    } catch {
      setPrintFormsError("Поле overlaySettings содержит невалидный JSON");
      return;
    }
    setIsPrintFormSaving(true);
    setPrintFormsError("");
    try {
      const response = await fetch(PRINT_FORM_TEMPLATE_CREATE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          toCamelApiPayload({
            name,
            code: String(printFormCode ?? "").trim(),
            description: String(printFormDescription ?? "").trim(),
            dataSql,
            fieldMapping,
            overlaySettings,
            templatePdfBase64
          })
        )
      });
      const data = await response.json();
      if (!response.ok) {
        setPrintFormsError(String(data?.error ?? "Не удалось создать шаблон печатной формы"));
        return;
      }
      setPrintFormName("");
      setPrintFormCode("");
      setPrintFormDescription("");
      setPrintFormDataSql("select 1 as sample_value");
      setPrintFormFieldMappingText(`[
  { "sourceField": "sample_value", "page": 1, "x": 80, "y": 720, "fontSize": 12 }
]`);
      setPrintFormOverlaySettingsText(`{
  "enabled": true,
  "text": "Черновик",
  "page": "ALL",
  "x": 40,
  "y": 24,
  "fontSize": 10,
  "opacity": 0.35,
  "color": "#6b7280"
}`);
      setPrintFormPdfName("");
      setPrintFormPdfBase64("");
      setPrintFormDetectedFields([]);
      setActivePrintFormsTab(PRINT_FORMS_TABS.LIST);
      setPrintFormsRefreshToken((prev) => prev + 1);
    } catch {
      setPrintFormsError("Не удалось создать шаблон печатной формы");
    } finally {
      setIsPrintFormSaving(false);
    }
  };

  const handleRecognizePrintFormTemplate = async () => {
    const templatePdfBase64 = String(printFormPdfBase64 ?? "").trim();
    if (!templatePdfBase64) {
      setPrintFormsError("Сначала загрузи PDF-шаблон");
      return;
    }
    setIsPrintFormRecognizing(true);
    setPrintFormsError("");
    try {
      const response = await fetch(PRINT_FORM_TEMPLATE_RECOGNIZE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          toCamelApiPayload({
            templatePdfBase64
          })
        )
      });
      const data = await response.json();
      if (!response.ok) {
        setPrintFormsError(String(data?.error ?? "Не удалось распознать атрибуты в PDF"));
        return;
      }
      const detectedFields = Array.isArray(data?.item?.templateFields)
        ? data.item.templateFields.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [];
      const recognizedFieldMapping = Array.isArray(data?.item?.fieldMapping) ? data.item.fieldMapping : [];
      setPrintFormDetectedFields(detectedFields);
      setPrintFormFieldMappingText(JSON.stringify(recognizedFieldMapping, null, 2));
    } catch {
      setPrintFormsError("Не удалось распознать атрибуты в PDF");
    } finally {
      setIsPrintFormRecognizing(false);
    }
  };

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
  useEffect(() => {
    if (!isOrganizationsPage || !linkedOrganizationIdFilter || !isLinkedOrganizationLookupActive || employeesLoading) {
      return;
    }
    const matchedIndex = employees.findIndex(
      (row) =>
        String(row?.organUnitId ?? row?.organ_unit_id ?? row?.id ?? "").trim() === linkedOrganizationIdFilter
    );
    if (matchedIndex < 0) {
      if (hasLinkedOrganizationLookupAttempt) {
        setIsLinkedOrganizationLookupActive(false);
      }
      return;
    }
    if (!isOrganizationCardPanelOpen) {
      setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN);
    }
    setIsOrganizationCardEditMode(false);
    setOrganizationCardEditForm(INITIAL_ORGANIZATION_CARD_EDIT_FORM);
    setSelectedOrganizationId(linkedOrganizationIdFilter);
    setSelectedRowIndex(matchedIndex);
    organizationDadataAutoRefreshAttemptedRef.current = new Set();
    setIsOrganizationCardPanelOpen(true);
    setIsColumnSettingsOpen(false);
    setLinkedOrganizationIdFilter("");
    setIsLinkedOrganizationLookupActive(false);
    setHasLinkedOrganizationLookupAttempt(false);
  }, [
    employees,
    employeesLoading,
    hasLinkedOrganizationLookupAttempt,
    isLinkedOrganizationLookupActive,
    isOrganizationCardPanelOpen,
    isOrganizationsPage,
    linkedOrganizationIdFilter,
    ORGANIZATION_CARD_TABS.MAIN
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
  const captureReportSettingsListSnapshot = useCallback(() => {
    reportSettingsListSnapshotRef.current = {
      employees,
      totalCount,
      currentPage,
      totalPages,
      visiblePaginationItems
    };
  }, [currentPage, employees, totalCount, totalPages, visiblePaginationItems]);
  const captureEmployeeListSnapshot = useCallback(() => {
    employeeListSnapshotRef.current = {
      employees,
      totalCount,
      currentPage,
      totalPages,
      visiblePaginationItems
    };
  }, [currentPage, employees, totalCount, totalPages, visiblePaginationItems]);
  const startReportCardListTransition = useCallback(() => {
    if (!isReportSettingsPage) {
      return;
    }
    captureReportSettingsListSnapshot();
    if (reportCardTransitionTimeoutRef.current) {
      window.clearTimeout(reportCardTransitionTimeoutRef.current);
      reportCardTransitionTimeoutRef.current = 0;
    }
    setIsReportCardTransitioning(true);
    reportCardTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsReportCardTransitioning(false);
      reportCardTransitionTimeoutRef.current = 0;
    }, REPORT_CARD_TRANSITION_MS);
  }, [captureReportSettingsListSnapshot, isReportSettingsPage]);
  const startEmployeeCardListTransition = useCallback(() => {
    if (!isEmployeesPage) {
      return;
    }
    captureEmployeeListSnapshot();
    if (employeeCardTransitionTimeoutRef.current) {
      window.clearTimeout(employeeCardTransitionTimeoutRef.current);
      employeeCardTransitionTimeoutRef.current = 0;
    }
    setIsEmployeeCardTransitioning(true);
    employeeCardTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsEmployeeCardTransitioning(false);
      employeeCardTransitionTimeoutRef.current = 0;
    }, SIDE_CARD_TRANSITION_MS);
  }, [captureEmployeeListSnapshot, isEmployeesPage]);
  const employeeListSnapshot = employeeListSnapshotRef.current;
  const reportSettingsSnapshot = reportSettingsListSnapshotRef.current;
  const activeListSnapshot =
    isReportSettingsPage && isReportCardTransitioning && reportSettingsSnapshot
      ? reportSettingsSnapshot
      : isEmployeesPage && isEmployeeCardTransitioning && employeeListSnapshot
        ? employeeListSnapshot
        : null;
  const displayedEmployees =
    activeListSnapshot
      ? activeListSnapshot.employees
      : employees;
  const displayedTotalCount =
    activeListSnapshot
      ? activeListSnapshot.totalCount
      : totalCount;
  const displayedCurrentPage =
    activeListSnapshot
      ? activeListSnapshot.currentPage
      : currentPage;
  const displayedTotalPages =
    activeListSnapshot
      ? activeListSnapshot.totalPages
      : totalPages;
  const displayedVisiblePaginationItems =
    activeListSnapshot
      ? activeListSnapshot.visiblePaginationItems
      : visiblePaginationItems;
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
        } else if (isReportSettingsPage) {
          window.localStorage.setItem(REPORT_SETTINGS_SORT_RULES_STORAGE_KEY, JSON.stringify(nextRules));
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
  const selectedOrganizationTypeNames = Array.isArray(filters.organUnitTypeNames)
    ? filters.organUnitTypeNames
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];
  const organizationTypeFilterTitle =
    selectedOrganizationTypeNames.length === 0
      ? "Выбрать тип"
      : selectedOrganizationTypeNames.length === 1
        ? selectedOrganizationTypeNames[0]
        : `Выбрано: ${selectedOrganizationTypeNames.length}`;
  const toggleOrganizationTypeFilterValue = (name) => {
    const normalizedName = String(name ?? "").trim();
    if (!normalizedName) {
      return;
    }
    const selectedSet = new Set(selectedOrganizationTypeNames);
    if (selectedSet.has(normalizedName)) {
      selectedSet.delete(normalizedName);
    } else {
      selectedSet.add(normalizedName);
    }
    handleFilterChange(
      "organUnitTypeNames",
      organizationUnitTypeOptions.filter((optionName) => selectedSet.has(optionName))
    );
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
    ? `${ADMIN_API_BASE_URL}/employees/export`
    : isOrganizationsPage
      ? `${ADMIN_API_BASE_URL}/organizations/export`
      : `${ADMIN_API_BASE_URL}/relations/export`;

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
    setIsAdministrationOpen((prev) => {
      const next = !prev;
      if (next) {
        const buttonRect = administrationButtonRef.current?.getBoundingClientRect();
        if (buttonRect) {
          setAdministrationPanelPosition({
            top: Math.max(0, buttonRect.top),
            left: Math.max(0, buttonRect.right)
          });
        }
      }
      return next;
    });
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
    } else if (isReportSettingsPage) {
      window.localStorage.setItem(REPORT_SETTINGS_SORT_RULES_STORAGE_KEY, JSON.stringify(sortRules));
    }

    setPageIdToUrl(pageId);
    setActivePage(pageId);
    setCurrentPage(1);
    setTotalCount(0);
    setEmployees([]);
    setEmployeesError("");
    setSelectedEmployeeSnapshot(null);
    setSelectedOrganizationSnapshot(null);
    setSelectedReportSnapshot(null);
    setSelectedEmployeeId("");
    setSelectedOrganizationId("");
    setSelectedReportTemplateId("");
    reportTemplateSettingsLoadedForIdRef.current = "";
    setSelectedRowIndex(-1);
    setIsEmployeeCardPanelOpen(false);
    setIsEmployeeCardTransitioning(false);
    setIsOrganizationCardPanelOpen(false);
    setIsReportCardPanelOpen(false);
    setIsCreatingReportCard(false);
    setActiveReportCardTab(REPORT_CARD_TABS.MAIN);
    setIsColumnSettingsOpen(false);
    if (employeeCardTransitionTimeoutRef.current) {
      window.clearTimeout(employeeCardTransitionTimeoutRef.current);
      employeeCardTransitionTimeoutRef.current = 0;
    }

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
    } else if (pageId === PAGE_IDS.REPORT_SETTINGS) {
      const storedReportSorts = parseStoredReportSettingsSortRules();
      const storedReportFilters = parseStoredReportSettingsFilters();
      const storedReportColumnWidths = parseStoredReportSettingsColumnWidths();
      const storedReportColumnSettings = parseStoredReportSettingsColumnSettings();
      setSortRules(storedReportSorts);
      setFilters(storedReportFilters);
      setDebouncedEmployeeFilters(parseStoredFilters());
      setDebouncedOrganizationFilters(parseStoredOrganizationFilters());
      setDebouncedRelationsPageFilters(parseStoredRelationsPageFilters());
      setDebouncedReportSettingsFilters(storedReportFilters);
      setColumnWidths(storedReportColumnWidths);
      setColumnSettings(storedReportColumnSettings);
      setIsConfirmModalOpen(false);
      setIsResultModalOpen(false);
      setPendingFile(null);
      setLoading(false);
    } else if (pageId === PAGE_IDS.PRINT_FORMS) {
      setSortRules(parseStoredSortRules());
      setFilters(parseStoredFilters());
      setDebouncedEmployeeFilters(parseStoredFilters());
      setDebouncedOrganizationFilters(parseStoredOrganizationFilters());
      setDebouncedRelationsPageFilters(parseStoredRelationsPageFilters());
      setDebouncedReportSettingsFilters(parseStoredReportSettingsFilters());
      setColumnWidths(parseStoredColumnWidths());
      setColumnSettings(parseStoredColumnSettings());
      setIsConfirmModalOpen(false);
      setIsResultModalOpen(false);
      setPendingFile(null);
      setLoading(false);
      setActivePrintFormsTab(PRINT_FORMS_TABS.LIST);
      setPrintFormsError("");
    }
    setIsAdministrationOpen(false);
    if (pageId !== PAGE_IDS.EMPLOYEES) {
      setLinkedEmployeeIdFilter("");
      setIsLinkedEmployeeLookupActive(false);
      setHasLinkedEmployeeLookupAttempt(false);
      setEmployeeIdToUrl("");
    }
    if (pageId !== PAGE_IDS.ORGANIZATIONS) {
      setLinkedOrganizationIdFilter("");
      setIsLinkedOrganizationLookupActive(false);
      setHasLinkedOrganizationLookupAttempt(false);
      setOrganizationIdToUrl("");
    }
  };

  const handleEmployeeRowClick = (rowIndex) => {
    if (isLinkedEmployeeLookupActive) {
      return;
    }
    if (employeeCardCloseCleanupTimeoutRef.current) {
      window.clearTimeout(employeeCardCloseCleanupTimeoutRef.current);
      employeeCardCloseCleanupTimeoutRef.current = 0;
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
      startEmployeeCardListTransition();
      setIsEmployeeCardPanelOpen(true);
      setIsColumnSettingsOpen(false);
    }
  };

  const handleOrganizationRowClick = (rowIndex) => {
    if (isLinkedOrganizationLookupActive) {
      return;
    }
    const organizationId = String(
      employees[rowIndex]?.organUnitId ?? employees[rowIndex]?.organ_unit_id ?? employees[rowIndex]?.id ?? ""
    ).trim();
    setSelectedOrganizationSnapshot(employees[rowIndex] ?? null);
    if (!isOrganizationCardPanelOpen) {
      setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN);
    }
    setSelectedOrganizationId(organizationId);
    setSelectedRowIndex(rowIndex);
    setIsOrganizationCardEditMode(false);
    setOrganizationCardEditForm(INITIAL_ORGANIZATION_CARD_EDIT_FORM);
    setActiveOrganizationEditCombo(null);
    setOrganizationTypeEditFilter("");
    setCountryEditFilter("");
    setOrganizationEditComboMenuLayouts({});
    if (isOrganizationsPage) {
      setIsLinkedOrganizationLookupActive(false);
      setHasLinkedOrganizationLookupAttempt(false);
      setOrganizationIdToUrl(organizationId);
      setIsOrganizationCardPanelOpen(true);
      setIsColumnSettingsOpen(false);
    }
  };

  const handleReportRowClick = (rowIndex) => {
    const row = employees[rowIndex] ?? null;
    const reportTemplateId = String(
      row?.reportTemplateId ?? row?.report_template_id ?? row?.id ?? ""
    ).trim();
    if (!reportTemplateId) {
      setSelectedRowIndex(rowIndex);
      return;
    }
    if (!isReportCardPanelOpen) {
      setActiveReportCardTab(REPORT_CARD_TABS.MAIN);
    }
    setIsCreatingReportCard(false);
    setIsReportTemplateEditMode(false);
    setReportTemplateViewMode(REPORT_TEMPLATE_VIEW_MODES.SETTINGS);
    setIsReportTemplateJsonEditMode(false);
    reportSqlResultsRequestRef.current += 1;
    setReportSqlViewMode(REPORT_SQL_VIEW_MODES.EDITOR);
    setIsReportSqlEditMode(false);
    setIsReportSqlResultsLoading(false);
    setIsReportSqlResultsLoadingMore(false);
    setReportSqlResultsColumns([]);
    setReportSqlResultsRows([]);
    setReportSqlResultsPage(1);
    setReportSqlResultsHasMore(false);
    setReportSqlResultsError("");
    setReportSqlResultsSortRules([]);
    setReportSqlResultsStats({
      executionTime: "00:00:000",
      executionMs: 0,
      selectedRows: 0
    });
    setReportSqlValidationState("idle");
    setReportSqlErrorDetails("");
    setReportSqlActiveLine(1);
    setReportSqlEditorScrollTop(0);
    lastAutoValidatedReportSqlRef.current = "";
    setIsReportPreviewLoading(false);
    setReportPreviewError("");
    setReportPreviewSheetRows([]);
    setReportPreviewSheetMeta({
      rangeStartCol: 0,
      dataRowStartRelative: Number.MAX_SAFE_INTEGER,
      columnAlignByAbsoluteCol: {}
    });
    setReportPreviewStats({
      executionTime: "00:00:000",
      executionMs: 0,
      selectedRows: 0,
      queryExecutionMs: 0,
      templateFillMs: 0
    });
    setIsReportMainSettingsEditMode(false);
    setIsReportMainSettingsSaving(false);
    setIsReportDeleting(false);
    setPendingReportDelete(null);
    setReportMainSettingsDraft(buildReportMainSettingsDraft(row));
    setIsReportOrganizationAddMode(false);
    setIsReportOrganizationComboOpen(false);
    setReportOrganizationSearch("");
    setReportOrganizationOptions([]);
    setSelectedReportOrganizationIdForAdd("");
    setIsReportAccessGroupAddMode(false);
    setNewReportAccessGroupCode(REPORT_ACCESS_GROUP_ENUM[0]);
    setIsReportRecipientAddMode(false);
    setNewReportRecipientEmail("");
    setDeletingReportOrganizationId("");
    setDeletingReportAccessGroupCode("");
    setDeletingReportRecipientEmail("");
    setSelectedReportSnapshot(row);
    setSelectedReportTemplateId(reportTemplateId);
    reportTemplateSettingsLoadedForIdRef.current = "";
    setSelectedRowIndex(rowIndex);
    startReportCardListTransition();
    setIsReportCardPanelOpen(true);
    setIsColumnSettingsOpen(false);
  };

  const openCreateReportCard = () => {
    reportSqlResultsRequestRef.current += 1;
    setReportSqlViewMode(REPORT_SQL_VIEW_MODES.EDITOR);
    setIsReportSqlEditMode(false);
    setIsReportSqlResultsLoading(false);
    setIsReportSqlResultsLoadingMore(false);
    setReportSqlResultsColumns([]);
    setReportSqlResultsRows([]);
    setReportSqlResultsPage(1);
    setReportSqlResultsHasMore(false);
    setReportSqlResultsError("");
    setReportSqlResultsSortRules([]);
    setReportSqlResultsStats({
      executionTime: "00:00:000",
      executionMs: 0,
      selectedRows: 0
    });
    setReportSqlDraft("");
    setReportSqlValidationState("idle");
    setReportSqlErrorDetails("");
    setReportSqlActiveLine(1);
    setReportSqlEditorScrollTop(0);
    lastAutoValidatedReportSqlRef.current = "";
    setIsReportTemplateEditMode(false);
    setReportTemplateViewMode(REPORT_TEMPLATE_VIEW_MODES.SETTINGS);
    setIsReportTemplateJsonEditMode(false);
    setReportTemplateJsonInitial("{}");
    setReportTemplateJsonDraft("{}");
    setReportTemplateJsonActiveLine(1);
    setReportTemplateJsonEditorScrollTop(0);
    setIsReportOrganizationAddMode(false);
    setIsReportOrganizationComboOpen(false);
    setReportOrganizationSearch("");
    setReportOrganizationOptions([]);
    setSelectedReportOrganizationIdForAdd("");
    setIsReportAccessGroupAddMode(false);
    setNewReportAccessGroupCode(REPORT_ACCESS_GROUP_ENUM[0]);
    setIsReportRecipientAddMode(false);
    setNewReportRecipientEmail("");
    setDeletingReportOrganizationId("");
    setDeletingReportAccessGroupCode("");
    setDeletingReportRecipientEmail("");
    setSelectedReportSnapshot({
      reportTemplateId: "",
      organizations: [],
      accessGroups: [],
      recipients: []
    });
    setSelectedReportTemplateId("");
    reportTemplateSettingsLoadedForIdRef.current = "";
    setSelectedRowIndex(-1);
    setActiveReportCardTab(REPORT_CARD_TABS.MAIN);
    setReportMainSettingsDraft(INITIAL_REPORT_MAIN_SETTINGS_DRAFT);
    setIsCreatingReportCard(true);
    setIsReportMainSettingsEditMode(true);
    startReportCardListTransition();
    setIsReportCardPanelOpen(true);
    setIsColumnSettingsOpen(false);
  };

  const handleCloseEmployeeCardPanel = () => {
    if (employeeCardCloseCleanupTimeoutRef.current) {
      window.clearTimeout(employeeCardCloseCleanupTimeoutRef.current);
      employeeCardCloseCleanupTimeoutRef.current = 0;
    }
    startEmployeeCardListTransition();
    setIsEmployeeCardPanelOpen(false);
    employeeCardCloseCleanupTimeoutRef.current = window.setTimeout(() => {
      setIsCreatingEmployeeCard(false);
      setIsEmployeeCardEditMode(false);
      setEmployeeCardEditForm(INITIAL_EMPLOYEE_CARD_EDIT_FORM);
      setSelectedEmployeeSnapshot(null);
      setSelectedEmployeeId("");
      setLinkedEmployeeIdFilter("");
      setIsLinkedEmployeeLookupActive(false);
      setHasLinkedEmployeeLookupAttempt(false);
      setEmployeeIdToUrl("");
      employeeCardCloseCleanupTimeoutRef.current = 0;
    }, SIDE_CARD_TRANSITION_MS);
  };

  const handleCloseOrganizationCardPanel = () => {
    setIsOrganizationCardPanelOpen(false);
    setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN);
    setIsOrganizationCardEditMode(false);
    setOrganizationCardEditForm(INITIAL_ORGANIZATION_CARD_EDIT_FORM);
    setActiveOrganizationEditCombo(null);
    setOrganizationTypeEditFilter("");
    setCountryEditFilter("");
    setOrganizationEditComboMenuLayouts({});
    setPendingOrganizationDelete(null);
    setOrganizationDadataCollapsedSections({
      company: false,
      address: false
    });
    setSelectedDadataRowBySection({
      company: "",
      address: ""
    });
    organizationDadataAutoRefreshAttemptedRef.current = new Set();
    setSelectedOrganizationSnapshot(null);
    setSelectedOrganizationId("");
    setLinkedOrganizationIdFilter("");
    setIsLinkedOrganizationLookupActive(false);
    setHasLinkedOrganizationLookupAttempt(false);
    setOrganizationIdToUrl("");
  };

  const handleCloseReportCardPanel = () => {
    startReportCardListTransition();
    setIsReportCardPanelOpen(false);
    setActiveReportCardTab(REPORT_CARD_TABS.MAIN);
    setIsCreatingReportCard(false);
    setIsReportMainSettingsEditMode(false);
    setIsReportMainSettingsSaving(false);
    setIsReportDeleting(false);
    setPendingReportDelete(null);
    setReportMainSettingsDraft(INITIAL_REPORT_MAIN_SETTINGS_DRAFT);
    setIsReportOrganizationAddMode(false);
    setIsReportOrganizationComboOpen(false);
    setReportOrganizationSearch("");
    setReportOrganizationOptions([]);
    setSelectedReportOrganizationIdForAdd("");
    setIsReportAccessGroupAddMode(false);
    setNewReportAccessGroupCode(REPORT_ACCESS_GROUP_ENUM[0]);
    setIsReportRecipientAddMode(false);
    setNewReportRecipientEmail("");
    setDeletingReportOrganizationId("");
    setDeletingReportAccessGroupCode("");
    setDeletingReportRecipientEmail("");
    setIsReportTemplateEditMode(false);
    setReportTemplateViewMode(REPORT_TEMPLATE_VIEW_MODES.SETTINGS);
    setIsReportTemplateJsonEditMode(false);
    reportSqlResultsRequestRef.current += 1;
    setReportSqlViewMode(REPORT_SQL_VIEW_MODES.EDITOR);
    setIsReportSqlEditMode(false);
    setIsReportSqlResultsLoading(false);
    setIsReportSqlResultsLoadingMore(false);
    setReportSqlResultsColumns([]);
    setReportSqlResultsRows([]);
    setReportSqlResultsPage(1);
    setReportSqlResultsHasMore(false);
    setReportSqlResultsError("");
    setReportSqlResultsSortRules([]);
    setReportSqlResultsStats({
      executionTime: "00:00:000",
      executionMs: 0,
      selectedRows: 0
    });
    setReportSqlDraft("");
    setReportSqlValidationState("idle");
    setReportSqlErrorDetails("");
    setReportSqlActiveLine(1);
    setReportSqlEditorScrollTop(0);
    lastAutoValidatedReportSqlRef.current = "";
    setSelectedReportSnapshot(null);
    setSelectedReportTemplateId("");
    reportTemplateSettingsLoadedForIdRef.current = "";
    setSelectedRowIndex(-1);
    setIsReportPreviewLoading(false);
    setReportPreviewError("");
    setReportPreviewSheetRows([]);
    setReportPreviewSheetMeta({
      rangeStartCol: 0,
      dataRowStartRelative: Number.MAX_SAFE_INTEGER,
      columnAlignByAbsoluteCol: {}
    });
    setReportPreviewStats({
      executionTime: "00:00:000",
      executionMs: 0,
      selectedRows: 0,
      queryExecutionMs: 0,
      templateFillMs: 0
    });
  };

  const handleRefreshReportPreview = async () => {
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    if (!reportTemplateId || isReportPreviewLoading || !isReportPreviewTabAvailable) {
      return;
    }
    setIsReportPreviewLoading(true);
    setReportPreviewError("");
    try {
      const previewData = await fetchReportPreviewData(reportTemplateId);
      setReportPreviewSheetRows(Array.isArray(previewData.sheetRows) ? previewData.sheetRows : []);
      setReportPreviewSheetMeta(
        previewData.sheetMeta ?? {
          rangeStartCol: 0,
          dataRowStartRelative: Number.MAX_SAFE_INTEGER,
          columnAlignByAbsoluteCol: {}
        }
      );
      setReportPreviewStats({
        executionTime: previewData.executionTime,
        executionMs: previewData.executionMs,
        selectedRows: previewData.selectedRows,
        queryExecutionMs: previewData.queryExecutionMs ?? 0,
        templateFillMs: previewData.templateFillMs ?? 0
      });
    } catch (error) {
      setReportPreviewError(
        error instanceof Error && String(error.message ?? "").trim()
          ? String(error.message)
          : "Ошибка получения предпросмотра отчета"
      );
      setReportPreviewSheetRows([]);
      setReportPreviewSheetMeta({
        rangeStartCol: 0,
        dataRowStartRelative: Number.MAX_SAFE_INTEGER,
        columnAlignByAbsoluteCol: {}
      });
    } finally {
      setIsReportPreviewLoading(false);
    }
  };

  const requestFullReportTemplateExcel = async () => {
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    if (!reportTemplateId || !isReportPreviewTabAvailable) {
      throw new Error("Невозможно сформировать Excel: проверьте SQL и jsonb");
    }
    let response = await fetch(REPORT_TEMPLATE_EXCEL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        toCamelApiPayload({
          reportTemplateId,
          ...buildReportExecutionPayload(reportTemplateId, { includePeriod: true })
        })
      )
    });
    if (response.status === 404) {
      response = await fetch(REPORT_TEMPLATES_EXCEL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          toCamelApiPayload({
            reportTemplateId,
            ...buildReportExecutionPayload(reportTemplateId, { includePeriod: true })
          })
        )
      });
    }
    if (response.status === 404) {
      throw new Error(
        "Полная выгрузка Excel недоступна на backend (endpoint /report-template/excel не найден). Перезапустите backend с последними изменениями."
      );
    }
    if (!response.ok) {
      let errorText = "Ошибка формирования Excel-отчета";
      try {
        const errorData = await response.json();
        errorText = String(errorData?.error ?? errorText);
      } catch {
        errorText = "Ошибка формирования Excel-отчета";
      }
      throw new Error(errorText);
    }
    const blob = await response.blob();
    const fallbackBaseNameRaw = String(
      selectedReport?.outputFileName ?? selectedReport?.output_file_name ?? "report"
    ).trim();
    const fallbackBaseNameResolved =
      resolveExportFileNameTemplate(fallbackBaseNameRaw, selectedReport?.name ?? "Отчет") || "report";
    const fallbackExtRaw = String(
      selectedReport?.outputFileType ?? selectedReport?.output_file_type ?? "xlsx"
    )
      .trim()
      .toLowerCase();
    const fallbackExt = fallbackExtRaw.replace(/[^a-z0-9]+/g, "") || "xlsx";
    const fallbackBaseName = stripExpectedExtension(fallbackBaseNameResolved, fallbackExt) || "report";
    const fallbackName = `${fallbackBaseName}.${fallbackExt}`;
    const fileNameFromHeader = parseFileNameFromDisposition(
      response.headers.get("content-disposition"),
      fallbackName
    );
    const headerBaseName = stripExpectedExtension(String(fileNameFromHeader ?? ""), fallbackExt);
    const reportNameForTemplate = selectedReport?.name ?? "Отчет";
    const configuredTemplate = String(
      selectedReport?.outputFileName ?? selectedReport?.output_file_name ?? ""
    ).trim();
    const hasTemplateTokens = /\{reportname\}|\{now(?:[:\s][^{}]+)?\}|\{now\}/i.test(configuredTemplate);
    const resolvedHeaderBaseName = resolveExportFileNameTemplate(headerBaseName, reportNameForTemplate);
    const resolvedBaseName = hasTemplateTokens
      ? fallbackBaseName
      : (resolvedHeaderBaseName || fallbackBaseName);
    const resolvedFileName = `${resolvedBaseName}.${fallbackExt}`;
    return { blob, fileName: resolvedFileName };
  };

  const getSqlLineAndColumnByPosition = (sqlText, positionRaw) => {
    const sql = String(sqlText ?? "");
    const position = Number(positionRaw);
    if (!Number.isFinite(position) || position <= 0) {
      return null;
    }
    const safePosition = Math.min(position, sql.length + 1);
    const beforeCursor = sql.slice(0, safePosition - 1);
    const lines = beforeCursor.split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column };
  };

  const normalizeReportSqlError = (message, sqlText) => {
    const rawMessage = String(message ?? "").trim();
    if (!rawMessage) {
      return "Ошибка проверки SQL-скрипта";
    }
    const compactMessage = rawMessage.replace(/\s+/g, " ").trim();
    const postgresErrorMatch = compactMessage.match(
      /ERROR:\s*([^;]+?)(?=(?:\s+Where:|\s+Position:|$))/i
    );
    const positionMatch = compactMessage.match(/Position:\s*(\d+)/i);
    const errorText = postgresErrorMatch
      ? postgresErrorMatch[1].trim()
      : compactMessage
          .replace(/^StatementCallback;\s*/i, "")
          .replace(/bad SQL grammar\s*\[.*$/i, "Синтаксическая ошибка SQL")
          .trim();
    const positionInfo = positionMatch
      ? getSqlLineAndColumnByPosition(sqlText, positionMatch[1])
      : null;
    if (positionInfo) {
      return `${errorText}. Строка ${positionInfo.line}, символ ${positionInfo.column}.`;
    }
    return errorText || "Ошибка проверки SQL-скрипта";
  };

  const checkReportSqlSyntax = async (
    sqlText,
    { showSuccessToast = false, showErrorToast = true } = {}
  ) => {
    const normalizedSql = String(sqlText ?? "").trim();
    const reportTemplateId = String(
      selectedReportTemplateId ??
        selectedReport?.reportTemplateId ??
        selectedReport?.report_template_id ??
        selectedReport?.id ??
        ""
    ).trim();
    if (!normalizedSql) {
      setReportSqlValidationState("idle");
      setReportSqlErrorDetails("");
      return false;
    }
    if (!reportTemplateId) {
      if (showErrorToast) {
        showSystemErrorToast("SQL-скрипт содержит ошибки - Не удалось определить reportTemplateId");
      }
      return false;
    }
    try {
      let response = await fetch(REPORT_TEMPLATE_SQL_VALIDATE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          toCamelApiPayload({
            sqlQuery: normalizedSql,
            reportTemplateId,
            ...buildReportExecutionPayload(reportTemplateId)
          })
        )
      });
      if (response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_SQL_VALIDATE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            toCamelApiPayload({
              sqlQuery: normalizedSql,
              reportTemplateId,
              ...buildReportExecutionPayload(reportTemplateId)
            })
          )
        });
      }
      const data = await response.json();
      if (!response.ok) {
        const rawError =
          response.status === 404
            ? "Метод проверки SQL не найден на backend. Перезапустите backend."
            : data.error ?? "Ошибка проверки SQL-скрипта";
        let normalizedError = normalizeReportSqlError(rawError, normalizedSql);
        const backendErrorCode = String(data?.errorCode ?? "").trim();
        const backendErrorLine = Number(data?.errorLine);
        const backendErrorColumn = Number(data?.errorColumn);
        if (Number.isFinite(backendErrorLine) && backendErrorLine > 0) {
          const locationText = Number.isFinite(backendErrorColumn) && backendErrorColumn > 0
            ? `Строка ${backendErrorLine}, символ ${backendErrorColumn}`
            : `Строка ${backendErrorLine}`;
          const codeText = backendErrorCode ? ` Код ошибки: ${backendErrorCode}.` : "";
          normalizedError = `${rawError}.${codeText} ${locationText}.`.replace(/\s+/g, " ").trim();
        }
        setReportSqlValidationState("error");
        setReportSqlErrorDetails(normalizedError);
        if (showErrorToast) {
          showSystemErrorToast(`SQL-скрипт содержит ошибки - ${normalizedError}`);
        }
        return false;
      }
      setReportSqlValidationState("success");
      setReportSqlErrorDetails("");
      if (showSuccessToast) {
          showSystemSuccessToast("SQL-скрипт корректный");
      }
      return true;
    } catch {
      const message = "Ошибка проверки SQL-скрипта";
      setReportSqlValidationState("error");
      setReportSqlErrorDetails(message);
      if (showErrorToast) {
        showSystemErrorToast(`SQL-скрипт содержит ошибки - ${message}`);
      }
      return false;
    }
  };

  const loadReportSqlResults = useCallback(
    async ({ reset = false } = {}) => {
      if ((reset && isReportSqlResultsLoading) || (!reset && (isReportSqlResultsLoading || isReportSqlResultsLoadingMore))) {
      return;
    }
      const pageToLoad = reset ? 1 : reportSqlResultsPage + 1;
      const savedSql = String(reportSqlText ?? "").trim();
      if (!savedSql) {
        setReportSqlResultsError("Сохраненный SQL-скрипт пустой");
        return;
      }
      const requestId = reportSqlResultsRequestRef.current + 1;
      reportSqlResultsRequestRef.current = requestId;
      if (reset) {
        setIsReportSqlResultsLoading(true);
        setReportSqlResultsError("");
        if (reportSqlResultsWrapperRef.current) {
          reportSqlResultsWrapperRef.current.scrollTop = 0;
        }
        reportSqlResultsLastScrollTopRef.current = 0;
      } else {
        setIsReportSqlResultsLoadingMore(true);
      }

      const reportTemplateId = String(
        selectedReportTemplateId ??
          selectedReport?.reportTemplateId ??
          selectedReport?.report_template_id ??
          selectedReport?.id ??
          ""
      ).trim();
    if (!reportTemplateId) {
        setReportSqlResultsError("Не удалось определить reportTemplateId");
        setIsReportSqlResultsLoading(false);
        setIsReportSqlResultsLoadingMore(false);
      return;
    }
    try {
        let response = await fetch(REPORT_TEMPLATE_SQL_RESULTS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          toCamelApiPayload({
              reportTemplateId,
              limit: REPORT_SQL_RESULTS_PREVIEW_LIMIT,
              offset: pageToLoad,
              ...buildReportExecutionPayload(reportTemplateId)
          })
        )
      });
      if (response.status === 404) {
          response = await fetch(REPORT_TEMPLATES_SQL_RESULTS_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            toCamelApiPayload({
                reportTemplateId,
                limit: REPORT_SQL_RESULTS_PREVIEW_LIMIT,
                offset: pageToLoad,
                ...buildReportExecutionPayload(reportTemplateId)
            })
          )
        });
      }
      const data = await response.json();
        if (requestId !== reportSqlResultsRequestRef.current) {
          return;
        }
      if (!response.ok) {
        const rawError =
          response.status === 404
              ? "Метод получения результатов SQL-скрипта не найден на backend. Перезапустите backend."
              : data.error ?? "Ошибка выполнения SQL-скрипта";
          const normalizedError = normalizeReportSqlError(rawError, savedSql);
          setReportSqlResultsError(normalizedError);
          showSystemErrorToast(`SQL-скрипт содержит ошибки - ${normalizedError}`);
        return;
      }
        const nextColumns = Array.isArray(data?.columns)
          ? data.columns.map((value) => String(value ?? ""))
          : [];
        const nextRows = Array.isArray(data?.rows)
          ? data.rows.slice(0, REPORT_SQL_RESULTS_PREVIEW_LIMIT)
          : [];
        setReportSqlResultsColumns((prev) => (reset || prev.length === 0 ? nextColumns : prev));
        setReportSqlResultsRows((prev) => (reset ? nextRows : [...prev, ...nextRows]));
        setReportSqlResultsPage(pageToLoad);
        setReportSqlResultsHasMore(false);
        setReportSqlResultsStats({
        executionTime: String(data?.executionTime ?? "00:00:000"),
        executionMs: Number(data?.executionMs ?? 0),
          selectedRows: Number(data?.totalRows ?? 0)
      });
    } catch {
        if (requestId !== reportSqlResultsRequestRef.current) {
          return;
        }
        const message = "Ошибка выполнения SQL-скрипта";
        setReportSqlResultsError(message);
        showSystemErrorToast(`SQL-скрипт содержит ошибки - ${message}`);
    } finally {
        if (requestId !== reportSqlResultsRequestRef.current) {
          return;
        }
        setIsReportSqlResultsLoading(false);
        setIsReportSqlResultsLoadingMore(false);
      }
    },
    [
      isReportSqlResultsLoading,
      isReportSqlResultsLoadingMore,
      normalizeReportSqlError,
      reportSqlResultsPage,
      reportSqlText,
      selectedReport,
      selectedReportTemplateId,
      showSystemErrorToast
    ]
  );

  const handleOpenReportSqlEditorView = () => {
    if (reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR) {
      return;
    }
    setReportSqlViewMode(REPORT_SQL_VIEW_MODES.EDITOR);
  };

  const handleOpenReportSqlResultsView = () => {
    if (reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS) {
      return;
    }
    setIsReportSqlEditMode(false);
    setReportSqlDraft(reportSqlText);
    setReportSqlViewMode(REPORT_SQL_VIEW_MODES.RESULTS);
    setReportSqlResultsColumns([]);
    setReportSqlResultsRows([]);
    setReportSqlResultsPage(1);
    setReportSqlResultsHasMore(false);
    setReportSqlResultsError("");
    setReportSqlResultsSortRules([]);
    void loadReportSqlResults({ reset: true });
  };

  const handleRefreshReportSqlResults = () => {
    setReportSqlResultsColumns([]);
    setReportSqlResultsRows([]);
    setReportSqlResultsPage(1);
    setReportSqlResultsHasMore(false);
    setReportSqlResultsError("");
    void loadReportSqlResults({ reset: true });
  };

  const getReportSqlResultsSortDirectionForField = useCallback(
    (fieldName) => {
      const match = reportSqlResultsSortRules.find((rule) => rule.field === fieldName);
      return match ? match.direction : null;
    },
    [reportSqlResultsSortRules]
  );

  const getReportSqlResultsSortOrderForField = useCallback(
    (fieldName) => {
      const sortIndex = reportSqlResultsSortRules.findIndex((rule) => rule.field === fieldName);
      return sortIndex >= 0 ? sortIndex + 1 : null;
    },
    [reportSqlResultsSortRules]
  );

  const handleReportSqlResultsSortClick = useCallback((fieldName) => {
    setReportSqlResultsSortRules((prev) => {
      const existingRule = prev.find((rule) => rule.field === fieldName);
      if (!existingRule) {
        return [...prev, { field: fieldName, direction: "ASC" }];
      }
      if (existingRule.direction === "ASC") {
        return prev.map((rule) =>
          rule.field === fieldName ? { ...rule, direction: "DESC" } : rule
        );
      }
      return prev.filter((rule) => rule.field !== fieldName);
    });
  }, []);
  const formatReportSqlResultCellValue = useCallback(
    (value) => {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      }
      return String(value);
    },
    []
  );
  const getSortedReportTemplateFieldDescriptors = useCallback(
    (fields) => getSortedReportTemplateFieldDescriptorsBase(fields),
    []
  );

  const sortedReportTemplateFields = useMemo(() => {
    const baseFields = Array.isArray(reportTemplateSettingsDraft.fields) ? reportTemplateSettingsDraft.fields : [];
    return getSortedReportTemplateFieldDescriptors(baseFields);
  }, [getSortedReportTemplateFieldDescriptors, reportTemplateSettingsDraft.fields]);
  const reportTemplateVisibleOrderBySourceIndex = useMemo(() => {
    const orderMap = new Map();
    let visibleOrder = 0;
    sortedReportTemplateFields.forEach(({ field, sourceIndex }) => {
      if (!isReportTemplateFieldVisible(field)) {
        return;
      }
      visibleOrder += 1;
      orderMap.set(sourceIndex, visibleOrder);
    });
    return orderMap;
  }, [sortedReportTemplateFields]);

  const reportTemplateFieldsTableWidthPx = useMemo(
    () =>
      REPORT_TEMPLATE_FIELDS_COLUMNS.reduce(
        (sum, column) =>
          sum +
          (Number(reportTemplateFieldsColumnWidths[column.key]) ||
            REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS[column.key]),
        0
      ),
    [reportTemplateFieldsColumnWidths]
  );
  const reportTemplateJsonFontSizePx = REPORT_TEMPLATE_JSON_BASE_FONT_SIZE_PX * reportTemplateJsonZoom;
  const reportTemplateJsonLineHeightPx = REPORT_TEMPLATE_JSON_LINE_HEIGHT_PX * reportTemplateJsonZoom;
  const reportTemplateJsonActiveLineTopPx =
    REPORT_TEMPLATE_JSON_PADDING_PX +
    (Math.max(1, reportTemplateJsonActiveLine) - 1) * reportTemplateJsonLineHeightPx -
    reportTemplateJsonEditorScrollTop;
  const reportTemplateJsonLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, String(reportTemplateJsonDraft ?? "").split("\n").length);
    return Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
  }, [reportTemplateJsonDraft]);

  const handleAlignReportTemplateFields = () => {
    const wrapper = reportTemplateFieldsTableWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const renderedColumns = REPORT_TEMPLATE_FIELDS_COLUMNS.map((column) => ({
      key: column.key,
      width:
        Number(reportTemplateFieldsColumnWidths[column.key]) ||
        REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS[column.key]
    }));
    if (renderedColumns.length === 0) {
      return;
    }
    const targetTotalWidth = wrapper.clientWidth;
    if (targetTotalWidth <= 0) {
      return;
    }
    const scaledWidths = fitRenderedColumnsToTargetWidth(renderedColumns, targetTotalWidth);
    if (!scaledWidths) {
      return;
    }
    setReportTemplateFieldsColumnWidths((prev) => {
      const next = { ...prev };
      scaledWidths.forEach((column) => {
        next[column.key] = column.width;
      });
      return next;
    });
    wrapper.scrollLeft = 0;
  };

  const handleResizeReportTemplateFieldColumnStart = (columnKey, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = Number(reportTemplateFieldsColumnWidths[columnKey]) || REPORT_TEMPLATE_FIELDS_MIN_COLUMN_WIDTH_PX;
    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.max(REPORT_TEMPLATE_FIELDS_MIN_COLUMN_WIDTH_PX, startWidth + delta);
      setReportTemplateFieldsColumnWidths((prev) => ({
        ...prev,
        [columnKey]: nextWidth
      }));
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      reportTemplateFieldsResizeRef.current = null;
    };
    reportTemplateFieldsResizeRef.current = { handleMouseMove, handleMouseUp };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleReportTemplateFieldDragStart = useCallback(
    (sourceIndex, fieldName, event) => {
      if (!isReportTemplateEditMode) {
        return;
      }
      const sourceField = Array.isArray(reportTemplateSettingsDraft.fields)
        ? reportTemplateSettingsDraft.fields[sourceIndex]
        : null;
      if (!isReportTemplateFieldVisible(sourceField)) {
        event.preventDefault();
        return;
      }
      reportTemplateFieldsDragSourceRef.current = sourceIndex;
      const dragLabelNode = document.createElement("div");
      dragLabelNode.className = "report-template-field-drag-preview";
      dragLabelNode.textContent = String(fieldName ?? "").trim() || "Поле";
      document.body.appendChild(dragLabelNode);
      reportTemplateFieldsDragImageRef.current = dragLabelNode;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(sourceIndex));
      event.dataTransfer.setDragImage(dragLabelNode, 16, 16);
    },
    [isReportTemplateEditMode, reportTemplateSettingsDraft.fields]
  );

  const stopReportTemplateFieldDragAutoScroll = useCallback(() => {
    const state = reportTemplateFieldsDragAutoScrollStateRef.current;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    state.rafId = 0;
    state.wrapper = null;
    state.direction = 0;
    state.speed = 0;
  }, []);

  const getDragClientYForReportTemplateFields = useCallback((event) => {
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

  const resolveReportTemplateFieldScrollContainer = useCallback(() => {
    const wrapper = reportTemplateFieldsTableWrapperRef.current;
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
      const isScrollableOverflow = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      if (isScrollableOverflow && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentElement;
    }
    return wrapper;
  }, []);

  const updateReportTemplateFieldDragAutoScroll = useCallback((clientY) => {
    if (!Number.isFinite(clientY)) {
      return;
    }
    const scrollContainer = resolveReportTemplateFieldScrollContainer();
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
    const state = reportTemplateFieldsDragAutoScrollStateRef.current;
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
      const activeState = reportTemplateFieldsDragAutoScrollStateRef.current;
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
  }, [resolveReportTemplateFieldScrollContainer]);

  const handleReportTemplateFieldDrag = useCallback(
    (event) => {
      if (
        reportTemplateFieldsDragSourceRef.current === null ||
        reportTemplateFieldsDragSourceRef.current === undefined
      ) {
        return;
      }
      const clientY = getDragClientYForReportTemplateFields(event);
      if (Number.isFinite(clientY)) {
        updateReportTemplateFieldDragAutoScroll(clientY);
      }
    },
    [
      getDragClientYForReportTemplateFields,
      updateReportTemplateFieldDragAutoScroll
    ]
  );

  const handleReportTemplateFieldsWrapperDragOver = useCallback(
    (event) => {
      if (!isReportTemplateEditMode) {
        return;
      }
      if (
        reportTemplateFieldsDragSourceRef.current === null ||
        reportTemplateFieldsDragSourceRef.current === undefined
      ) {
        return;
      }
      const clientY = getDragClientYForReportTemplateFields(event);
      if (Number.isFinite(clientY)) {
        updateReportTemplateFieldDragAutoScroll(clientY);
      }
    },
    [
      getDragClientYForReportTemplateFields,
      isReportTemplateEditMode,
      updateReportTemplateFieldDragAutoScroll
    ]
  );

  const handleReportTemplateFieldDragOver = useCallback(
    (targetIndex, event) => {
      if (!isReportTemplateEditMode) {
        return;
      }
      const sourceField = Array.isArray(reportTemplateSettingsDraft.fields)
        ? reportTemplateSettingsDraft.fields[reportTemplateFieldsDragSourceRef.current]
        : null;
      const targetField = Array.isArray(reportTemplateSettingsDraft.fields)
        ? reportTemplateSettingsDraft.fields[targetIndex]
        : null;
      if (!isReportTemplateFieldVisible(sourceField) || !isReportTemplateFieldVisible(targetField)) {
        return;
      }
      const sourceIndex = reportTemplateFieldsDragSourceRef.current;
      if (sourceIndex === null || sourceIndex === undefined || sourceIndex === targetIndex) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const clientY = getDragClientYForReportTemplateFields(event);
      if (Number.isFinite(clientY)) {
        updateReportTemplateFieldDragAutoScroll(clientY);
      }
    },
    [
      getDragClientYForReportTemplateFields,
      isReportTemplateEditMode,
      reportTemplateSettingsDraft.fields,
      updateReportTemplateFieldDragAutoScroll
    ]
  );

  const handleReportTemplateFieldDrop = useCallback(
    (targetIndex, event) => {
      if (!isReportTemplateEditMode) {
        return;
      }
      event.preventDefault();
      stopReportTemplateFieldDragAutoScroll();
      const sourceIndex = reportTemplateFieldsDragSourceRef.current;
      reportTemplateFieldsDragSourceRef.current = null;
      if (sourceIndex === null || sourceIndex === undefined || sourceIndex === targetIndex) {
        return;
      }
      setReportTemplateSettingsDraft((prev) => {
        const currentFields = Array.isArray(prev.fields) ? [...prev.fields] : [];
        if (currentFields.length <= 1) {
          return prev;
        }
        if (
          !isReportTemplateFieldVisible(currentFields[sourceIndex]) ||
          !isReportTemplateFieldVisible(currentFields[targetIndex])
        ) {
          return prev;
        }
        const orderedSourceIndexes = getSortedReportTemplateFieldDescriptors(currentFields).map(
          (item) => item.sourceIndex
        );
        const orderedVisibleSourceIndexes = orderedSourceIndexes.filter((fieldSourceIndex) =>
          isReportTemplateFieldVisible(currentFields[fieldSourceIndex])
        );
        const sourcePosition = orderedVisibleSourceIndexes.indexOf(sourceIndex);
        const targetPosition = orderedVisibleSourceIndexes.indexOf(targetIndex);
        if (sourcePosition < 0 || targetPosition < 0) {
          return prev;
        }
        const movedOrder = [...orderedVisibleSourceIndexes];
        const [movedSourceIndex] = movedOrder.splice(sourcePosition, 1);
        movedOrder.splice(targetPosition, 0, movedSourceIndex);
        const nextFields = [...currentFields];
        movedOrder.forEach((fieldSourceIndex, index) => {
          nextFields[fieldSourceIndex] = {
            ...nextFields[fieldSourceIndex],
            fieldOrderNumber: String(index + 1)
          };
        });
        return {
          ...prev,
          fields: nextFields
        };
      });
    },
    [
      getSortedReportTemplateFieldDescriptors,
      isReportTemplateEditMode,
      stopReportTemplateFieldDragAutoScroll
    ]
  );

  const handleReportTemplateFieldDragEnd = useCallback(() => {
    stopReportTemplateFieldDragAutoScroll();
    reportTemplateFieldsDragSourceRef.current = null;
    const dragImageNode = reportTemplateFieldsDragImageRef.current;
    if (dragImageNode?.parentNode) {
      dragImageNode.parentNode.removeChild(dragImageNode);
    }
    reportTemplateFieldsDragImageRef.current = null;
  }, [stopReportTemplateFieldDragAutoScroll]);

  useEffect(
    () => () => {
      stopReportTemplateFieldDragAutoScroll();
    },
    [stopReportTemplateFieldDragAutoScroll]
  );

  useEffect(() => {
    const handleWindowDragOver = (event) => {
      if (
        reportTemplateFieldsDragSourceRef.current === null ||
        reportTemplateFieldsDragSourceRef.current === undefined
      ) {
        return;
      }
      const clientY = getDragClientYForReportTemplateFields(event);
      if (!Number.isFinite(clientY)) {
        return;
      }
      updateReportTemplateFieldDragAutoScroll(clientY);
    };
    const handleWindowDrag = (event) => {
      if (
        reportTemplateFieldsDragSourceRef.current === null ||
        reportTemplateFieldsDragSourceRef.current === undefined
      ) {
        return;
      }
      const clientY = getDragClientYForReportTemplateFields(event);
      if (!Number.isFinite(clientY)) {
        return;
      }
      updateReportTemplateFieldDragAutoScroll(clientY);
    };
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drag", handleWindowDrag);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drag", handleWindowDrag);
    };
  }, [
    getDragClientYForReportTemplateFields,
    updateReportTemplateFieldDragAutoScroll
  ]);

  const stringifyReportTemplateJson = useCallback((value) => {
    try {
      return JSON.stringify(value ?? {}, null, 2);
    } catch {
      return "{}";
    }
  }, []);

  const reportTemplateGeneralSettingsRows = useMemo(() => {
    return reportTemplateGeneralSettingsSortDirection === REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.DESC
      ? [...REPORT_TEMPLATE_GENERAL_SETTINGS_ROWS_ASC].reverse()
      : REPORT_TEMPLATE_GENERAL_SETTINGS_ROWS_ASC;
  }, [reportTemplateGeneralSettingsSortDirection]);

  const handleToggleReportTemplateGeneralSettingsSort = () => {
    startTransition(() => {
      setReportTemplateGeneralSettingsSortDirection((prev) =>
        prev === REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.ASC
          ? REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.DESC
          : REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.ASC
      );
    });
  };


  const handleResizeReportTemplateGeneralSettingsParameterColumnStart = (event) => {
    event.preventDefault();
    const wrapper = reportTemplateGeneralSettingsTableWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const wrapperWidth = wrapper.clientWidth;
    const maxParameterWidth = Math.max(
      REPORT_TEMPLATE_GENERAL_SETTINGS_MIN_PARAMETER_COL_PX,
      wrapperWidth - REPORT_TEMPLATE_GENERAL_SETTINGS_MIN_VALUE_COL_PX
    );
    const startX = event.clientX;
    const startWidth = reportTemplateGeneralParameterColumnWidth;
    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.min(
        maxParameterWidth,
        Math.max(REPORT_TEMPLATE_GENERAL_SETTINGS_MIN_PARAMETER_COL_PX, startWidth + delta)
      );
      setReportTemplateGeneralParameterColumnWidth(nextWidth);
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      reportTemplateGeneralSettingsResizeRef.current = null;
    };
    reportTemplateGeneralSettingsResizeRef.current = { handleMouseMove, handleMouseUp };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const loadReportTemplateSettings = useCallback(async () => {
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    setIsReportTemplateSqlSyncing(false);
    if (!reportTemplateId) {
      const defaults = buildDefaultReportTemplateSettings(reportMainSettingsDraft.name ?? "");
      setReportTemplateSettingsInitial(defaults);
      setReportTemplateSettingsDraft(defaults);
      setReportTemplateJsonInitial(stringifyReportTemplateJson(defaults));
      setReportTemplateJsonDraft(stringifyReportTemplateJson(defaults));
      setReportTemplateLogoBase64(null);
      setReportTemplateLogoMimeType(null);
      setReportTemplateLogoInitialBase64(null);
      setReportTemplateLogoInitialMimeType(null);
      setHasReportTemplateContentLoaded(true);
      return;
    }

    setIsReportTemplateSettingsLoading(true);
    try {
      let response = await fetch(REPORT_TEMPLATE_SETTINGS_API_PATH(reportTemplateId));
      if (response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_SETTINGS_API_PATH(reportTemplateId));
      }
      const data = await response.json();
      if (!response.ok) {
        const message = data?.error ?? "Ошибка получения настроек шаблона отчета";
        showSystemErrorToast(message);
        const defaults = buildDefaultReportTemplateSettings(reportMainSettingsDraft.name ?? "");
        setReportTemplateSettingsInitial(defaults);
        setReportTemplateSettingsDraft(defaults);
        setReportTemplateJsonInitial(stringifyReportTemplateJson(defaults));
        setReportTemplateJsonDraft(stringifyReportTemplateJson(defaults));
        setReportTemplateLogoBase64(null);
        setReportTemplateLogoMimeType(null);
        setReportTemplateLogoInitialBase64(null);
        setReportTemplateLogoInitialMimeType(null);
        setHasReportTemplateContentLoaded(true);
        return;
      }

      const reportName = String(data?.item?.name ?? selectedReport?.name ?? "").trim();
      const sourceReportInfo =
        data?.item?.reportInfo && typeof data.item.reportInfo === "object"
          ? data.item.reportInfo
          : buildDefaultReportTemplateSettings(reportName);
      let reportInfoRaw = sourceReportInfo;
      let reportInfoJsonText = String(data?.item?.reportInfoJson ?? "").trim();
      const normalizedSettings = normalizeReportTemplateSettings(reportInfoRaw, reportName);
      setReportTemplateSettingsInitial(normalizedSettings);
      setReportTemplateSettingsDraft(normalizedSettings);
      setReportTemplateJsonInitial(reportInfoJsonText || stringifyReportTemplateJson(reportInfoRaw));
      setReportTemplateJsonDraft(reportInfoJsonText || stringifyReportTemplateJson(reportInfoRaw));
      setReportTemplateLogoBase64(
        String(data?.item?.reportLogoBase64 ?? "").trim() || null
      );
      setReportTemplateLogoMimeType(
        String(data?.item?.reportLogoMimeType ?? "").trim() || null
      );
      setReportTemplateLogoInitialBase64(
        String(data?.item?.reportLogoBase64 ?? "").trim() || null
      );
      setReportTemplateLogoInitialMimeType(
        String(data?.item?.reportLogoMimeType ?? "").trim() || null
      );
      const recipientsFromApi = Array.isArray(data?.item?.recipients)
        ? data.item.recipients
            .map((item) => ({ email: String(item?.email ?? "").trim().toLowerCase() }))
            .filter((item) => item.email)
        : null;
      if (Array.isArray(recipientsFromApi)) {
        const applyRecipientsUpdate = (row) => {
          if (String(row?.reportTemplateId ?? "").trim() !== reportTemplateId) {
            return row;
          }
          return { ...row, recipients: recipientsFromApi };
        };
        setEmployees((prev) => prev.map((row) => applyRecipientsUpdate(row)));
        setSelectedReportSnapshot((prev) => (prev ? applyRecipientsUpdate(prev) : prev));
      }
      setHasReportTemplateContentLoaded(true);
      setIsReportTemplateSqlSyncing(true);
      void (async () => {
        try {
          const sqlColumns = await loadSqlColumnsForReportTemplate(
            reportTemplateId,
            buildReportExecutionPayload(reportTemplateId)
          );
          if (reportTemplateSettingsLoadedForIdRef.current !== reportTemplateId) {
            return;
          }
          const reconciled = reconcileReportTemplateFieldsWithSqlColumns(sourceReportInfo?.fields, sqlColumns, {
            addMissing: false
          });
          setReportTemplateLinkFieldOptions(reconciled.linkColumns);
          const currentFields = Array.isArray(sourceReportInfo?.fields)
            ? sourceReportInfo.fields.map((field, index) => normalizeReportTemplateField(field, index))
            : [];
          const fieldsChanged =
            JSON.stringify(currentFields) !== JSON.stringify(reconciled.fields);
          if (!fieldsChanged) {
            return;
          }
          const nextReportInfo = {
            ...(sourceReportInfo && typeof sourceReportInfo === "object" ? sourceReportInfo : {}),
            fields: reconciled.fields
          };
          const normalizedReconciledSettings = normalizeReportTemplateSettings(nextReportInfo, reportName);
          const reconciledJsonText = stringifyReportTemplateJson(nextReportInfo);
          setReportTemplateSettingsInitial(normalizedReconciledSettings);
          setReportTemplateSettingsDraft(normalizedReconciledSettings);
          setReportTemplateJsonInitial(reconciledJsonText);
          setReportTemplateJsonDraft(reconciledJsonText);
          try {
            let persistResponse = await fetch(REPORT_TEMPLATE_SETTINGS_API_PATH(reportTemplateId), {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(toCamelApiPayload({ reportInfo: nextReportInfo }))
            });
            if (persistResponse.status === 404) {
              persistResponse = await fetch(REPORT_TEMPLATES_SETTINGS_API_PATH(reportTemplateId), {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(toCamelApiPayload({ reportInfo: nextReportInfo }))
              });
            }
          } catch {
            // Оставляем локально очищенные данные даже если фоновое сохранение не удалось.
          }
        } catch {
          if (reportTemplateSettingsLoadedForIdRef.current === reportTemplateId) {
            setReportTemplateLinkFieldOptions([]);
          }
        } finally {
          if (reportTemplateSettingsLoadedForIdRef.current === reportTemplateId) {
            setIsReportTemplateSqlSyncing(false);
          }
        }
      })();
    } catch {
      reportTemplateSettingsLoadedForIdRef.current = "";
      setIsReportTemplateSqlSyncing(false);
      showSystemErrorToast("Ошибка получения настроек шаблона отчета");
    } finally {
      setIsReportTemplateSettingsLoading(false);
    }
  }, [reportMainSettingsDraft.name, selectedReportTemplateId, showSystemErrorToast, stringifyReportTemplateJson]);

  useEffect(() => {
    if (!isReportCardVisible) {
      return;
    }
    setIsReportTemplateEditMode(false);
    setReportTemplateViewMode(REPORT_TEMPLATE_VIEW_MODES.SETTINGS);
    setIsReportTemplateJsonEditMode(false);
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    if (reportTemplateId && reportTemplateSettingsLoadedForIdRef.current === reportTemplateId) {
      return;
    }
    reportTemplateSettingsLoadedForIdRef.current = reportTemplateId;
    void loadReportTemplateSettings();
  }, [isReportCardVisible, loadReportTemplateSettings, selectedReportTemplateId]);

  useEffect(() => {
    return () => {
      if (reportCardTransitionTimeoutRef.current) {
        window.clearTimeout(reportCardTransitionTimeoutRef.current);
        reportCardTransitionTimeoutRef.current = 0;
      }
      if (employeeCardTransitionTimeoutRef.current) {
        window.clearTimeout(employeeCardTransitionTimeoutRef.current);
        employeeCardTransitionTimeoutRef.current = 0;
      }
      if (employeeCardCloseCleanupTimeoutRef.current) {
        window.clearTimeout(employeeCardCloseCleanupTimeoutRef.current);
        employeeCardCloseCleanupTimeoutRef.current = 0;
      }
      const generalResizeHandlers = reportTemplateGeneralSettingsResizeRef.current;
      if (generalResizeHandlers) {
        window.removeEventListener("mousemove", generalResizeHandlers.handleMouseMove);
        window.removeEventListener("mouseup", generalResizeHandlers.handleMouseUp);
      }
      const fieldsResizeHandlers = reportTemplateFieldsResizeRef.current;
      if (fieldsResizeHandlers) {
        window.removeEventListener("mousemove", fieldsResizeHandlers.handleMouseMove);
        window.removeEventListener("mouseup", fieldsResizeHandlers.handleMouseUp);
      }
    };
  }, []);

  const handleChangeReportTemplateField = (fieldName, value) => {
    setReportTemplateSettingsDraft((prev) => {
      if (
        fieldName === "headerFontSize" ||
        fieldName === "heightTabCaption" ||
        fieldName === "fontTabCaptionSize" ||
        fieldName === "recordFontSize" ||
        fieldName === "startReportRow" ||
        fieldName === "startReportCol"
      ) {
        return {
          ...prev,
          [fieldName]: sanitizePositiveIntegerDraftValue(value)
        };
      }
      if (
        fieldName === "headerFontColor" ||
        fieldName === "backTabCaptionColor" ||
        fieldName === "fontTabCaptionColor"
      ) {
        return {
          ...prev,
          [fieldName]: sanitizeHexColorDraftValue(value)
        };
      }
      return {
        ...prev,
        [fieldName]: value
      };
    });
  };

  const handleStartReportTemplateEdit = () => {
    if (isReportTemplateSettingsLoading || isReportTemplateSettingsSaving) {
      return;
    }
    setIsReportTemplateEditMode(true);
    setReportTemplateViewMode(REPORT_TEMPLATE_VIEW_MODES.SETTINGS);
    setIsReportTemplateJsonEditMode(false);
    void loadReportTemplateSqlColumns({ showErrorToast: false });
  };

  const handleCancelReportTemplateEdit = () => {
    setIsReportTemplateEditMode(false);
    setReportTemplateSettingsDraft(reportTemplateSettingsInitial);
    setReportTemplateLogoBase64(reportTemplateLogoInitialBase64);
    setReportTemplateLogoMimeType(reportTemplateLogoInitialMimeType);
  };

  const handleOpenReportTemplateJsonView = () => {
    if (isReportTemplateSettingsSaving || isReportTemplateEditMode) {
      return;
    }
    setReportTemplateJsonDraft(reportTemplateJsonInitial);
    setReportTemplateJsonActiveLine(1);
    setReportTemplateJsonEditorScrollTop(0);
    setIsReportTemplateJsonEditMode(false);
    setReportTemplateViewMode(REPORT_TEMPLATE_VIEW_MODES.JSON);
  };

  const handleOpenReportTemplateSettingsView = () => {
    if (isReportTemplateSettingsSaving || isReportTemplateJsonEditMode) {
      return;
    }
    try {
      const parsedReportInfo = JSON.parse(String(reportTemplateJsonInitial ?? "{}"));
      const normalizedFromJson = normalizeReportTemplateSettings(
        parsedReportInfo,
        selectedReport?.name ?? ""
      );
      setReportTemplateSettingsInitial(normalizedFromJson);
      setReportTemplateSettingsDraft(normalizedFromJson);
    } catch {
      showSystemErrorToast("Не удалось прочитать JSON параметров");
      return;
    }
    setReportTemplateViewMode(REPORT_TEMPLATE_VIEW_MODES.SETTINGS);
  };

  const handleToggleReportTemplateJsonEdit = () => {
    if (isReportTemplateSettingsSaving) {
      return;
    }
    setIsReportTemplateJsonEditMode((prev) => {
      const nextValue = !prev;
      if (nextValue) {
        const editor = reportTemplateJsonTextareaRef.current;
        if (editor) {
          setReportTemplateJsonActiveLine(resolveReportSqlCaretLine(editor.value, editor.selectionStart));
          setReportTemplateJsonEditorScrollTop(editor.scrollTop);
        } else {
          setReportTemplateJsonActiveLine(1);
          setReportTemplateJsonEditorScrollTop(0);
        }
      }
      return nextValue;
    });
  };

  const handleCancelReportTemplateJsonEdit = () => {
    setIsReportTemplateJsonEditMode(false);
    setReportTemplateJsonDraft(reportTemplateJsonInitial);
    setReportTemplateJsonActiveLine(1);
    setReportTemplateJsonEditorScrollTop(0);
  };

  const persistParsedReportTemplateJson = async (parsedReportInfo) => {
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    if (!reportTemplateId) {
      showSystemErrorToast("Не удалось определить reportTemplateId");
      return false;
    }
    setIsReportTemplateSettingsSaving(true);
    try {
      const payload = {
        reportInfo: parsedReportInfo
      };
      let response = await fetch(REPORT_TEMPLATE_SETTINGS_API_PATH(reportTemplateId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(toCamelApiPayload(payload))
      });
      if (response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_SETTINGS_API_PATH(reportTemplateId), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(toCamelApiPayload(payload))
        });
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка сохранения настроек шаблона отчета");
        return false;
      }
      const savedReportInfo =
        data?.item?.reportInfo && typeof data.item.reportInfo === "object"
          ? data.item.reportInfo
          : parsedReportInfo;
      const normalizedSavedSettings = normalizeReportTemplateSettings(
        savedReportInfo,
        selectedReport?.name ?? ""
      );
      const normalizedJsonText =
        String(data?.item?.reportInfoJson ?? "").trim() || stringifyReportTemplateJson(savedReportInfo);
      setReportTemplateSettingsInitial(normalizedSavedSettings);
      setReportTemplateSettingsDraft(normalizedSavedSettings);
      setReportTemplateJsonInitial(normalizedJsonText);
      setReportTemplateJsonDraft(normalizedJsonText);
      setEmployees((prev) =>
        prev.map((row) =>
          String(row?.reportTemplateId ?? "").trim() === reportTemplateId
            ? { ...row, reportInfo: savedReportInfo, report_info: savedReportInfo }
            : row
        )
      );
      setSelectedReportSnapshot((prev) =>
        prev && String(prev?.reportTemplateId ?? "").trim() === reportTemplateId
          ? { ...prev, reportInfo: savedReportInfo, report_info: savedReportInfo }
          : prev
      );
      return true;
    } catch {
      showSystemErrorToast("Ошибка сохранения настроек шаблона отчета");
      return false;
    } finally {
      setIsReportTemplateSettingsSaving(false);
    }
  };

  const handleOpenReportMainSettingsEdit = () => {
    if (!selectedReport || isReportMainSettingsSaving || isReportDeleting) {
      return;
    }
    setReportMainSettingsDraft(buildReportMainSettingsDraft(selectedReport));
    setIsReportMainSettingsEditMode(true);
  };

  const handleCancelReportMainSettingsEdit = () => {
    if (isCreatingReportCard) {
      handleCloseReportCardPanel();
      return;
    }
    setIsReportMainSettingsEditMode(false);
    setReportMainSettingsDraft(buildReportMainSettingsDraft(selectedReport));
  };

  const handleChangeReportMainSettingsDraft = (field, value) => {
    setReportMainSettingsDraft((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveReportMainSettings = async () => {
    if (isReportMainSettingsSaving || isReportDeleting) {
      return;
    }
    const isCreateMode = isCreatingReportCard;
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    if (!isCreateMode && !reportTemplateId) {
      showSystemErrorToast("Шаблон отчета не выбран");
      return;
    }
    const codeReport = String(reportMainSettingsDraft.codeReport ?? "").trim();
    const reportName = String(reportMainSettingsDraft.name ?? "").trim();
    const outputFileName = String(reportMainSettingsDraft.outputFileName ?? "").trim();
    const outputFileType = String(reportMainSettingsDraft.outputFileType ?? "")
      .trim()
      .toUpperCase();
    const method = String(reportMainSettingsDraft.method ?? "")
      .trim()
      .toUpperCase();
    const status = String(reportMainSettingsDraft.status ?? "")
      .trim()
      .toUpperCase();
    const version = String(reportMainSettingsDraft.version ?? "").trim();
    if (!codeReport) {
      showSystemErrorToast("Код отчета обязателен");
      return;
    }
    if (!reportName) {
      showSystemErrorToast("Наименование отчета обязательно");
      return;
    }
    if (!outputFileName) {
      showSystemErrorToast("Наименование выходного файла обязательно");
      return;
    }
    if (method !== "AUTO" && method !== "HAND") {
      showSystemErrorToast("Метод формирования должен быть AUTO или HAND");
      return;
    }
    if (status !== "ACTIVE" && status !== "INACTIVE") {
      showSystemErrorToast("Статус должен быть ACTIVE или INACTIVE");
      return;
    }
    if (outputFileType !== "XLSX") {
      showSystemErrorToast("Тип выходного файла должен быть XLSX");
      return;
    }
    const normalizedNumberDays = String(reportMainSettingsDraft.numberDays ?? "").trim();
    if (normalizedNumberDays && !/^\d+$/.test(normalizedNumberDays)) {
      showSystemErrorToast("Количество дней должно быть целым числом");
      return;
    }
    setIsReportMainSettingsSaving(true);
    try {
      const payload = toCamelApiPayload({
        codeReport,
        name: reportName,
        version,
        method,
        numberDays: normalizedNumberDays === "" ? null : Number(normalizedNumberDays),
        outputFileName,
        outputFileType,
        status
      });
      let response = await fetch(
        isCreateMode ? REPORT_TEMPLATE_CREATE_API_URL : REPORT_TEMPLATE_MAIN_SETTINGS_API_PATH(reportTemplateId),
        {
          method: isCreateMode ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
      if (isCreateMode && response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_CREATE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      } else if (!isCreateMode && response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_MAIN_SETTINGS_API_PATH(reportTemplateId), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка сохранения основных настроек");
        return;
      }
      const item = data?.item ?? {};
      const savedReportTemplateId = String(item?.reportTemplateId ?? reportTemplateId).trim();
      const currentSqlQuery = String(
        selectedReport?.sqlQuery ?? selectedReport?.sql_query ?? ""
      ).trim();
      const savedSqlQuery = String(
        item?.sqlQuery ?? item?.sql_query ?? (isCreateMode ? "" : currentSqlQuery)
      ).trim();
      const currentOrganizations = Array.isArray(selectedReport?.organizations)
        ? selectedReport.organizations
        : [];
      const currentAccessGroups = Array.isArray(selectedReport?.accessGroups)
        ? selectedReport.accessGroups
        : [];
      const currentRecipients = Array.isArray(selectedReport?.recipients)
        ? selectedReport.recipients
        : [];
      const savedOrganizations = Array.isArray(item?.organizations)
        ? item.organizations
        : (isCreateMode ? [] : currentOrganizations);
      const savedAccessGroups = Array.isArray(item?.accessGroups)
        ? item.accessGroups
        : (isCreateMode ? [] : currentAccessGroups);
      const savedRecipients = Array.isArray(item?.recipients)
        ? item.recipients
        : (isCreateMode ? [] : currentRecipients);
      const patch = {
        reportTemplateId: savedReportTemplateId,
        codeReport: String(item?.codeReport ?? codeReport).trim(),
        name: String(item?.name ?? reportName).trim(),
        version: String(item?.version ?? version).trim(),
        method: String(item?.method ?? method).trim(),
        numberDays: item?.numberDays ?? (normalizedNumberDays === "" ? null : Number(normalizedNumberDays)),
        outputFileName: String(item?.outputFileName ?? outputFileName).trim(),
        outputFileType: String(item?.outputFileType ?? outputFileType).trim(),
        status: String(item?.status ?? status).trim(),
        sqlQuery: savedSqlQuery,
        sql_query: savedSqlQuery,
        reportInfo: item?.reportInfo ?? null,
        organizations: savedOrganizations,
        accessGroups: savedAccessGroups,
        recipients: savedRecipients
      };
      if (isCreateMode) {
        setEmployees((prev) => {
          const withoutDuplicate = prev.filter(
            (row) => String(row?.reportTemplateId ?? "").trim() !== savedReportTemplateId
          );
          return [patch, ...withoutDuplicate];
        });
        setTotalCount((prev) => prev + 1);
        setSelectedReportSnapshot(patch);
        setSelectedReportTemplateId(savedReportTemplateId);
        setSelectedRowIndex(0);
        setIsCreatingReportCard(false);
      } else {
        const applyUpdate = (row) => {
          if (String(row?.reportTemplateId ?? "").trim() !== reportTemplateId) {
            return row;
          }
          return { ...row, ...patch };
        };
        setEmployees((prev) => prev.map((row) => applyUpdate(row)));
        setSelectedReportSnapshot((prev) => (prev ? { ...prev, ...patch } : prev));
      }
      setReportMainSettingsDraft((prev) => ({
        ...prev,
        codeReport: patch.codeReport,
        name: patch.name,
        version: patch.version,
        method: patch.method,
        numberDays:
          patch.numberDays === null || patch.numberDays === undefined ? "" : String(patch.numberDays),
        outputFileName: patch.outputFileName,
        outputFileType: patch.outputFileType,
        status: patch.status
      }));
      setIsReportMainSettingsEditMode(false);
      showSystemSuccessToast(isCreateMode ? "Отчет создан" : "Основные настройки отчета сохранены");
    } catch {
      showSystemErrorToast("Ошибка сохранения основных настроек");
    } finally {
      setIsReportMainSettingsSaving(false);
    }
  };

  const handleOpenReportDeleteModal = () => {
    if (!selectedReport || isReportMainSettingsSaving || isReportDeleting) {
      return;
    }
    setPendingReportDelete({
      reportTemplateId: String(selectedReport?.reportTemplateId ?? "").trim(),
      name: String(selectedReport?.name ?? "").trim()
    });
  };

  const closeDeleteReportModal = () => {
    if (isReportDeleting) {
      return;
    }
    setPendingReportDelete(null);
  };

  const confirmDeleteReport = async () => {
    const reportTemplateId = String(pendingReportDelete?.reportTemplateId ?? "").trim();
    if (!reportTemplateId || isReportDeleting) {
      return;
    }
    setIsReportDeleting(true);
    try {
      let response = await fetch(REPORT_TEMPLATE_MAIN_SETTINGS_API_PATH(reportTemplateId), {
        method: "DELETE"
      });
      if (response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_MAIN_SETTINGS_API_PATH(reportTemplateId), {
          method: "DELETE"
        });
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка удаления отчета");
        return;
      }
      setEmployees((prev) =>
        prev.filter((row) => String(row?.reportTemplateId ?? "").trim() !== reportTemplateId)
      );
      setPendingReportDelete(null);
      showSystemSuccessToast("Отчет удален");
      handleCloseReportCardPanel();
    } catch {
      showSystemErrorToast("Ошибка удаления отчета");
    } finally {
      setIsReportDeleting(false);
    }
  };

  const handleUploadReportTemplateJsonClick = () => {
    if (isReportTemplateSettingsSaving || isReportTemplateJsonEditMode) {
      return;
    }
    const fileInput = reportTemplateJsonFileInputRef.current;
    if (fileInput) {
      fileInput.value = "";
      fileInput.click();
    }
  };

  const handleIncreaseReportTemplateJsonZoom = () => {
    setReportTemplateJsonZoom((prev) => Math.min(1.6, Number((prev + 0.1).toFixed(2))));
  };

  const handleDecreaseReportTemplateJsonZoom = () => {
    setReportTemplateJsonZoom((prev) => Math.max(0.7, Number((prev - 0.1).toFixed(2))));
  };

  const handleDownloadReportTemplateJson = () => {
    if (isReportTemplateSettingsSaving || isReportTemplateJsonEditMode) {
      return;
    }
    const outputFileNameTemplate = String(
      selectedReport?.outputFileName ?? selectedReport?.output_file_name ?? "report"
    ).trim();
    const reportName = String(selectedReport?.name ?? "Отчет").trim() || "Отчет";
    const resolvedBaseName =
      resolveExportFileNameTemplate(outputFileNameTemplate, reportName) || "report";
    const reportOutputExtRaw = String(
      selectedReport?.outputFileType ?? selectedReport?.output_file_type ?? "xlsx"
    )
      .trim()
      .toLowerCase();
    const reportOutputExt = reportOutputExtRaw.replace(/[^a-z0-9]+/g, "") || "xlsx";
    const baseName = stripExpectedExtension(resolvedBaseName, reportOutputExt) || "report";
    const fileName = `${baseName}.json`;
    const jsonText = String(reportTemplateJsonInitial ?? "{}").trim() || "{}";
    const jsonBlob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(jsonBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  const handleReportTemplateJsonFileSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const fileName = String(file.name ?? "").toLowerCase();
    if (!fileName.endsWith(".json")) {
      showSystemErrorToast("Допускается загрузка только файла с расширением .json");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const rawText = String(reader.result ?? "");
      let parsedReportInfo;
      try {
        parsedReportInfo = JSON.parse(rawText);
      } catch (error) {
        const syntaxErrorMessage = String(error?.message ?? "").trim();
        showSystemErrorToast(
          syntaxErrorMessage
            ? `JSON содержит ошибки синтаксиса: ${syntaxErrorMessage}`
            : "JSON содержит ошибки синтаксиса"
        );
        return;
      }
      if (!parsedReportInfo || typeof parsedReportInfo !== "object" || Array.isArray(parsedReportInfo)) {
        showSystemErrorToast("JSON должен быть объектом");
        return;
      }
      const saved = await persistParsedReportTemplateJson(parsedReportInfo);
      if (!saved) {
        return;
      }
      setIsReportTemplateJsonEditMode(false);
      setReportTemplateJsonActiveLine(1);
      setReportTemplateJsonEditorScrollTop(0);
      showSystemSuccessToast("JSON загружен и сохранен");
    };
    reader.onerror = () => {
      showSystemErrorToast("Не удалось прочитать JSON-файл");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleReportTemplateJsonEditorSelect = (event) => {
    const editor = event.currentTarget;
    if (reportTemplateJsonCaretRafRef.current) {
      cancelAnimationFrame(reportTemplateJsonCaretRafRef.current);
    }
    reportTemplateJsonCaretRafRef.current = requestAnimationFrame(() => {
      const nextLine = resolveReportSqlCaretLine(editor.value, editor.selectionStart);
      setReportTemplateJsonActiveLine((prev) => (prev === nextLine ? prev : nextLine));
      const nextScrollTop = Math.max(0, Number(editor.scrollTop) || 0);
      setReportTemplateJsonEditorScrollTop((prev) => (prev === nextScrollTop ? prev : nextScrollTop));
      reportTemplateJsonCaretRafRef.current = 0;
    });
  };

  const handleReportTemplateJsonEditorScroll = (event) => {
    const editor = event.currentTarget;
    setReportTemplateJsonEditorScrollTop(Math.max(0, Number(editor.scrollTop) || 0));
  };

  const handleReportTemplateLogoSelect = (event) => {
    if (!isReportTemplateEditMode) {
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const isAllowedType =
      file.type === "image/jpeg" || file.type === "image/jpg" || file.type === "image/png";
    if (!isAllowedType) {
      showSystemErrorToast("Для логотипа допускаются только файлы JPG/PNG");
      event.target.value = "";
      return;
    }
    if (file.size > 1024 * 1024) {
      showSystemErrorToast("Размер логотипа не должен превышать 1 МБ");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64Part = result.includes(",") ? result.split(",")[1] : "";
      if (!base64Part) {
        showSystemErrorToast("Не удалось прочитать логотип");
        event.target.value = "";
        return;
      }
      setReportTemplateLogoBase64(base64Part);
      setReportTemplateLogoMimeType(file.type || "image/png");
      event.target.value = "";
    };
    reader.onerror = () => {
      showSystemErrorToast("Не удалось прочитать логотип");
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleClearReportTemplateLogo = () => {
    if (!isReportTemplateEditMode) {
      return;
    }
    setReportTemplateLogoBase64(null);
    setReportTemplateLogoMimeType(null);
  };

  const handleChangeReportTemplateSettingsFieldRow = (index, fieldName, value) => {
    setReportTemplateSettingsDraft((prev) => {
      const nextFields = Array.isArray(prev.fields) ? [...prev.fields] : [];
      if (!nextFields[index]) {
        return prev;
      }
      const currentField = nextFields[index];
      const currentVisible = isReportTemplateFieldVisible(currentField);
      if (fieldName !== "reportVisible" && !currentVisible) {
        return prev;
      }
      const nextField = { ...currentField, [fieldName]: value };
      if (fieldName === "reportVisible") {
        const nextVisible = Boolean(value);
        if (!nextVisible) {
          nextField.reportVisible = false;
          nextField.fieldOrderNumber = "";
          const fieldsWithoutCurrent = nextFields.filter((_, fieldIndex) => fieldIndex !== index);
          fieldsWithoutCurrent.push(nextField);
          return {
            ...prev,
            fields: fieldsWithoutCurrent
          };
        }
        const maxVisibleOrder = nextFields.reduce((maxOrder, item, itemIndex) => {
          if (itemIndex === index || !isReportTemplateFieldVisible(item)) {
            return maxOrder;
          }
          const parsedOrder = Number(item?.fieldOrderNumber);
          return Number.isFinite(parsedOrder) && parsedOrder > maxOrder ? parsedOrder : maxOrder;
        }, 0);
        nextField.reportVisible = true;
        nextField.fieldOrderNumber = String(maxVisibleOrder + 1);
        const fieldsWithoutCurrent = nextFields.filter((_, fieldIndex) => fieldIndex !== index);
        const firstInvisibleIndex = fieldsWithoutCurrent.findIndex(
          (item) => !isReportTemplateFieldVisible(item)
        );
        if (firstInvisibleIndex >= 0) {
          fieldsWithoutCurrent.splice(firstInvisibleIndex, 0, nextField);
        } else {
          fieldsWithoutCurrent.push(nextField);
        }
        return {
          ...prev,
          fields: fieldsWithoutCurrent
        };
      }
      if (fieldName === "fieldDataType") {
        const normalizedDataType = String(value ?? "").trim().toLowerCase();
        const availableFormats =
          REPORT_TEMPLATE_DATA_FORMAT_OPTIONS[normalizedDataType] ?? REPORT_TEMPLATE_DATA_FORMAT_OPTIONS.text;
        const currentFormat = String(nextField.fieldDataFormat ?? "").trim();
        if (!availableFormats.some((option) => option.value === currentFormat)) {
          nextField.fieldDataFormat = availableFormats[0]?.value ?? "";
        }
      }
      if (fieldName === "fieldAutoWidth" && Boolean(value)) {
        nextField.filedWidth = "";
      }
      if (fieldName === "filedWidth") {
        nextField.filedWidth = sanitizePositiveIntegerDraftValue(value);
      }
      nextFields[index] = nextField;
      return {
        ...prev,
        fields: nextFields
      };
    });
  };

  const loadReportTemplateSqlColumns = useCallback(
    async ({ showErrorToast = true } = {}) => {
      const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
      if (!reportTemplateId) {
        return null;
      }
      try {
        const columns = await loadSqlColumnsForReportTemplate(
          reportTemplateId,
          buildReportExecutionPayload(reportTemplateId)
        );
        const linkColumns = columns.filter((value) => /^LINK_/i.test(value));
        setReportTemplateLinkFieldOptions(linkColumns);
        return columns;
      } catch (error) {
        if (showErrorToast) {
          const message =
            error instanceof Error && String(error.message ?? "").trim()
              ? String(error.message)
              : "Не удалось получить поля SQL-скрипта";
          showSystemErrorToast(message);
        }
        return null;
      }
    },
    [buildReportExecutionPayload, selectedReportTemplateId, showSystemErrorToast]
  );

  const handleRefreshReportTemplateFieldsFromSql = async () => {
    if (!isReportTemplateEditMode || isReportTemplateSettingsSaving || isReportSqlEditMode) {
      return;
    }
    const allColumns = await loadReportTemplateSqlColumns({ showErrorToast: true });
    if (!allColumns) {
      return;
    }
    try {
      const reconciled = reconcileReportTemplateFieldsWithSqlColumns(
        reportTemplateSettingsDraft.fields,
        allColumns,
        { addMissing: true }
      );
      setReportTemplateSettingsDraft((prev) => ({
        ...prev,
        fields: reconciled.fields
      }));
      setReportTemplateJsonDraft((prevJsonText) => {
        let parsedJson;
        try {
          parsedJson = JSON.parse(String(prevJsonText ?? "{}"));
        } catch {
          parsedJson = {};
        }
        const nextJson =
          parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)
            ? { ...parsedJson, fields: reconciled.fields }
            : { fields: reconciled.fields };
        return stringifyReportTemplateJson(nextJson);
      });
      showSystemSuccessToast("Список полей обновлен из SQL-скрипта");
    } catch {
      showSystemErrorToast("Не удалось обновить список полей из SQL-скрипта");
    }
  };

  const handleSaveReportTemplateSettings = async () => {
    if (!isReportTemplateEditMode || isReportTemplateSettingsSaving) {
      return;
    }
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    if (!reportTemplateId) {
      showSystemErrorToast("Не удалось определить reportTemplateId");
      return;
    }
    const headerCaption = String(reportTemplateSettingsDraft.headerCaption ?? "").trim();
    if (!headerCaption) {
      showSystemErrorToast("Заголовок отчета не может быть пустым");
      return;
    }
    const numericFields = [
      { key: "headerFontSize", title: "Размер шрифта заголовка отчета" },
      { key: "heightTabCaption", title: "Высота табличного заголовка" },
      { key: "fontTabCaptionSize", title: "Размер шрифта табличного заголовка" },
      { key: "recordFontSize", title: "Размер шрифта записей таблицы" },
      { key: "startReportRow", title: "Номер начальной строки отчета" },
      { key: "startReportCol", title: "Номер начальной колонки отчета" }
    ];
    const normalizedNumbers = {};
    for (const field of numericFields) {
      const rawValue = String(reportTemplateSettingsDraft[field.key] ?? "").trim();
      if (!/^\d+$/.test(rawValue) || Number(rawValue) <= 0) {
        showSystemErrorToast(`Параметр "${field.title}" должен быть положительным числом`);
        return;
      }
      normalizedNumbers[field.key] = Number(rawValue);
    }
    const colorFields = [
      { key: "headerFontColor", title: "Цвет шрифта заголовка отчета" },
      { key: "backTabCaptionColor", title: "Цвет фона табличного заголовка" },
      { key: "fontTabCaptionColor", title: "Цвет шрифта табличного заголовка" }
    ];
    const normalizedColors = {};
    for (const field of colorFields) {
      const rawValue = String(reportTemplateSettingsDraft[field.key] ?? "")
        .trim()
        .toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(rawValue)) {
        showSystemErrorToast(`Параметр "${field.title}" должен быть в формате #RRGGBB`);
        return;
      }
      normalizedColors[field.key] = rawValue;
    }
    setIsReportTemplateSettingsSaving(true);
    try {
      const normalizedFields = Array.isArray(reportTemplateSettingsDraft.fields)
        ? reportTemplateSettingsDraft.fields.map((item, index) => normalizeReportTemplateField(item, index))
        : [];
      const sortedForSave = getSortedReportTemplateFieldDescriptors(normalizedFields);
      const visibleOrderBySourceIndex = new Map();
      let visibleOrder = 0;
      sortedForSave.forEach(({ field, sourceIndex }) => {
        if (!isReportTemplateFieldVisible(field)) {
          return;
        }
        visibleOrder += 1;
        visibleOrderBySourceIndex.set(sourceIndex, visibleOrder);
      });
      const payload = {
        reportInfo: {
          showLogoReport: Boolean(reportTemplateSettingsDraft.showLogoReport),
          headerCaption,
          headerFontSize: normalizedNumbers.headerFontSize,
          headerFontColor: normalizedColors.headerFontColor,
          heightTabCaption: normalizedNumbers.heightTabCaption,
          backTabCaptionColor: normalizedColors.backTabCaptionColor,
          fontTabCaptionColor: normalizedColors.fontTabCaptionColor,
          fontTabCaptionSize: normalizedNumbers.fontTabCaptionSize,
          startReportRow: normalizedNumbers.startReportRow,
          startReportCol: normalizedNumbers.startReportCol,
          filtrSet: Boolean(reportTemplateSettingsDraft.filtrSet),
          recordFontSize: normalizedNumbers.recordFontSize,
          fields: normalizedFields.map((item, index) => ({
            ...item,
            fieldOrderNumber: isReportTemplateFieldVisible(item)
              ? String(visibleOrderBySourceIndex.get(index) ?? "")
              : ""
          }))
        },
        reportLogoBase64: reportTemplateLogoBase64,
        clearReportLogo: !reportTemplateLogoBase64
      };
      let response = await fetch(REPORT_TEMPLATE_SETTINGS_API_PATH(reportTemplateId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(toCamelApiPayload(payload))
      });
      if (response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_SETTINGS_API_PATH(reportTemplateId), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(toCamelApiPayload(payload))
        });
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка сохранения настроек шаблона отчета");
        return;
      }
      const reportInfoFromApi =
        data?.item?.reportInfo && typeof data.item.reportInfo === "object" ? data.item.reportInfo : {};
      const payloadFields = Array.isArray(payload?.reportInfo?.fields) ? payload.reportInfo.fields : [];
      const apiFields = Array.isArray(reportInfoFromApi?.fields) ? reportInfoFromApi.fields : [];
      const apiFieldNames = new Set(
        apiFields.map((field) => String(field?.fieldName ?? "").trim()).filter(Boolean)
      );
      const shouldKeepPayloadFields =
        payloadFields.length > apiFields.length ||
        payloadFields.some((field) => {
          const fieldName = String(field?.fieldName ?? "").trim();
          return fieldName && !apiFieldNames.has(fieldName);
        });
      const savedReportInfo = {
        ...payload.reportInfo,
        ...reportInfoFromApi,
        fields: shouldKeepPayloadFields ? payloadFields : apiFields
      };
      const normalizedSavedSettings = normalizeReportTemplateSettings(
        savedReportInfo,
        selectedReport?.name ?? ""
      );
      setReportTemplateSettingsInitial(normalizedSavedSettings);
      setReportTemplateSettingsDraft(normalizedSavedSettings);
      setReportTemplateLogoInitialBase64(reportTemplateLogoBase64);
      setReportTemplateLogoInitialMimeType(reportTemplateLogoMimeType);
      const savedReportInfoJson = String(data?.item?.reportInfoJson ?? "").trim();
      setReportTemplateJsonInitial(savedReportInfoJson || stringifyReportTemplateJson(savedReportInfo));
      setReportTemplateJsonDraft(savedReportInfoJson || stringifyReportTemplateJson(savedReportInfo));
      setEmployees((prev) =>
        prev.map((row) =>
          String(row?.reportTemplateId ?? "").trim() === reportTemplateId
            ? { ...row, reportInfo: savedReportInfo, report_info: savedReportInfo }
            : row
        )
      );
      setSelectedReportSnapshot((prev) =>
        prev && String(prev?.reportTemplateId ?? "").trim() === reportTemplateId
          ? { ...prev, reportInfo: savedReportInfo, report_info: savedReportInfo }
          : prev
      );
      setIsReportTemplateEditMode(false);
      showSystemSuccessToast("Настройки шаблона отчета сохранены");
    } catch {
      showSystemErrorToast("Ошибка сохранения настроек шаблона отчета");
    } finally {
      setIsReportTemplateSettingsSaving(false);
    }
  };

  const handleSaveReportTemplateJson = async () => {
    if (!isReportTemplateJsonEditMode || isReportTemplateSettingsSaving) {
      return;
    }
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    if (!reportTemplateId) {
      showSystemErrorToast("Не удалось определить reportTemplateId");
      return;
    }
    let parsedReportInfo;
    try {
      parsedReportInfo = JSON.parse(String(reportTemplateJsonDraft ?? "{}"));
    } catch (error) {
      const syntaxErrorMessage = String(error?.message ?? "").trim();
      showSystemErrorToast(
        syntaxErrorMessage
          ? `JSON содержит ошибки синтаксиса: ${syntaxErrorMessage}`
          : "JSON содержит ошибки синтаксиса"
      );
      return;
    }
    if (!parsedReportInfo || typeof parsedReportInfo !== "object" || Array.isArray(parsedReportInfo)) {
      showSystemErrorToast("JSON должен быть объектом");
      return;
    }
    const saved = await persistParsedReportTemplateJson(parsedReportInfo);
    if (!saved) {
      return;
    }
    setIsReportTemplateJsonEditMode(false);
    setReportTemplateJsonActiveLine(1);
    setReportTemplateJsonEditorScrollTop(0);
    showSystemSuccessToast("Настройки шаблона отчета сохранены");
  };

  const handleDeleteReportOrganization = async (organUnitId) => {
    if (
      deletingReportOrganizationId ||
      deletingReportAccessGroupCode ||
      deletingReportRecipientEmail
    ) {
      return;
    }
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    const normalizedOrganUnitId = String(organUnitId ?? "").trim();
    if (!reportTemplateId || !normalizedOrganUnitId) {
      showSystemErrorToast("Не удалось определить связь отчета с организацией");
      return;
    }
    setDeletingReportOrganizationId(normalizedOrganUnitId);
    try {
      let response = await fetch(
        REPORT_TEMPLATE_ORGANIZATION_DELETE_API_PATH(reportTemplateId, normalizedOrganUnitId),
        { method: "DELETE" }
      );
      if (response.status === 404) {
        response = await fetch(
          REPORT_TEMPLATES_ORGANIZATION_DELETE_API_PATH(reportTemplateId, normalizedOrganUnitId),
          { method: "DELETE" }
        );
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка удаления связи с организацией");
        return;
      }
      const applyUpdate = (row) => {
        if (String(row?.reportTemplateId ?? "").trim() !== reportTemplateId) {
          return row;
        }
        const nextOrganizations = (Array.isArray(row?.organizations) ? row.organizations : []).filter(
          (item) => String(item?.organUnitId ?? "").trim() !== normalizedOrganUnitId
        );
        return { ...row, organizations: nextOrganizations };
      };
      setEmployees((prev) => prev.map((row) => applyUpdate(row)));
      setSelectedReportSnapshot((prev) => (prev ? applyUpdate(prev) : prev));
      showSystemSuccessToast("Связь с организацией удалена");
    } catch {
      showSystemErrorToast("Ошибка удаления связи с организацией");
    } finally {
      setDeletingReportOrganizationId("");
    }
  };

  const fetchReportOrganizationOptions = async (filterValue = "") => {
    const normalizedSearch = String(filterValue ?? "").trim();
    setAddingReportOrganization(true);
    try {
      const params = new URLSearchParams({
        showShortCode: "true"
      });
      if (normalizedSearch) {
        params.set("organName", normalizedSearch);
      }
      const response = await fetch(`${LIST_ORGANIZATIONS_API_URL}?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Не удалось получить список организаций");
        return;
      }
      const items = (Array.isArray(data?.items) ? data.items : [])
        .map((item) => {
          const baseName = normalizeUiText(item?.shName);
          const sapId = normalizeUiText(item?.sapId);
          const inn = normalizeUiText(item?.inn);
          const kpp = normalizeUiText(item?.kpp);
          const ogrn = normalizeUiText(item?.ogrn);
          const fullAddress = normalizeUiText(item?.fullAddress);
          return {
            organUnitId: String(item?.id ?? "").trim(),
            organUnitName: sapId ? `${baseName} (${sapId})` : baseName,
            fieldName: baseName,
            sapId,
            inn,
            kpp,
            ogrn,
            fullAddress
          };
        })
        .filter((item) => item.organUnitId && item.organUnitName);
      setReportOrganizationOptions(items);
      const selectedExists = items.some(
        (item) => item.organUnitId === String(selectedReportOrganizationIdForAdd ?? "").trim()
      );
      if (!selectedExists) {
        setSelectedReportOrganizationIdForAdd("");
      }
    } catch {
      showSystemErrorToast("Не удалось получить список организаций");
    } finally {
      setAddingReportOrganization(false);
    }
  };

  const handleOpenReportOrganizationAdd = () => {
    setIsReportOrganizationAddMode(true);
    setIsReportOrganizationComboOpen(true);
    if (!reportOrganizationOptions.length) {
      void fetchReportOrganizationOptions("");
    }
  };

  const handleCancelReportOrganizationAdd = () => {
    setIsReportOrganizationAddMode(false);
    setIsReportOrganizationComboOpen(false);
    setReportOrganizationSearch("");
    setReportOrganizationOptions([]);
    setSelectedReportOrganizationIdForAdd("");
  };

  const handleAddReportOrganization = async () => {
    if (
      addingReportOrganization ||
      deletingReportOrganizationId ||
      deletingReportAccessGroupCode ||
      deletingReportRecipientEmail
    ) {
      return;
    }
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    const organUnitId = String(selectedReportOrganizationIdForAdd ?? "").trim();
    if (!reportTemplateId || !organUnitId) {
      showSystemErrorToast("Выберите организацию для добавления");
      return;
    }
    const duplicateExists = selectedReportOrganizations.some(
      (item) => String(item?.organUnitId ?? "").trim() === organUnitId
    );
    if (duplicateExists) {
      showSystemErrorToast("Связь Отчет-Организация уже существует");
      return;
    }
    setAddingReportOrganization(true);
    try {
      let response = await fetch(REPORT_TEMPLATE_ORGANIZATION_ADD_API_PATH(reportTemplateId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(toCamelApiPayload({ organUnitId }))
      });
      if (response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_ORGANIZATION_ADD_API_PATH(reportTemplateId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(toCamelApiPayload({ organUnitId }))
        });
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка добавления связи с организацией");
        return;
      }
      const addedItemRaw = data?.item ?? {};
      const addedItem = {
        organUnitId: String(addedItemRaw?.organUnitId ?? organUnitId).trim(),
        organUnitName: String(addedItemRaw?.organUnitName ?? "").trim()
      };
      const applyUpdate = (row) => {
        if (String(row?.reportTemplateId ?? "").trim() !== reportTemplateId) {
          return row;
        }
        const current = Array.isArray(row?.organizations) ? row.organizations : [];
        const exists = current.some(
          (item) => String(item?.organUnitId ?? "").trim() === addedItem.organUnitId
        );
        return exists ? row : { ...row, organizations: [...current, addedItem] };
      };
      setEmployees((prev) => prev.map((row) => applyUpdate(row)));
      setSelectedReportSnapshot((prev) => (prev ? applyUpdate(prev) : prev));
      setIsReportOrganizationComboOpen(false);
      setIsReportOrganizationAddMode(false);
      setReportOrganizationSearch("");
      setReportOrganizationOptions([]);
      setSelectedReportOrganizationIdForAdd("");
      showSystemSuccessToast("Связь с организацией добавлена");
    } catch {
      showSystemErrorToast("Ошибка добавления связи с организацией");
    } finally {
      setAddingReportOrganization(false);
    }
  };

  const handleDeleteReportAccessGroup = async (codeAccess) => {
    if (
      deletingReportOrganizationId ||
      deletingReportAccessGroupCode ||
      deletingReportRecipientEmail
    ) {
      return;
    }
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    const normalizedCodeAccess = String(codeAccess ?? "").trim();
    if (!reportTemplateId || !normalizedCodeAccess) {
      showSystemErrorToast("Не удалось определить группу доступа");
      return;
    }
    setDeletingReportAccessGroupCode(normalizedCodeAccess);
    try {
      let response = await fetch(
        REPORT_TEMPLATE_ACCESS_GROUP_DELETE_API_PATH(reportTemplateId, normalizedCodeAccess),
        { method: "DELETE" }
      );
      if (response.status === 404) {
        response = await fetch(
          REPORT_TEMPLATES_ACCESS_GROUP_DELETE_API_PATH(reportTemplateId, normalizedCodeAccess),
          { method: "DELETE" }
        );
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка удаления группы доступа");
        return;
      }
      const applyUpdate = (row) => {
        if (String(row?.reportTemplateId ?? "").trim() !== reportTemplateId) {
          return row;
        }
        const nextAccessGroups = (Array.isArray(row?.accessGroups) ? row.accessGroups : []).filter(
          (item) => String(item?.codeAccess ?? "").trim() !== normalizedCodeAccess
        );
        return { ...row, accessGroups: nextAccessGroups };
      };
      setEmployees((prev) => prev.map((row) => applyUpdate(row)));
      setSelectedReportSnapshot((prev) => (prev ? applyUpdate(prev) : prev));
      showSystemSuccessToast("Группа доступа удалена");
    } catch {
      showSystemErrorToast("Ошибка удаления группы доступа");
    } finally {
      setDeletingReportAccessGroupCode("");
    }
  };

  const handleOpenReportAccessGroupAdd = () => {
    setIsReportAccessGroupAddMode(true);
    setNewReportAccessGroupCode(REPORT_ACCESS_GROUP_ENUM[0]);
  };

  const handleCancelReportAccessGroupAdd = () => {
    setIsReportAccessGroupAddMode(false);
    setNewReportAccessGroupCode(REPORT_ACCESS_GROUP_ENUM[0]);
  };

  const handleAddReportAccessGroup = async () => {
    if (
      addingReportAccessGroup ||
      deletingReportOrganizationId ||
      deletingReportAccessGroupCode ||
      deletingReportRecipientEmail
    ) {
      return;
    }
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    const codeAccess = String(newReportAccessGroupCode ?? "").trim();
    if (!reportTemplateId || !codeAccess) {
      showSystemErrorToast("Укажите код группы доступа");
      return;
    }
    if (!REPORT_ACCESS_GROUP_ENUM.includes(codeAccess)) {
      showSystemErrorToast("Код группы доступа должен быть из списка GRP01-GRP10");
      return;
    }
    const duplicateExists = selectedReportAccessGroups.some(
      (item) => String(item?.codeAccess ?? "").trim() === codeAccess
    );
    if (duplicateExists) {
      showSystemErrorToast("Связь Отчет-Группа доступа уже существует");
      return;
    }
    setAddingReportAccessGroup(true);
    try {
      let response = await fetch(REPORT_TEMPLATE_ACCESS_GROUP_ADD_API_PATH(reportTemplateId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(toCamelApiPayload({ codeAccess }))
      });
      if (response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_ACCESS_GROUP_ADD_API_PATH(reportTemplateId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(toCamelApiPayload({ codeAccess }))
        });
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка добавления группы доступа");
        return;
      }
      const addedCode = String(data?.item?.codeAccess ?? codeAccess).trim();
      const applyUpdate = (row) => {
        if (String(row?.reportTemplateId ?? "").trim() !== reportTemplateId) {
          return row;
        }
        const current = Array.isArray(row?.accessGroups) ? row.accessGroups : [];
        const exists = current.some(
          (item) => String(item?.codeAccess ?? "").trim() === addedCode
        );
        return exists ? row : { ...row, accessGroups: [...current, { codeAccess: addedCode }] };
      };
      setEmployees((prev) => prev.map((row) => applyUpdate(row)));
      setSelectedReportSnapshot((prev) => (prev ? applyUpdate(prev) : prev));
      setIsReportAccessGroupAddMode(false);
      setNewReportAccessGroupCode(REPORT_ACCESS_GROUP_ENUM[0]);
      showSystemSuccessToast("Группа доступа добавлена");
    } catch {
      showSystemErrorToast("Ошибка добавления группы доступа");
    } finally {
      setAddingReportAccessGroup(false);
    }
  };

  const handleOpenReportRecipientAdd = () => {
    setIsReportRecipientAddMode(true);
    setNewReportRecipientEmail("");
  };

  const handleCancelReportRecipientAdd = () => {
    setIsReportRecipientAddMode(false);
    setNewReportRecipientEmail("");
  };

  const handleAddReportRecipient = async () => {
    if (
      addingReportRecipient ||
      deletingReportOrganizationId ||
      deletingReportAccessGroupCode ||
      deletingReportRecipientEmail
    ) {
      return;
    }
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    const email = String(newReportRecipientEmail ?? "").trim().toLowerCase();
    if (!reportTemplateId || !email) {
      showSystemErrorToast("Укажите email получателя отчета");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      showSystemErrorToast("Укажите корректный email");
      return;
    }
    const duplicateExists = selectedReportRecipients.some(
      (item) => String(item?.email ?? "").trim().toLowerCase() === email
    );
    if (duplicateExists) {
      showSystemErrorToast("Такой email для данного отчета уже добавлен");
      return;
    }
    setAddingReportRecipient(true);
    try {
      let response = await fetch(REPORT_TEMPLATE_RECIPIENT_ADD_API_PATH(reportTemplateId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(toCamelApiPayload({ email }))
      });
      if (response.status === 404) {
        response = await fetch(REPORT_TEMPLATES_RECIPIENT_ADD_API_PATH(reportTemplateId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(toCamelApiPayload({ email }))
        });
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка добавления получателя отчета");
        return;
      }
      const addedEmail = String(data?.item?.email ?? email).trim().toLowerCase();
      const applyUpdate = (row) => {
        if (String(row?.reportTemplateId ?? "").trim() !== reportTemplateId) {
          return row;
        }
        const current = Array.isArray(row?.recipients) ? row.recipients : [];
        const exists = current.some(
          (item) => String(item?.email ?? "").trim().toLowerCase() === addedEmail
        );
        return exists ? row : { ...row, recipients: [...current, { email: addedEmail }] };
      };
      setEmployees((prev) => prev.map((row) => applyUpdate(row)));
      setSelectedReportSnapshot((prev) => (prev ? applyUpdate(prev) : prev));
      setIsReportRecipientAddMode(false);
      setNewReportRecipientEmail("");
      showSystemSuccessToast("Получатель отчета добавлен");
    } catch {
      showSystemErrorToast("Ошибка добавления получателя отчета");
    } finally {
      setAddingReportRecipient(false);
    }
  };

  const handleDeleteReportRecipient = async (email) => {
    if (
      deletingReportOrganizationId ||
      deletingReportAccessGroupCode ||
      deletingReportRecipientEmail
    ) {
      return;
    }
    const reportTemplateId = String(selectedReportTemplateId ?? "").trim();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!reportTemplateId || !normalizedEmail) {
      showSystemErrorToast("Не удалось определить получателя отчета");
      return;
    }
    setDeletingReportRecipientEmail(normalizedEmail);
    try {
      let response = await fetch(
        REPORT_TEMPLATE_RECIPIENT_DELETE_API_PATH(reportTemplateId, normalizedEmail),
        { method: "DELETE" }
      );
      if (response.status === 404) {
        response = await fetch(
          REPORT_TEMPLATES_RECIPIENT_DELETE_API_PATH(reportTemplateId, normalizedEmail),
          { method: "DELETE" }
        );
      }
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Ошибка удаления получателя отчета");
        return;
      }
      const applyUpdate = (row) => {
        if (String(row?.reportTemplateId ?? "").trim() !== reportTemplateId) {
          return row;
        }
        const nextRecipients = (Array.isArray(row?.recipients) ? row.recipients : []).filter(
          (item) => String(item?.email ?? "").trim().toLowerCase() !== normalizedEmail
        );
        return { ...row, recipients: nextRecipients };
      };
      setEmployees((prev) => prev.map((row) => applyUpdate(row)));
      setSelectedReportSnapshot((prev) => (prev ? applyUpdate(prev) : prev));
      showSystemSuccessToast("Получатель отчета удален");
    } catch {
      showSystemErrorToast("Ошибка удаления получателя отчета");
    } finally {
      setDeletingReportRecipientEmail("");
    }
  };

  const handleReportSqlResultsScroll = (event) => {
    if (reportSqlViewMode !== REPORT_SQL_VIEW_MODES.RESULTS) {
      return;
    }
    if (isReportSqlResultsLoading || isReportSqlResultsLoadingMore || !reportSqlResultsHasMore) {
      return;
    }
    const node = event.currentTarget;
    const nextScrollTop = Math.max(0, Number(node.scrollTop) || 0);
    const previousScrollTop = reportSqlResultsLastScrollTopRef.current;
    reportSqlResultsLastScrollTopRef.current = nextScrollTop;
    if (nextScrollTop <= previousScrollTop) {
      return;
    }
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 60) {
      void loadReportSqlResults({ reset: false });
    }
  };

  const handleIncreaseReportSqlZoom = () => {
    setReportSqlZoom((prev) => Math.min(1.6, Number((prev + 0.1).toFixed(2))));
  };

  const handleDecreaseReportSqlZoom = () => {
    setReportSqlZoom((prev) => Math.max(0.7, Number((prev - 0.1).toFixed(2))));
  };

  const handleReportSqlEditorScroll = () => {
    if (!reportSqlEditorRef.current || !reportSqlHighlightRef.current) {
      return;
    }
    const nextScrollTop = reportSqlEditorRef.current.scrollTop;
    reportSqlHighlightRef.current.scrollTop = nextScrollTop;
    reportSqlHighlightRef.current.scrollLeft = reportSqlEditorRef.current.scrollLeft;
    if (reportSqlGutterRef.current) {
      reportSqlGutterRef.current.scrollTop = nextScrollTop;
    }
    setReportSqlEditorScrollTop(nextScrollTop);
  };

  const resolveReportSqlCaretLine = (value, selectionStart) => {
    const sqlText = String(value ?? "");
    const safeSelection = Number.isFinite(selectionStart)
      ? Math.max(0, Math.min(Number(selectionStart), sqlText.length))
      : sqlText.length;
    let lineNumber = 1;
    for (let index = 0; index < safeSelection; index += 1) {
      if (sqlText[index] === "\n") {
        lineNumber += 1;
      }
    }
    return lineNumber;
  };

  const resolveReportSqlCaretInfo = (value, selectionStart) => {
    const sqlText = String(value ?? "");
    const safeSelection = Number.isFinite(selectionStart)
      ? Math.max(0, Math.min(Number(selectionStart), sqlText.length))
      : sqlText.length;
    let line = 1;
    let column = 1;
    for (let index = 0; index < safeSelection; index += 1) {
      if (sqlText[index] === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    return {
      line,
      column,
      position: safeSelection + 1
    };
  };

  const getReportSqlLineStartIndex = (value, lineNumber) => {
    const sqlText = String(value ?? "");
    const targetLine = Math.max(1, Number(lineNumber) || 1);
    if (targetLine <= 1) {
      return 0;
    }
    let currentLine = 1;
    for (let index = 0; index < sqlText.length; index += 1) {
      if (sqlText[index] !== "\n") {
        continue;
      }
      currentLine += 1;
      if (currentLine === targetLine) {
        return index + 1;
      }
    }
    return sqlText.length;
  };

  const handleReportSqlGutterClick = (event) => {
    if (!reportSqlEditorRef.current) {
      return;
    }
    const editor = reportSqlEditorRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickOffsetY = event.clientY - rect.top;
    const rawLine =
      Math.floor(
        (clickOffsetY + editor.scrollTop - REPORT_SQL_EDITOR_PADDING_PX) /
          reportSqlLineHeightPx
      ) + 1;
    const totalLines = Math.max(1, String(reportSqlDraft ?? "").split("\n").length);
    const targetLine = Math.max(1, Math.min(rawLine, totalLines));
    const caretPosition = getReportSqlLineStartIndex(reportSqlDraft, targetLine);
    editor.focus();
    editor.setSelectionRange(caretPosition, caretPosition);
    updateReportSqlActiveLineFromTarget(editor);
  };

  const updateReportSqlActiveLineFromTarget = (target) => {
    if (!target) {
      return;
    }
    const lineNumber = resolveReportSqlCaretLine(target.value, target.selectionStart);
    const caretInfo = resolveReportSqlCaretInfo(target.value, target.selectionStart);
    setReportSqlActiveLine(lineNumber);
    setReportSqlCaretInfo(caretInfo);
  };

  const handleEditOrSaveReportSql = async () => {
    if (!isReportSqlEditMode) {
      setIsReportSqlEditMode(true);
      setReportSqlDraft(reportSqlText);
      setReportSqlActiveLine(1);
      setReportSqlCaretInfo({
        line: 1,
        column: 1,
        position: 1
      });
      setReportSqlEditorScrollTop(0);
      return;
    }

    const reportTemplateId = String(
      selectedReportTemplateId ??
        selectedReport?.reportTemplateId ??
        selectedReport?.report_template_id ??
        selectedReport?.id ??
        ""
    ).trim();
    if (!reportTemplateId) {
      showSystemErrorToast("Не удалось определить reportTemplateId");
      return;
    }
    const normalizedSql = String(reportSqlDraft ?? "").trim();
    if (normalizedSql) {
      const isSqlValid = await checkReportSqlSyntax(normalizedSql, {
        showSuccessToast: false,
        showErrorToast: true
      });
      if (!isSqlValid) {
        return;
      }
    }

    try {
      let response = await fetch(`${ADMIN_API_BASE_URL}/report-template/${reportTemplateId}/sql`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          toCamelApiPayload({
            sqlQuery: normalizedSql,
            ...buildReportExecutionPayload(reportTemplateId)
          })
        )
      });
      if (response.status === 404) {
        response = await fetch(`${ADMIN_API_BASE_URL}/report-templates/${reportTemplateId}/sql`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            toCamelApiPayload({
              sqlQuery: normalizedSql,
              ...buildReportExecutionPayload(reportTemplateId)
            })
          )
        });
      }
      const data = await response.json();
      if (!response.ok) {
        const rawError =
          response.status === 404
            ? "Метод сохранения SQL не найден на backend. Перезапустите backend."
            : data.error ?? "Не удалось сохранить SQL-скрипт";
        const normalizedError = normalizeReportSqlError(rawError, normalizedSql);
        setReportSqlValidationState("error");
        setReportSqlErrorDetails(normalizedError);
        showSystemErrorToast(`SQL-скрипт содержит ошибки - ${normalizedError}`);
        return;
      }

      const savedSql = String(
        data?.item?.sqlQuery ?? data?.item?.sql_query ?? normalizedSql
      ).trim();
      setEmployees((prev) =>
        prev.map((row) =>
          String(row?.reportTemplateId ?? "").trim() === reportTemplateId
            ? { ...row, sqlQuery: savedSql, sql_query: savedSql }
            : row
        )
      );
      setSelectedReportSnapshot((prev) =>
        prev && String(prev?.reportTemplateId ?? "").trim() === reportTemplateId
          ? { ...prev, sqlQuery: savedSql, sql_query: savedSql }
          : prev
      );
      setReportSqlDraft(savedSql);
      setIsReportSqlEditMode(false);
      setReportSqlValidationState("success");
      setReportSqlErrorDetails("");
      setReportSqlActiveLine(1);
      setReportSqlEditorScrollTop(0);
      lastAutoValidatedReportSqlRef.current = `${reportTemplateId}::${savedSql}`;
      refreshEmployeesList();
      showSystemSuccessToast("SQL-скрипт корректный");
    } catch {
      const message = "Не удалось сохранить SQL-скрипт";
      setReportSqlValidationState("error");
      setReportSqlErrorDetails(message);
      showSystemErrorToast(`SQL-скрипт содержит ошибки - ${message}`);
    }
  };

  const handleCancelReportSqlEdit = () => {
    setReportSqlDraft(reportSqlText);
    setIsReportSqlEditMode(false);
    setReportSqlActiveLine(1);
    setReportSqlCaretInfo({
      line: 1,
      column: 1,
      position: 1
    });
    setReportSqlEditorScrollTop(0);
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
    if (employeeCardCloseCleanupTimeoutRef.current) {
      window.clearTimeout(employeeCardCloseCleanupTimeoutRef.current);
      employeeCardCloseCleanupTimeoutRef.current = 0;
    }
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
    startEmployeeCardListTransition();
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
        isCreateMode ? `${ADMIN_API_BASE_URL}/employee` : `${ADMIN_API_BASE_URL}/employee/${employeeId}`,
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

  const startOrganizationCardEditMode = () => {
    if (!selectedOrganization) {
      return;
    }
    setOrganizationCardEditForm(getOrganizationCardEditFormFromOrganization(selectedOrganization));
    setIsOrganizationCardEditMode(true);
    setActiveOrganizationEditCombo(null);
    setOrganizationTypeEditFilter("");
    setCountryEditFilter("");
    setOrganizationEditComboMenuLayouts({});
    setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN);
  };

  const cancelOrganizationCardEditMode = () => {
    setIsOrganizationCardEditMode(false);
    setActiveOrganizationEditCombo(null);
    setOrganizationTypeEditFilter("");
    setCountryEditFilter("");
    setOrganizationEditComboMenuLayouts({});
    setOrganizationCardEditForm(INITIAL_ORGANIZATION_CARD_EDIT_FORM);
  };

  const saveOrganizationCardMainInfo = async () => {
    const organizationId = String(
      selectedOrganization?.organUnitId ??
        selectedOrganization?.organ_unit_id ??
        selectedOrganizationId ??
        ""
    ).trim();
    if (!organizationId) {
      showSystemErrorToast("Не удалось определить organUnitId");
      return;
    }

    const selectedTypeIds = Array.from(
      new Set(
        (Array.isArray(organizationCardEditForm.organUnitTypeIds)
          ? organizationCardEditForm.organUnitTypeIds
          : []
        )
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      )
    );

    const payload = toCamelApiPayload({
      sapId: String(organizationCardEditForm.sapId ?? "").trim() || null,
      inn: String(organizationCardEditForm.inn ?? "").trim() || null,
      kpp: String(organizationCardEditForm.kpp ?? "").trim() || null,
      name: String(organizationCardEditForm.name ?? "").trim() || null,
      shName: String(organizationCardEditForm.shName ?? "").trim() || null,
      ogrn: String(organizationCardEditForm.ogrn ?? "").trim() || null,
      okpo: String(organizationCardEditForm.okpo ?? "").trim() || null,
      shortCode: String(organizationCardEditForm.shortCode ?? "").trim() || null,
      signResident: String(organizationCardEditForm.signResident ?? "").trim().toUpperCase() === "ДА" ? "ДА" : "НЕТ",
      countryId: String(organizationCardEditForm.countryId ?? "").trim() || null,
      organUnitTypeIds: selectedTypeIds,
      address: String(organizationCardEditForm.address ?? "").trim() || null,
      kcehNumber: String(organizationCardEditForm.kcehNumber ?? "").trim() || null,
      claimPrefix: String(organizationCardEditForm.claimPrefix ?? "").trim() || null,
      fastTrack:
        String(organizationCardEditForm.fastTrack ?? "").trim().toUpperCase() === "ДА"
          ? "ДА"
          : String(organizationCardEditForm.fastTrack ?? "").trim().toUpperCase() === "НЕТ"
            ? "НЕТ"
            : null
    });

    try {
      const response = await fetch(ORGANIZATION_UPDATE_API_PATH(encodeURIComponent(organizationId)), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        showSystemErrorToast(data?.error ?? "Не удалось сохранить организацию");
        return;
      }
      const item = data?.item && typeof data.item === "object" ? data.item : null;
      if (item) {
        setSelectedOrganizationSnapshot(item);
        setEmployees((prev) =>
          prev.map((row) => {
            const rowId = String(row?.organUnitId ?? row?.organ_unit_id ?? row?.id ?? "").trim();
            return rowId === organizationId ? { ...row, ...item } : row;
          })
        );
      }
      setIsOrganizationCardEditMode(false);
      setActiveOrganizationEditCombo(null);
      setOrganizationTypeEditFilter("");
      setCountryEditFilter("");
      setOrganizationEditComboMenuLayouts({});
      setOrganizationCardEditForm(INITIAL_ORGANIZATION_CARD_EDIT_FORM);
      refreshEmployeesList();
      showSystemSuccessToast("Карточка организации сохранена");
    } catch {
      showSystemErrorToast("Не удалось сохранить организацию");
    }
  };

  const refreshOrganizationDadata = async (options = {}) => {
    const suppressErrors = Boolean(options?.suppressErrors);
    const organizationId = String(
      selectedOrganization?.organUnitId ??
        selectedOrganization?.organ_unit_id ??
        selectedOrganization?.id ??
        selectedOrganizationId ??
        ""
    ).trim();
    if (!organizationId) {
      if (!suppressErrors) {
        showSystemErrorToast("Не удалось определить organUnitId");
      }
      return;
    }
    organizationDadataAutoRefreshAttemptedRef.current.add(organizationId);

    setIsOrganizationDadataRefreshing(true);
    try {
      const response = await fetch(ORGANIZATION_DADATA_REFRESH_API_PATH(encodeURIComponent(organizationId)), {
        method: "POST"
      });
      const data = await response.json();
      if (!response.ok) {
        if (!suppressErrors) {
          showSystemErrorToast(data?.error ?? "Не удалось обновить данные DaData");
        }
        return;
      }
      const dataInfo = data?.dataInfo && typeof data.dataInfo === "object" ? data.dataInfo : {};
      const item = data?.item && typeof data.item === "object" ? data.item : {};
      setSelectedOrganizationSnapshot((prev) => ({
        ...(prev && typeof prev === "object" ? prev : {}),
        dataInfo,
        data_info: dataInfo,
        ...item
      }));
      showSystemSuccessToast("Данные DaData обновлены");
    } catch {
      if (!suppressErrors) {
        showSystemErrorToast("Не удалось обновить данные DaData");
      }
    } finally {
      setIsOrganizationDadataRefreshing(false);
    }
  };
  const toggleOrganizationDadataSection = useCallback((sectionKey) => {
    setOrganizationDadataCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !Boolean(prev?.[sectionKey])
    }));
  }, []);
  const toggleDadataAttributeVisibility = useCallback((attributeKey) => {
    const normalizedKey = String(attributeKey ?? "").trim();
    if (!normalizedKey) {
      return;
    }
    setDadataHiddenAttributes((prev) => {
      const next = { ...(prev && typeof prev === "object" ? prev : {}) };
      if (next[normalizedKey]) {
        delete next[normalizedKey];
      } else {
        next[normalizedKey] = true;
      }
      return next;
    });
  }, []);
  const handleSelectDadataRow = useCallback((section, rowKey) => {
    const sectionKey = section === "address" ? "address" : "company";
    const normalizedRowKey = normalizeDadataOrderKey(rowKey);
    setSelectedDadataRowBySection((prev) => ({
      ...(prev && typeof prev === "object" ? prev : { company: "", address: "" }),
      [sectionKey]: normalizedRowKey
    }));
  }, []);
  const stopDadataDragAutoScroll = useCallback(() => {
    const state = dadataDragAutoScrollStateRef.current;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    state.rafId = 0;
    state.wrapper = null;
    state.direction = 0;
    state.speed = 0;
  }, []);
  const getDragClientY = useCallback((event) => {
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
  const updateDadataDragAutoScroll = useCallback(
    (section, clientY) => {
      if (!Number.isFinite(clientY)) {
        return;
      }
      const wrapper =
        section === "address"
          ? organizationDadataAddressTableWrapperRef.current
          : organizationDadataCompanyTableWrapperRef.current;
      if (!(wrapper instanceof HTMLElement)) {
        return;
      }
      const bounds = wrapper.getBoundingClientRect();
      const edgeThresholdPx = 128;
      const outsideBoostDistancePx = 320;
      let direction = 0;
      let speed = 0;
      if (clientY < bounds.top + edgeThresholdPx) {
        direction = -1;
        const outsideDistance = Math.max(0, bounds.top - clientY);
        if (outsideDistance > 0) {
          const outsideRatio = Math.min(1, outsideDistance / outsideBoostDistancePx);
          speed = Math.ceil(420 + outsideRatio * 900);
        } else {
          const insideRatio = Math.min(
            1,
            Math.max(0, (bounds.top + edgeThresholdPx - clientY) / edgeThresholdPx)
          );
          speed = Math.ceil(140 + insideRatio * 420);
        }
      } else if (clientY > bounds.bottom - edgeThresholdPx) {
        direction = 1;
        const outsideDistance = Math.max(0, clientY - bounds.bottom);
        if (outsideDistance > 0) {
          const outsideRatio = Math.min(1, outsideDistance / outsideBoostDistancePx);
          speed = Math.ceil(420 + outsideRatio * 900);
        } else {
          const insideRatio = Math.min(
            1,
            Math.max(0, (clientY - (bounds.bottom - edgeThresholdPx)) / edgeThresholdPx)
          );
          speed = Math.ceil(140 + insideRatio * 420);
        }
      }
      speed = Math.min(1500, Math.max(0, speed));
      const state = dadataDragAutoScrollStateRef.current;
      state.wrapper = wrapper;
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
        const activeState = dadataDragAutoScrollStateRef.current;
        if (
          !activeState.rafId ||
          !(activeState.wrapper instanceof HTMLElement)
        ) {
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
    []
  );
  const handleDadataRowDragStart = useCallback((section, rowKey, event) => {
    const normalizedRowKey = normalizeDadataOrderKey(rowKey);
    if (!normalizedRowKey) {
      return;
    }
    dadataDraggingSectionRef.current = section === "address" ? "address" : "company";
    setDadataDraggingRowKey(normalizedRowKey);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", normalizedRowKey);
    }
    const startClientY = getDragClientY(event);
    if (Number.isFinite(startClientY)) {
      updateDadataDragAutoScroll(dadataDraggingSectionRef.current, startClientY);
    }
  }, [getDragClientY, updateDadataDragAutoScroll]);
  const handleDadataRowDrag = useCallback(
    (section, event) => {
      dadataDraggingSectionRef.current = section === "address" ? "address" : "company";
      const clientY = getDragClientY(event);
      if (!Number.isFinite(clientY)) {
        return;
      }
      updateDadataDragAutoScroll(section, clientY);
    },
    [getDragClientY, updateDadataDragAutoScroll]
  );
  const handleDadataRowDragOver = useCallback((section, event) => {
    event.preventDefault();
    dadataDraggingSectionRef.current = section === "address" ? "address" : "company";
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    const clientY = getDragClientY(event);
    if (Number.isFinite(clientY)) {
      updateDadataDragAutoScroll(section, clientY);
    }
  }, [getDragClientY, updateDadataDragAutoScroll]);
  const handleDadataRowDragEnd = useCallback(() => {
    dadataDraggingSectionRef.current = "";
    stopDadataDragAutoScroll();
    setDadataDraggingRowKey("");
  }, [stopDadataDragAutoScroll]);
  const handleDadataRowDrop = useCallback((section, targetRowKey, visibleRows, event) => {
    event.preventDefault();
    dadataDraggingSectionRef.current = "";
    stopDadataDragAutoScroll();
    const normalizedTargetRowKey = normalizeDadataOrderKey(targetRowKey);
    const sourceRowKey = normalizeDadataOrderKey(event?.dataTransfer?.getData("text/plain"));
    if (!sourceRowKey || !normalizedTargetRowKey || sourceRowKey === normalizedTargetRowKey) {
      setDadataDraggingRowKey("");
      return;
    }
    const sectionKey = section === "address" ? "address" : "company";
    const visibleRowKeys = (Array.isArray(visibleRows) ? visibleRows : [])
      .map((row) => normalizeDadataOrderKey(row?.orderKey ?? row?.key))
      .filter(Boolean);
    const sourceIndex = visibleRowKeys.indexOf(sourceRowKey);
    const targetIndex = visibleRowKeys.indexOf(normalizedTargetRowKey);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDadataDraggingRowKey("");
      return;
    }
    const reorderedVisibleKeys = [...visibleRowKeys];
    const [movedRowKey] = reorderedVisibleKeys.splice(sourceIndex, 1);
    if (!movedRowKey) {
      setDadataDraggingRowKey("");
      return;
    }
    reorderedVisibleKeys.splice(targetIndex, 0, movedRowKey);
    setDadataAttributeOrderMap((prev) => {
      const prevMap = prev && typeof prev === "object" ? prev : { company: [], address: [] };
      const prevOrder = Array.isArray(prevMap[sectionKey])
        ? prevMap[sectionKey].map((item) => normalizeDadataOrderKey(item)).filter(Boolean)
        : [];
      const remainder = prevOrder.filter((key) => !reorderedVisibleKeys.includes(key));
      return {
        ...prevMap,
        [sectionKey]: [...reorderedVisibleKeys, ...remainder]
      };
    });
    setDadataDraggingRowKey("");
  }, [stopDadataDragAutoScroll]);
  useEffect(() => () => {
    stopDadataDragAutoScroll();
  }, [stopDadataDragAutoScroll]);
  useEffect(() => {
    const handleWindowDragOver = (event) => {
      const section = dadataDraggingSectionRef.current;
      if (!section) {
        return;
      }
      const clientY = getDragClientY(event);
      if (!Number.isFinite(clientY)) {
        return;
      }
      updateDadataDragAutoScroll(section, clientY);
    };
    const handleWindowDrag = (event) => {
      const section = dadataDraggingSectionRef.current;
      if (!section) {
        return;
      }
      const clientY = getDragClientY(event);
      if (!Number.isFinite(clientY)) {
        return;
      }
      updateDadataDragAutoScroll(section, clientY);
    };
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drag", handleWindowDrag);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drag", handleWindowDrag);
    };
  }, [getDragClientY, updateDadataDragAutoScroll]);
  useEffect(() => {
    if (!isOrganizationsPage || !isOrganizationCardPanelOpen) {
      return;
    }
    if (!isSelectedOrganizationResident) {
      return;
    }
    const organizationId = String(selectedOrganizationId ?? "").trim();
    if (!organizationId) {
      return;
    }
    const hasDadataInfo =
      selectedOrganizationDataInfoForDisplay &&
      typeof selectedOrganizationDataInfoForDisplay === "object" &&
      Object.keys(selectedOrganizationDataInfoForDisplay).length > 0;
    if (hasDadataInfo) {
      return;
    }
    if (organizationDadataAutoRefreshAttemptedRef.current.has(organizationId)) {
      return;
    }
    void refreshOrganizationDadata({ suppressErrors: true });
  }, [
    isOrganizationCardPanelOpen,
    isOrganizationsPage,
    isSelectedOrganizationResidentForAutoRefresh,
    refreshOrganizationDadata,
    selectedOrganizationDataInfoForDisplay,
    selectedOrganizationId
  ]);
  useEffect(() => {
    if (
      activeOrganizationCardTab === ORGANIZATION_CARD_TABS.DADATA &&
      !isSelectedOrganizationResident
    ) {
      setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN);
    }
  }, [activeOrganizationCardTab, isSelectedOrganizationResident, ORGANIZATION_CARD_TABS.DADATA, ORGANIZATION_CARD_TABS.MAIN]);

  const updateOrganizationEditComboMenuLayout = useCallback((comboKey) => {
    const inputElement = organizationEditComboInputRefs.current[comboKey];
    if (!(inputElement instanceof HTMLElement)) {
      return;
    }
    const inputRect = inputElement.getBoundingClientRect();
    const spaceBelow = Math.max(0, window.innerHeight - inputRect.bottom - 12);
    const spaceAbove = Math.max(0, inputRect.top - 12);
    const preferredOptionsHeight = RELATION_COMBO_VISIBLE_OPTION_COUNT * RELATION_COMBO_OPTION_HEIGHT_PX;
    const openUpward = spaceBelow < preferredOptionsHeight && spaceAbove > spaceBelow;
    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const optionsMaxHeight = Math.max(
      RELATION_COMBO_OPTION_HEIGHT_PX * 3,
      Math.min(preferredOptionsHeight, availableSpace - RELATION_COMBO_MENU_PADDING_PX)
    );
    setOrganizationEditComboMenuLayouts((prev) => ({
      ...prev,
      [comboKey]: {
        optionsMaxHeight,
        openUpward
      }
    }));
  }, []);

  const openOrganizationEditCombo = useCallback(
    (comboKey) => {
      updateOrganizationEditComboMenuLayout(comboKey);
      if (comboKey === "types") {
        setOrganizationTypeEditFilter("");
      }
      if (comboKey === "country") {
        setCountryEditFilter("");
      }
      setActiveOrganizationEditCombo(comboKey);
    },
    [updateOrganizationEditComboMenuLayout]
  );

  const toggleOrganizationTypeInEditForm = useCallback((typeId) => {
    const normalizedTypeId = String(typeId ?? "").trim();
    if (!normalizedTypeId) {
      return;
    }
    setOrganizationCardEditForm((prev) => {
      const source = Array.isArray(prev.organUnitTypeIds) ? prev.organUnitTypeIds : [];
      const set = new Set(source.map((item) => String(item ?? "").trim()).filter(Boolean));
      if (set.has(normalizedTypeId)) {
        set.delete(normalizedTypeId);
      } else {
        set.add(normalizedTypeId);
      }
      return {
        ...prev,
        organUnitTypeIds: Array.from(set)
      };
    });
  }, []);

  const goToPage = () => {
    const rawValue = pageJumpInputRef.current ? String(pageJumpInputRef.current.value ?? "").trim() : "";
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      if (pageJumpInputRef.current) {
        pageJumpInputRef.current.value = String(currentPage);
      }
      return;
    }

    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    setCurrentPage(clamped);
    if (pageJumpInputRef.current) {
      pageJumpInputRef.current.value = String(clamped);
    }
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

  const renderReportTemplateFieldOverflowText = (value, fallback = "-") => {
    const normalized = String(value ?? "").trim();
    const displayValue = normalized || fallback;
    return (
      <span
        className="report-template-cell-overflow-text"
        onMouseEnter={(event) => handleCellMouseEnter(event, normalized)}
        onMouseMove={updateCellTooltipPosition}
        onMouseLeave={handleCellMouseLeave}
      >
        {displayValue}
      </span>
    );
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
    const effectiveFilter = !showShortCode && !normalizedFilter ? "%" : normalizedFilter;
    const requestKey = showShortCode ? "sales" : "organ";
    relationOptionsRequestRef.current[requestKey] += 1;
    const requestId = relationOptionsRequestRef.current[requestKey];
    const params = new URLSearchParams({
      showShortCode: showShortCode ? "true" : "false"
    });
    if (effectiveFilter) {
      params.set("organName", effectiveFilter);
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
        fetchOrganizationOptions("", false),
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
        ? `${ADMIN_API_BASE_URL}/employee-position/${editingEmployeePositionId}`
        : `${ADMIN_API_BASE_URL}/employee-position`;
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
      salesOrganizationId: String(
        relationRow?.salesOrganizationId ?? relationRow?.salesOrganUnitId ?? ""
      ).trim(),
      productGroupNameFilter: "",
      productGroupName: String(relationRow?.productGroupName ?? "").trim(),
      productGroupsId: String(relationRow?.productGroupsId ?? relationRow?.productGroupId ?? "").trim(),
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
      id: String(relationRow?.salesOrganizationId ?? relationRow?.salesOrganUnitId ?? "").trim(),
      name: String(relationRow?.salesOrganName ?? "").trim()
    };
    lastConfirmedProductRef.current = {
      id: String(relationRow?.productGroupsId ?? relationRow?.productGroupId ?? "").trim(),
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
  };

  const createRelationFieldBlurHandler = (
    comboKey,
    idFieldName,
    filterFieldName,
    valueFieldName,
    sourceRef
  ) => () => {
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
        ? `${ADMIN_API_BASE_URL}/relation/${editingEmployeeRelationId}`
        : `${ADMIN_API_BASE_URL}/relation`;
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
      if (
        event.target instanceof Element &&
        (event.target.closest(".relation-combobox") ||
          event.target.closest(".relation-combobox-menu-portal"))
      ) {
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
  useEffect(() => {
    if (!isOrganizationCardEditMode) {
      return;
    }
    const handleMouseDown = (event) => {
      if (event.target instanceof Element && event.target.closest(".relation-combobox")) {
        return;
      }
      setActiveOrganizationEditCombo(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOrganizationCardEditMode]);
  useEffect(() => {
    if (!isOrganizationCardEditMode || !activeOrganizationEditCombo) {
      return;
    }
    const handleViewportChange = () => {
      updateOrganizationEditComboMenuLayout(activeOrganizationEditCombo);
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [activeOrganizationEditCombo, isOrganizationCardEditMode, updateOrganizationEditComboMenuLayout]);

  const updateRelationComboMenuLayout = (comboKey) => {
    const inputElement = relationComboInputRefs.current[comboKey];
    const tabContentElement = employeeRelationsTabContentRef.current ?? tableWrapperRef.current;
    if (!(inputElement instanceof HTMLElement) || !(tabContentElement instanceof HTMLElement)) {
      return;
    }

    const inputRect = inputElement.getBoundingClientRect();
    const tabRect = tabContentElement.getBoundingClientRect();
    const inputComputedStyle = window.getComputedStyle(inputElement);
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
        bottom: window.innerHeight - inputRect.top + 4,
        themeVars: {
          "--main-bg": inputComputedStyle.getPropertyValue("--main-bg").trim(),
          "--main-text": inputComputedStyle.getPropertyValue("--main-text").trim(),
          "--modal-bg": inputComputedStyle.getPropertyValue("--modal-bg").trim(),
          "--modal-text": inputComputedStyle.getPropertyValue("--modal-text").trim(),
          "--modal-border": inputComputedStyle.getPropertyValue("--modal-border").trim(),
          "--link-color": inputComputedStyle.getPropertyValue("--link-color").trim()
        }
      }
    }));
  };

  const openNewRelationCombo = (comboKey) => {
    setActiveNewRelationCombo(comboKey);
    requestAnimationFrame(() => updateRelationComboMenuLayout(comboKey));
    if (comboKey === "employee") {
      setNewEmployeeRelationForm((prev) => ({ ...prev, employeeNameFilter: "" }));
      if (relationEmployeeOptions.length === 0) {
        void fetchRelationEmployeeOptions("");
      }
    } else if (comboKey === "organ") {
      if (organizationOptions.length === 0) {
        const organizationFilter =
          String(newEmployeeRelationForm.organNameFilter ?? "").trim() ||
          String(newEmployeeRelationForm.organName ?? "").trim();
        void fetchOrganizationOptions(organizationFilter, false);
      }
    } else if (comboKey === "relation") {
      setNewEmployeeRelationForm((prev) => ({ ...prev, relationNameFilter: "" }));
      if (relationTypeOptions.length === 0) {
        void fetchRelationTypeOptions("");
      }
    } else if (comboKey === "sales") {
      setNewEmployeeRelationForm((prev) => ({ ...prev, salesOrganNameFilter: "" }));
      if (salesOrganizationOptions.length === 0) {
        void fetchOrganizationOptions("", true);
      }
    } else if (comboKey === "product") {
      setNewEmployeeRelationForm((prev) => ({ ...prev, productGroupNameFilter: "" }));
      if (productGroupOptions.length === 0) {
        void fetchProductGroupOptions("");
      }
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
      {activeNewRelationCombo === comboKey &&
        createPortal(
          <div
            className={`relation-combobox-menu relation-combobox-menu-portal${
              relationComboMenuLayouts[comboKey]?.openUpward ? " relation-combobox-menu-upward" : ""
            }`}
            style={{
              position: "fixed",
              left: `${relationComboMenuLayouts[comboKey]?.left ?? 0}px`,
              width: `${relationComboMenuLayouts[comboKey]?.width ?? 0}px`,
              top: relationComboMenuLayouts[comboKey]?.openUpward
                ? "auto"
                : `${relationComboMenuLayouts[comboKey]?.top ?? 0}px`,
              bottom: relationComboMenuLayouts[comboKey]?.openUpward
                ? `${relationComboMenuLayouts[comboKey]?.bottom ?? 0}px`
                : "auto",
              ...(relationComboMenuLayouts[comboKey]?.themeVars ?? {})
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
          </div>,
          document.body
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
            left: 0,
            width: "100%",
            top: positionComboMenuLayouts[comboKey]?.openUpward
              ? "auto"
              : "calc(100% + 4px)",
            bottom: positionComboMenuLayouts[comboKey]?.openUpward
              ? "calc(100% + 4px)"
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

  const openDeleteOrganizationModal = () => {
    const organUnitId = String(
      selectedOrganization?.id ??
        selectedOrganization?.organUnitId ??
        selectedOrganizationId ??
        ""
    ).trim();
    if (!organUnitId) {
      const errorMessage = "Не удалось определить organUnitId для удаления";
      showSystemErrorToast(errorMessage);
      return;
    }
    setPendingOrganizationDelete({
      organUnitId,
      name: String(selectedOrganization?.name ?? "").trim()
    });
  };

  const closeDeleteOrganizationModal = () => {
    setPendingOrganizationDelete(null);
  };

  const confirmDeleteRelation = async () => {
    if (!pendingRelationDelete?.relationId) {
      return;
    }

    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}/relation/${pendingRelationDelete.relationId}`, {
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
        `${ADMIN_API_BASE_URL}/employee-position/${pendingPositionDelete.employeeOrganId}`,
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
      const response = await fetch(`${ADMIN_API_BASE_URL}/employee/${deleteRequest.employeeId}`, {
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

  const confirmDeleteOrganization = async () => {
    if (!pendingOrganizationDelete?.organUnitId) {
      return;
    }
    const deleteRequest = pendingOrganizationDelete;
    setPendingOrganizationDelete(null);

    try {
      const response = await fetch(
        `${ADMIN_API_BASE_URL}/organization/${deleteRequest.organUnitId}`,
        { method: "DELETE" }
      );
      const responseText = await response.text();
      let data = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = null;
        }
      }
      if (!response.ok) {
        const errorMessage =
          String(data?.error ?? "").trim() ||
          String(responseText ?? "").trim() ||
          `Не удалось удалить организацию (HTTP ${response.status})`;
        showSystemErrorToast(errorMessage);
        return;
      }

      setEmployees((prev) =>
        prev.filter(
          (row) =>
            String(row?.id ?? row?.organUnitId ?? "").trim() !== deleteRequest.organUnitId
        )
      );
      setTotalCount((prev) => Math.max(0, Number(prev ?? 0) - 1));
      refreshEmployeesList();
      handleCloseOrganizationCardPanel();
    } catch (error) {
      const errorMessage = String(error?.message ?? "").trim();
      showSystemErrorToast(errorMessage || "Не удалось удалить организацию");
    }
  };

  const getRelationColumnWidthPx = (columnKey) => {
    const rawWidth = Number(
      employeeRelationsColumnWidths[columnKey] ?? DEFAULT_RELATION_COLUMN_WIDTHS[columnKey] ?? MIN_COLUMN_WIDTH
    );
    if (!Number.isFinite(rawWidth)) {
      return MIN_COLUMN_WIDTH;
    }
    return Math.max(MIN_COLUMN_WIDTH, Math.round(rawWidth));
  };
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

    const targetTotalWidth = wrapper.clientWidth - 96 - 2;
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
          <button
            type="button"
            className={`sidebar-button sidebar-action${isSidebarCollapsed ? " icon-only" : ""}${
              isPrintFormsPage ? " active" : ""
            }`}
            onClick={() => handlePageSelect(PAGE_IDS.PRINT_FORMS)}
            aria-label="Шаблоны печатных форм"
            title="Шаблоны печатных форм"
          >
            <span className="sidebar-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 12h8v1.5H8V12zm0 4h8v1.5H8V16z" />
              </svg>
            </span>
            {!isSidebarCollapsed && <span>Печатные формы</span>}
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
            <div className="administration-section-header administration-section-header-static">
              <span>Справочники/Классификаторы</span>
            </div>
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
            <button
              type="button"
              className="administration-section-header"
              onClick={() => setIsReportBuilderExpanded((prev) => !prev)}
              aria-expanded={isReportBuilderExpanded}
            >
              <span>Конструктор отчетов</span>
              <span className="administration-section-chevron" aria-hidden="true">
                {isReportBuilderExpanded ? "▾" : "▸"}
              </span>
            </button>
            {isReportBuilderExpanded && (
              <div className="administration-section-items">
                <button
                  type="button"
                  className={`administration-section-item${isReportSettingsPage ? " active" : ""}`}
                  onClick={() => handlePageSelect(PAGE_IDS.REPORT_SETTINGS)}
                >
                  Настройка отчетов
                </button>
              </div>
            )}
            <div className="administration-section-header administration-section-header-static">
              <span>Конструктор уведомлений</span>
            </div>
            <div className="administration-section-header administration-section-header-static">
              <span>Конфигуратор сценариев</span>
            </div>
            <div className="administration-section-header administration-section-header-static">
              <span>Мониторинг событий</span>
            </div>
          </aside>
        </div>
      )}
      <section className={`content-area${isDarkThemeEnabled ? " dark" : ""}`}>
        <header
          className={`page-header${
            isReportHeaderContext || isEmployeeOrganizationHeaderContext ? " report-settings-page-header" : ""
          }`}
        >
          <h1>{currentPageTitle}</h1>
          <div className="page-header-right">
            <div className="header-time-block" aria-label="Текущие дата и время">
              <div className="header-date-value">{nowDisplay.date}</div>
              <div className="header-weekday-value">
                {String(nowDisplay.weekday ?? "").trim() || formatNow().weekday}
              </div>
              <div className="header-time-value">{nowDisplay.time}</div>
            </div>
            {(isReportHeaderContext || isEmployeeOrganizationHeaderContext) && (
              <div className="report-list-header-actions">
                {isReportSettingsPage && (
                  <button type="button" className="panel-action-button" onClick={openCreateReportCard}>
                    <span aria-hidden="true">+</span>
                    <span>Добавить</span>
                  </button>
                )}
                {isEmployeesHeaderContext && (
                  <button type="button" className="panel-action-button" onClick={openCreateEmployeeCard}>
                    <span aria-hidden="true">+</span>
                    <span>Добавить</span>
                  </button>
                )}
                {isEmployeesHeaderContext && (
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
                {isEmployeeOrganizationHeaderContext && (
                  <ExportToExcelButton
                    exportFile={requestExportFile}
                    disabled={employeesLoading}
                    className="panel-action-button"
                    onError={(error) =>
                      setEmployeesError(error instanceof Error ? error.message : "Ошибка выгрузки")
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
                {isEmployeeOrganizationHeaderContext || isReportSettingsPage ? (
                  <button type="button" className="panel-action-button" onClick={handleAlignVisibleColumns}>
                    <span aria-hidden="true">↔</span>
                    <span>Выровнять</span>
                  </button>
                ) : null}
                {isEmployeeOrganizationHeaderContext || isReportSettingsPage ? (
                  <button type="button" className="panel-action-button" onClick={openColumnSettings}>
                    <span aria-hidden="true">⚙</span>
                    <span>Настройка</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </header>
        <section
          className={`main-panel${
            isReportHeaderContext || isEmployeeOrganizationHeaderContext ? " report-settings-main-panel" : ""
          }`}
          ref={mainPanelRef}
        >
          {isListPage ? (
            <>
              <div
                className={`list-content-layout${isSideCardVisible ? " split-view" : ""}${
                  isReportHeaderContext || isEmployeeOrganizationHeaderContext ? " report-settings-layout" : ""
                }`}
              >
                <div className="list-content-main">
                  {!isReportSettingsPage &&
                    !isEmployeeOrganizationPage &&
                    !isEmployeeCardPanelOpen &&
                    !isOrganizationCardPanelOpen &&
                    !isReportCardPanelOpen && (
                    <div className="main-panel-toolbar">
                      <div className="main-panel-actions">
                      {isEmployeesPage && !isSideCardVisible && (
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
                      {isEmployeesPage && !isSideCardVisible && (
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
                      {!isSideCardVisible && !isReportSettingsPage && (
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
                      {!isReportSettingsPage && (
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
                      )}
                      {!isSideCardVisible && !isReportSettingsPage && (
                        <button type="button" className="panel-action-button" onClick={handleAlignVisibleColumns}>
                          <span aria-hidden="true">↔</span>
                          <span>Выровнять</span>
                        </button>
                      )}
                      {!isSideCardVisible && !isReportSettingsPage && (
                        <button type="button" className="panel-action-button" onClick={openColumnSettings}>
                          <span aria-hidden="true">⚙</span>
                          <span>Настройка</span>
                        </button>
                      )}
                      </div>
                    </div>
                  )}
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
                    const isColumnSortable = Boolean(column.sortField);
                    const columnSortDirection = isColumnSortable
                      ? getSortDirectionForField(column.sortField)
                      : null;
                    const columnSortOrder = isColumnSortable
                      ? getSortOrderForField(column.sortField)
                      : null;
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
                        {isColumnSortable ? (
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
                        ) : (
                          <div className="column-sort-button">
                            <span>{column.title}</span>
                          </div>
                        )}
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
                      {isReportSettingsPage && !REPORT_SETTINGS_FILTERABLE_FIELDS.has(column.key) ? null : isEmployeesPage &&
                        column.key === "status" ? (
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
                      ) : isOrganizationsPage && column.key === "organUnitTypeNames" ? (
                        <div
                          className={`relation-combobox organization-type-filter-combobox${
                            isOrganizationTypeFilterOpen ? " open" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="column-filter-input relation-combobox-trigger organization-type-filter-trigger"
                            onClick={() => setIsOrganizationTypeFilterOpen((prev) => !prev)}
                          >
                            <span className="organization-type-filter-trigger-label">
                              {organizationTypeFilterTitle}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`organization-type-filter-close-button${
                              selectedOrganizationTypeNames.length > 0 ? " with-clear" : ""
                            }`}
                            aria-label={
                              isOrganizationTypeFilterOpen
                                ? "Закрыть список фильтра"
                                : "Открыть список фильтра"
                            }
                            onClick={() => setIsOrganizationTypeFilterOpen((prev) => !prev)}
                          >
                            {isOrganizationTypeFilterOpen ? "▴" : "▾"}
                          </button>
                          {selectedOrganizationTypeNames.length > 0 && (
                            <button
                              type="button"
                              className="relation-combobox-clear-button organization-type-filter-clear-button"
                              aria-label="Очистить фильтр"
                              onClick={() => handleFilterChange("organUnitTypeNames", [])}
                            >
                              ×
                            </button>
                          )}
                          {isOrganizationTypeFilterOpen && (
                            <div className="relation-combobox-menu organization-type-filter-menu">
                              <div className="relation-combobox-options organization-type-filter-options">
                                {organizationUnitTypeOptions.length === 0 ? (
                                  <div className="relation-combobox-empty">Нет данных</div>
                                ) : (
                                  organizationUnitTypeOptions.map((name) => {
                                    const checked = selectedOrganizationTypeNames.includes(name);
                                    return (
                                      <label
                                        key={name}
                                        className="organization-type-filter-option"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleOrganizationTypeFilterValue(name)}
                                        />
                                        <span>{name}</span>
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
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
                {employeesLoading && displayedEmployees.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + (isEmployeeRelationsPage ? 1 : 0)}>
                      Загрузка данных...
                    </td>
                  </tr>
                )}
                {!employeesLoading && !employeesError && displayedEmployees.length === 0 && (
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
                  isOrganizationsPage &&
                  displayedEmployees.map((row, rowIndex) => (
                    <tr
                      key={`${
                        row.id ??
                        row.reportTemplateId ??
                        row.employeeId ??
                        row.relationId ??
                        row.email ??
                        row.sapId ??
                        "row"
                      }-${rowIndex}`}
                      data-row-index={rowIndex}
                      tabIndex={-1}
                      aria-selected={false}
                      onMouseDown={(event) => {
                        if (event.button !== 0) {
                          return;
                        }
                        const table = event.currentTarget.closest("table");
                        if (table) {
                          table
                            .querySelectorAll("tr.selected-row")
                            .forEach((rowElement) => rowElement.classList.remove("selected-row"));
                        } else if (selectedOrganizationRowRef.current) {
                          selectedOrganizationRowRef.current.classList.remove("selected-row");
                        }
                        event.currentTarget.classList.add("selected-row");
                        selectedOrganizationRowRef.current = event.currentTarget;
                      }}
                      onClick={() => {
                        handleOrganizationRowClick(rowIndex);
                      }}
                    >
                      {visibleColumns.map((column) => {
                        const displayValue =
                          column.key === "organUnitTypeNames"
                            ? (() => {
                                const sourceTypes = Array.isArray(row?.organUnitTypes)
                                  ? row.organUnitTypes
                                  : Array.isArray(row?.organ_unit_types)
                                    ? row.organ_unit_types
                                    : [];
                                const sortedTypes = sourceTypes
                                  .map((item) => ({
                                    name: String(item?.organUnitTypeName ?? item?.organ_unit_type_name ?? "").trim(),
                                    sortOrder: Number(
                                      item?.organUnitTypeSort ??
                                        item?.organ_unit_type_sort ??
                                        Number.MAX_SAFE_INTEGER
                                    )
                                  }))
                                  .filter((item) => item.name)
                                  .sort((left, right) => {
                                    if (left.sortOrder !== right.sortOrder) {
                                      return left.sortOrder - right.sortOrder;
                                    }
                                    return left.name.localeCompare(right.name, "ru-RU", {
                                      sensitivity: "base",
                                      numeric: true
                                    });
                                  });
                                const names = sortedTypes.map((item) => item.name);
                                return names.length > 0 ? names.join(", ") : "-";
                              })()
                            : row?.[column.key] ?? "-";
                        return (
                          <td
                            key={`${
                              row.id ??
                              row.reportTemplateId ??
                              row.employeeId ??
                              row.relationId ??
                              row.email ??
                              row.sapId ??
                              rowIndex
                            }-${column.key}`}
                            className={`${getStickyProps(column.key).className}${
                              column.key === "signResident" ? " cell-center" : ""
                            }`.trim()}
                            style={getStickyProps(column.key).style}
                            onMouseEnter={(event) => handleCellMouseEnter(event, displayValue)}
                            onMouseMove={updateCellTooltipPosition}
                            onMouseLeave={handleCellMouseLeave}
                          >
                            {displayValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                {!employeesError &&
                  !isOrganizationsPage &&
                  displayedEmployees.map((row, rowIndex) => {
                    const rowEmployeeId = String(row?.id ?? row?.employeeId ?? "").trim();
                    const isRowSelected = isEmployeesPage
                      ? rowEmployeeId !== "" && rowEmployeeId === selectedEmployeeId
                      : isOrganizationsPage
                        ? false
                        : selectedRowIndex === rowIndex;
                    if (isEmployeeRelationsPage && getRelationId(row) === editingEmployeeRelationId) {
                      return renderEmployeeRelationFormRow(
                        "Отменить редактирование связи",
                        `relations-list-edit-${editingEmployeeRelationId || rowIndex}`
                      );
                    }
                    return (
                    <tr
                      key={`${
                        row.id ??
                        row.reportTemplateId ??
                        row.employeeId ??
                        row.relationId ??
                        row.email ??
                        row.sapId ??
                        "row"
                      }-${rowIndex}`}
                      data-row-index={rowIndex}
                      tabIndex={-1}
                      aria-selected={isRowSelected}
                      className={isRowSelected ? "selected-row" : ""}
                      onMouseDown={(event) => {
                        if (isOrganizationsPage && event.button === 0) {
                          const table = event.currentTarget.closest("table");
                          if (table) {
                            table
                              .querySelectorAll("tr.selected-row")
                              .forEach((rowElement) => rowElement.classList.remove("selected-row"));
                          } else if (selectedOrganizationRowRef.current) {
                            selectedOrganizationRowRef.current.classList.remove("selected-row");
                          }
                          event.currentTarget.classList.add("selected-row");
                          selectedOrganizationRowRef.current = event.currentTarget;
                        }
                      }}
                      onClick={() => {
                        if (isEmployeesPage) {
                          handleEmployeeRowClick(rowIndex);
                        } else if (isOrganizationsPage) {
                          // Выбор уже выполнен в onMouseDown для мгновенного отклика.
                          return;
                        } else if (isReportSettingsPage) {
                          handleReportRowClick(rowIndex);
                        } else {
                          setSelectedRowIndex(rowIndex);
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
                          key={`${
                            row.id ??
                            row.reportTemplateId ??
                            row.employeeId ??
                            row.relationId ??
                            row.email ??
                            row.sapId ??
                            rowIndex
                          }-${column.key}`}
                          className={`${getStickyProps(column.key).className}${
                            column.key === "signResident" ||
                            (isReportSettingsPage &&
                              (column.key === "method" ||
                                column.key === "status" ||
                                column.key === "numberDays" ||
                                column.key === "outputFileType")) ||
                            (isEmployeeRelationsPage && column.key === "defaultFlag")
                              ? " cell-center"
                              : ""
                          }`.trim()}
                          style={getStickyProps(column.key).style}
                          onMouseEnter={
                            isMainGridCellTooltipEnabled
                              ? (event) => handleCellMouseEnter(event, displayValue, fixedTooltipText)
                              : undefined
                          }
                          onMouseMove={isMainGridCellTooltipEnabled ? updateCellTooltipPosition : undefined}
                          onMouseLeave={isMainGridCellTooltipEnabled ? handleCellMouseLeave : undefined}
                        >
                          {isEmployeesPage &&
                          column.key === "organName" &&
                          normalizeOrganizationId(derivedPositionData?.organUnitId) ? (
                            <a
                              className="log-link employee-name-link"
                              href={buildOrganizationCardUrl(derivedPositionData?.organUnitId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              title="Открыть карточку организации в новой вкладке"
                            >
                              {displayValue}
                            </a>
                          ) : isEmployeeRelationsPage &&
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
                          ) : isEmployeeRelationsPage &&
                            column.key === "organName" &&
                            normalizeOrganizationId(row?.organUnitId ?? row?.organ_unit_id) ? (
                            <a
                              className="log-link employee-name-link"
                              href={buildOrganizationCardUrl(row?.organUnitId ?? row?.organ_unit_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              title="Открыть карточку организации в новой вкладке"
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
                  <aside className={`employee-card-panel report-card-panel${isEmployeeCardVisible ? " open" : ""}`}>
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
                                          {normalizeOrganizationId(positionRow?.organUnitId) ? (
                                            <a
                                              className="log-link employee-name-link"
                                              href={buildOrganizationCardUrl(positionRow?.organUnitId)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                              }}
                                              title="Открыть карточку организации в новой вкладке"
                                            >
                                              {positionRow?.organName ?? "-"}
                                            </a>
                                          ) : (
                                            positionRow?.organName ?? "-"
                                          )}
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
                                  minWidth: `${relationTableWidthPx}px`
                                }}
                              >
                                <colgroup>
                                  {RELATION_COLUMNS.map((column) => (
                                    <col
                                      key={`relation-col-${column.key}`}
                                      style={{
                                        width: `${getRelationColumnWidthPx(column.key)}px`,
                                        minWidth: `${getRelationColumnWidthPx(column.key)}px`
                                      }}
                                    />
                                  ))}
                                  <col style={{ width: "96px", minWidth: "96px" }} />
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
                                          {normalizeOrganizationId(relationRow?.organUnitId) ? (
                                            <a
                                              className="log-link employee-name-link"
                                              href={buildOrganizationCardUrl(relationRow?.organUnitId)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                              }}
                                              title="Открыть карточку организации в новой вкладке"
                                            >
                                              {relationRow?.organName ?? "-"}
                                            </a>
                                          ) : (
                                            relationRow?.organName ?? "-"
                                          )}
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
                {isOrganizationsPage && (
                  <aside className={`employee-card-panel report-card-panel${isOrganizationCardVisible ? " open" : ""}`}>
                    <div className="employee-card-panel-header">
                      <h2>Карточка организации</h2>
                      <div className="employee-card-full-name employee-card-full-name-header">
                        {String(
                          selectedOrganization?.shName ??
                            selectedOrganization?.sh_name ??
                            selectedOrganization?.name ??
                            "-"
                        ).trim() || "-"}
                      </div>
                      <button
                        type="button"
                        className="employee-card-close-button"
                        onClick={handleCloseOrganizationCardPanel}
                        aria-label="Закрыть карточку организации"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="employee-card-panel-body">
                      <div className="employee-card-tabs" role="tablist" aria-label="Вкладки карточки организации">
                        <button
                          type="button"
                          className={`employee-card-tab${
                            activeOrganizationCardTab === ORGANIZATION_CARD_TABS.MAIN ? " active" : ""
                          }`}
                          onClick={() => setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN)}
                          aria-selected={activeOrganizationCardTab === ORGANIZATION_CARD_TABS.MAIN}
                          role="tab"
                        >
                          Основная информация
                        </button>
                        {isSelectedOrganizationResident && (
                          <button
                            type="button"
                            className={`employee-card-tab${
                              activeOrganizationCardTab === ORGANIZATION_CARD_TABS.DADATA ? " active" : ""
                            }`}
                            onClick={() => setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.DADATA)}
                            aria-selected={activeOrganizationCardTab === ORGANIZATION_CARD_TABS.DADATA}
                            role="tab"
                          >
                            ДаДата
                          </button>
                        )}
                      </div>
                      {activeOrganizationCardTab === ORGANIZATION_CARD_TABS.MAIN && (
                        <div
                          className={`employee-card-main-tab-content organization-card-main-tab-content${
                            isOrganizationCardEditMode ? " employee-card-main-tab-content-edit-mode" : ""
                          }`}
                        >
                        <section className="employee-card-section">
                          <div className="employee-card-section-header">
                            <h3>Основная информация</h3>
                            <div className="employee-card-section-actions">
                              {isOrganizationCardEditMode ? (
                                <>
                                  <button
                                    type="button"
                                    className="panel-action-button"
                                    onClick={saveOrganizationCardMainInfo}
                                  >
                                    Сохранить
                                  </button>
                                  <button
                                    type="button"
                                    className="panel-action-button"
                                    onClick={cancelOrganizationCardEditMode}
                                  >
                                    Отменить
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="panel-action-button"
                                    onClick={startOrganizationCardEditMode}
                                  >
                                    Изменить
                                  </button>
                                  <button
                                    type="button"
                                    className="panel-action-button"
                                    onClick={openDeleteOrganizationModal}
                                  >
                                    Удалить
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="employee-card-params">
                            <div className="employee-card-params-row">
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">sap id</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.sapId,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        sapId: value
                                      }))
                                  })
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganization?.sapId ?? selectedOrganization?.sap_id ?? "-"}
                                  </span>
                                )}
                              </div>
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">ИНН</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.inn,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        inn: value
                                      }))
                                  })
                                ) : (
                                  <span
                                    className={`employee-card-field-value employee-card-field-value-block${
                                      organizationMainIndicatorsMismatch.inn
                                        ? " employee-card-field-value-mismatch"
                                        : ""
                                    }`}
                                  >
                                    {selectedOrganization?.inn ?? "-"}
                                  </span>
                                )}
                              </div>
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">КПП</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.kpp,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        kpp: value
                                      }))
                                  })
                                ) : (
                                  <span
                                    className={`employee-card-field-value employee-card-field-value-block${
                                      organizationMainIndicatorsMismatch.kpp
                                        ? " employee-card-field-value-mismatch"
                                        : ""
                                    }`}
                                  >
                                    {selectedOrganization?.kpp ?? "-"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="employee-card-params-row">
                              <div className="employee-card-param employee-card-param-span-two">
                                <span className="employee-card-field-label">Наименование</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.name,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        name: value
                                      }))
                                  })
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganization?.name ?? "-"}
                                  </span>
                                )}
                              </div>
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">Краткое наименование</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.shName,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        shName: value
                                      }))
                                  })
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganization?.shName ?? selectedOrganization?.sh_name ?? "-"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="employee-card-params-row">
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">ОГРН</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.ogrn,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        ogrn: value
                                      }))
                                  })
                                ) : (
                                  <span
                                    className={`employee-card-field-value employee-card-field-value-block${
                                      organizationMainIndicatorsMismatch.ogrn
                                        ? " employee-card-field-value-mismatch"
                                        : ""
                                    }`}
                                  >
                                    {selectedOrganization?.ogrn ?? "-"}
                                  </span>
                                )}
                              </div>
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">ОКПО</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.okpo,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        okpo: value
                                      }))
                                  })
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganization?.okpo ?? "-"}
                                  </span>
                                )}
                              </div>
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">Краткий код</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.shortCode,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        shortCode: value
                                      }))
                                  })
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganization?.shortCode ?? selectedOrganization?.short_code ?? "-"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="employee-card-params-row">
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">Тип организации</span>
                                {isOrganizationCardEditMode ? (
                                  <div
                                    className={`relation-combobox organization-type-edit-combobox${
                                      activeOrganizationEditCombo === "types" ? " open" : ""
                                    }`}
                                  >
                                    <input
                                      type="text"
                                      className="employee-card-field-input relation-combobox-trigger organization-type-edit-trigger"
                                      ref={(element) => {
                                        organizationEditComboInputRefs.current.types = element;
                                      }}
                                      value={
                                        activeOrganizationEditCombo === "types"
                                          ? organizationTypeEditFilter
                                          : selectedOrganizationTypeSummaryForEdit
                                      }
                                      onFocus={() => openOrganizationEditCombo("types")}
                                      onClick={() => openOrganizationEditCombo("types")}
                                      onChange={(event) => {
                                        if (activeOrganizationEditCombo !== "types") {
                                          openOrganizationEditCombo("types");
                                        }
                                        setOrganizationTypeEditFilter(String(event.target.value ?? ""));
                                      }}
                                      placeholder="Выберите тип организации"
                                    />
                                    <button
                                      type="button"
                                      className={`organization-type-edit-toggle-button${
                                        selectedOrganizationTypeSummaryForEdit ? " with-clear" : ""
                                      }`}
                                      aria-label={
                                        activeOrganizationEditCombo === "types"
                                          ? "Закрыть список типов организации"
                                          : "Открыть список типов организации"
                                      }
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (activeOrganizationEditCombo === "types") {
                                          setActiveOrganizationEditCombo(null);
                                        } else {
                                          openOrganizationEditCombo("types");
                                        }
                                      }}
                                    >
                                      {activeOrganizationEditCombo === "types" ? "▴" : "▾"}
                                    </button>
                                    {selectedOrganizationTypeSummaryForEdit && (
                                      <button
                                        type="button"
                                        className="relation-combobox-clear-button organization-type-edit-clear-button"
                                        aria-label="Очистить выбор типов организации"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOrganizationCardEditForm((prev) => ({
                                            ...prev,
                                            organUnitTypeIds: []
                                          }));
                                          setOrganizationTypeEditFilter("");
                                        }}
                                      >
                                        ×
                                      </button>
                                    )}
                                    {activeOrganizationEditCombo === "types" && (
                                      <div
                                        className={`relation-combobox-menu${
                                          organizationEditComboMenuLayouts.types?.openUpward
                                            ? " relation-combobox-menu-upward"
                                            : ""
                                        }`}
                                        style={{
                                          top: organizationEditComboMenuLayouts.types?.openUpward
                                            ? "auto"
                                            : "calc(100% + 4px)",
                                          bottom: organizationEditComboMenuLayouts.types?.openUpward
                                            ? "calc(100% + 4px)"
                                            : "auto"
                                        }}
                                      >
                                        <div
                                          className="relation-combobox-options"
                                        >
                                          {filteredOrganizationTypeCatalogForEdit.length === 0 ? (
                                            <div className="relation-combobox-empty">Нет данных</div>
                                          ) : (
                                            filteredOrganizationTypeCatalogForEdit.map((item) => {
                                              const itemId = String(item.id ?? "").trim();
                                              const isSelected = (
                                                Array.isArray(organizationCardEditForm.organUnitTypeIds)
                                                  ? organizationCardEditForm.organUnitTypeIds
                                                  : []
                                              )
                                                .map((typeId) => String(typeId ?? "").trim())
                                                .includes(itemId);
                                              return (
                                                <button
                                                  key={`organization-edit-type-${itemId}`}
                                                  type="button"
                                                  className={`relation-combobox-option organization-type-option${
                                                    isSelected ? " selected" : ""
                                                  }`}
                                                  onClick={() => {
                                                    toggleOrganizationTypeInEditForm(itemId);
                                                  }}
                                                  title={item.name}
                                                >
                                                  <span
                                                    className={`organization-type-option-checkbox${
                                                      isSelected ? " checked" : ""
                                                    }`}
                                                    aria-hidden="true"
                                                  />
                                                  <span className="organization-type-option-label">{item.name}</span>
                                                </button>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {(() => {
                                      const names = Array.isArray(selectedOrganization?.organUnitTypeNames)
                                        ? selectedOrganization.organUnitTypeNames
                                        : Array.isArray(selectedOrganization?.organ_unit_type_names)
                                          ? selectedOrganization.organ_unit_type_names
                                          : [];
                                      return names.length > 0 ? names.join(", ") : "-";
                                    })()}
                                  </span>
                                )}
                              </div>
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">Резидент</span>
                                {isOrganizationCardEditMode ? (
                                  <select
                                    className="employee-card-field-input"
                                    value={organizationCardEditForm.signResident}
                                    onChange={(event) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        signResident:
                                          String(event.target.value ?? "").trim().toUpperCase() === "ДА"
                                            ? "ДА"
                                            : "НЕТ"
                                      }))
                                    }
                                  >
                                    <option value="ДА">ДА</option>
                                    <option value="НЕТ">НЕТ</option>
                                  </select>
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganization?.signResident ?? selectedOrganization?.sign_resident ?? "-"}
                                  </span>
                                )}
                              </div>
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">Страна</span>
                                {isOrganizationCardEditMode ? (
                                  <div
                                    className={`relation-combobox${
                                      activeOrganizationEditCombo === "country" ? " open" : ""
                                    }`}
                                  >
                                    <input
                                      type="text"
                                      className="employee-card-field-input relation-combobox-trigger"
                                      ref={(element) => {
                                        organizationEditComboInputRefs.current.country = element;
                                      }}
                                      value={
                                        activeOrganizationEditCombo === "country"
                                          ? countryEditFilter
                                          : selectedCountryNameForEdit
                                      }
                                      onFocus={() => openOrganizationEditCombo("country")}
                                      onClick={() => openOrganizationEditCombo("country")}
                                      onChange={(event) => {
                                        if (activeOrganizationEditCombo !== "country") {
                                          openOrganizationEditCombo("country");
                                        }
                                        setCountryEditFilter(String(event.target.value ?? ""));
                                      }}
                                      placeholder="Выберите страну"
                                    />
                                    {selectedCountryNameForEdit && (
                                      <button
                                        type="button"
                                        className="relation-combobox-clear-button"
                                        aria-label="Очистить выбор страны"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOrganizationCardEditForm((prev) => ({
                                            ...prev,
                                            countryId: ""
                                          }));
                                          setCountryEditFilter("");
                                        }}
                                      >
                                        ×
                                      </button>
                                    )}
                                    {activeOrganizationEditCombo === "country" && (
                                      <div
                                        className={`relation-combobox-menu${
                                          organizationEditComboMenuLayouts.country?.openUpward
                                            ? " relation-combobox-menu-upward"
                                            : ""
                                        }`}
                                        style={{
                                          top: organizationEditComboMenuLayouts.country?.openUpward
                                            ? "auto"
                                            : "calc(100% + 4px)",
                                          bottom: organizationEditComboMenuLayouts.country?.openUpward
                                            ? "calc(100% + 4px)"
                                            : "auto"
                                        }}
                                      >
                                        <div
                                          className="relation-combobox-options"
                                        >
                                          {filteredCountryOptionsForEdit.length === 0 ? (
                                            <div className="relation-combobox-empty">Нет данных</div>
                                          ) : (
                                            filteredCountryOptionsForEdit.map((item) => {
                                              const itemId = String(item.id ?? "").trim();
                                              return (
                                                <button
                                                  key={`organization-edit-country-${itemId}`}
                                                  type="button"
                                                  className="relation-combobox-option"
                                                  onClick={() => {
                                                    setOrganizationCardEditForm((prev) => ({
                                                      ...prev,
                                                      countryId: itemId
                                                    }));
                                                    setCountryEditFilter(String(item.name ?? ""));
                                                    setActiveOrganizationEditCombo(null);
                                                  }}
                                                  title={item.name}
                                                >
                                                  {item.name}
                                                </button>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganization?.countryName ?? selectedOrganization?.country_name ?? "-"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="employee-card-params-row">
                              <div className="employee-card-param" style={{ gridColumn: "1 / -1" }}>
                                <span className="employee-card-field-label">Адрес</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.address,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        address: value
                                      }))
                                  })
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganization?.address ?? "-"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="employee-card-params-row">
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">Номер цеха</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.kcehNumber,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        kcehNumber: value
                                      }))
                                  })
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganizationSnapshot?.kcehNumber ??
                                      selectedOrganizationSnapshot?.kceh_number ??
                                      selectedOrganization?.kcehNumber ??
                                      selectedOrganization?.kceh_number ??
                                      "-"}
                                  </span>
                                )}
                              </div>
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">Префикс претензии</span>
                                {isOrganizationCardEditMode ? (
                                  renderEmployeeCardTextInput({
                                    value: organizationCardEditForm.claimPrefix,
                                    onChange: (value) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        claimPrefix: value
                                      }))
                                  })
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganizationSnapshot?.claimPrefix ??
                                      selectedOrganizationSnapshot?.claim_prefix ??
                                      selectedOrganization?.claimPrefix ??
                                      selectedOrganization?.claim_prefix ??
                                      "-"}
                                  </span>
                                )}
                              </div>
                              <div className="employee-card-param">
                                <span className="employee-card-field-label">Fast Track</span>
                                {isOrganizationCardEditMode ? (
                                  <select
                                    className="employee-card-field-input"
                                    value={organizationCardEditForm.fastTrack}
                                    onChange={(event) =>
                                      setOrganizationCardEditForm((prev) => ({
                                        ...prev,
                                        fastTrack: String(event.target.value ?? "").trim().toUpperCase()
                                      }))
                                    }
                                  >
                                    <option value="">Не выбрано</option>
                                    <option value="ДА">ДА</option>
                                    <option value="НЕТ">НЕТ</option>
                                  </select>
                                ) : (
                                  <span className="employee-card-field-value employee-card-field-value-block">
                                    {selectedOrganizationSnapshot?.fastTrack ??
                                      selectedOrganizationSnapshot?.fast_track ??
                                      selectedOrganization?.fastTrack ??
                                      selectedOrganization?.fast_track ??
                                      "-"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </section>
                        </div>
                      )}
                      {isSelectedOrganizationResident &&
                        activeOrganizationCardTab === ORGANIZATION_CARD_TABS.DADATA && (
                        <div className="employee-card-main-tab-content organization-card-main-tab-content">
                          <section className="employee-card-section">
                            <div className="employee-card-section-header organization-dadata-sticky-header">
                              <h3>ДаДата</h3>
                              <div className="employee-card-section-actions">
                                <label className="organization-dadata-visible-only-toggle">
                                  <input
                                    type="checkbox"
                                    checked={isDadataVisibleOnlyEnabled}
                                    onChange={(event) =>
                                      setIsDadataVisibleOnlyEnabled(Boolean(event.target.checked))
                                    }
                                  />
                                  <span>Только видимые атрибуты</span>
                                </label>
                                <button
                                  type="button"
                                  className="panel-action-button"
                                  onClick={refreshOrganizationDadata}
                                  disabled={isOrganizationDadataRefreshing}
                                >
                                  {isOrganizationDadataRefreshing ? "Обновление..." : "Обновить"}
                                </button>
                              </div>
                            </div>
                            <div className="organization-dadata-array-section">
                              <button
                                type="button"
                                className="report-template-level-toggle organization-dadata-level-toggle"
                                onClick={() => toggleOrganizationDadataSection("company")}
                              >
                                <span className="report-template-level-toggle-icon" aria-hidden="true">
                                  {organizationDadataCollapsedSections.company ? "▸" : "▾"}
                                </span>
                                <span>Информация о компании</span>
                              </button>
                              {!organizationDadataCollapsedSections.company && (
                                <div
                                  className="organization-dadata-table-wrapper"
                                  ref={organizationDadataCompanyTableWrapperRef}
                                  onDragOver={(event) =>
                                    handleDadataRowDragOver("company", event)
                                  }
                                >
                                  <table className="organization-dadata-table">
                                    <thead>
                                      <tr>
                                        <th>Параметр</th>
                                        <th>Значение</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedOrganizationCompanyInfoRows.length > 0 ? (
                                        selectedOrganizationCompanyInfoRows.map((row) => (
                                          <tr
                                            key={row.key}
                                            draggable
                                            onDragStart={(event) =>
                                              handleDadataRowDragStart(
                                                "company",
                                                row.orderKey ?? row.key,
                                                event
                                              )
                                            }
                                            onDrag={(event) =>
                                              handleDadataRowDrag("company", event)
                                            }
                                            onDragOver={(event) =>
                                              handleDadataRowDragOver("company", event)
                                            }
                                            onDrop={(event) =>
                                              handleDadataRowDrop(
                                                "company",
                                                row.key,
                                                selectedOrganizationCompanyInfoRows,
                                                event
                                              )
                                            }
                                            onDragEnd={handleDadataRowDragEnd}
                                            onMouseDown={(event) => {
                                              if (event.button !== 0) {
                                                return;
                                              }
                                              handleSelectDadataRow("company", row.orderKey ?? row.key);
                                            }}
                                            className={`organization-dadata-row-draggable${
                                              row.isMismatch ? " organization-dadata-row-mismatch" : ""
                                            }${
                                              dadataDraggingRowKey === String(row.key ?? "").trim()
                                                ? " organization-dadata-row-dragging"
                                                : ""
                                            }${
                                              selectedDadataRowBySection.company ===
                                              normalizeDadataOrderKey(row.orderKey ?? row.key)
                                                ? " organization-dadata-row-selected"
                                                : ""
                                            }`}
                                          >
                                            <td>
                                              <label className="organization-dadata-attribute-toggle">
                                                <input
                                                  type="checkbox"
                                                  checked={isDadataAttributeVisible(row.key)}
                                                  onChange={() =>
                                                    toggleDadataAttributeVisibility(row.key)
                                                  }
                                                />
                                                <span>{row.label}</span>
                                              </label>
                                            </td>
                                            <td>{row.value}</td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={2}>Данные отсутствуют</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                            <div className="organization-dadata-array-section">
                              <button
                                type="button"
                                className="report-template-level-toggle organization-dadata-level-toggle"
                                onClick={() => toggleOrganizationDadataSection("address")}
                              >
                                <span className="report-template-level-toggle-icon" aria-hidden="true">
                                  {organizationDadataCollapsedSections.address ? "▸" : "▾"}
                                </span>
                                <span>Адресная информация</span>
                              </button>
                              {!organizationDadataCollapsedSections.address && (
                                <div
                                  className="organization-dadata-table-wrapper"
                                  ref={organizationDadataAddressTableWrapperRef}
                                  onDragOver={(event) =>
                                    handleDadataRowDragOver("address", event)
                                  }
                                >
                                  <table className="organization-dadata-table">
                                    <thead>
                                      <tr>
                                        <th>Параметр</th>
                                        <th>Значение</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedOrganizationAddressInfoRows.length > 0 ? (
                                        selectedOrganizationAddressInfoRows.map((row) => (
                                          <tr
                                            key={row.key}
                                            draggable
                                            onDragStart={(event) =>
                                              handleDadataRowDragStart(
                                                "address",
                                                row.orderKey ?? row.key,
                                                event
                                              )
                                            }
                                            onDrag={(event) =>
                                              handleDadataRowDrag("address", event)
                                            }
                                            onDragOver={(event) =>
                                              handleDadataRowDragOver("address", event)
                                            }
                                            onDrop={(event) =>
                                              handleDadataRowDrop(
                                                "address",
                                                row.key,
                                                selectedOrganizationAddressInfoRows,
                                                event
                                              )
                                            }
                                            onDragEnd={handleDadataRowDragEnd}
                                            onMouseDown={(event) => {
                                              if (event.button !== 0) {
                                                return;
                                              }
                                              handleSelectDadataRow("address", row.orderKey ?? row.key);
                                            }}
                                            className={`organization-dadata-row-draggable${
                                              row.isMismatch ? " organization-dadata-row-mismatch" : ""
                                            }${
                                              dadataDraggingRowKey === String(row.key ?? "").trim()
                                                ? " organization-dadata-row-dragging"
                                                : ""
                                            }${
                                              selectedDadataRowBySection.address ===
                                              normalizeDadataOrderKey(row.orderKey ?? row.key)
                                                ? " organization-dadata-row-selected"
                                                : ""
                                            }`}
                                          >
                                            <td>
                                              <label className="organization-dadata-attribute-toggle">
                                                <input
                                                  type="checkbox"
                                                  checked={isDadataAttributeVisible(row.key)}
                                                  onChange={() =>
                                                    toggleDadataAttributeVisibility(row.key)
                                                  }
                                                />
                                                <span>{row.label}</span>
                                              </label>
                                            </td>
                                            <td>{row.value}</td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={2}>Адресная информация отсутствует</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </section>
                        </div>
                      )}
                    </div>
                  </aside>
                )}
                {isReportSettingsPage && (
                  <aside className={`employee-card-panel report-card-panel${isReportCardVisible ? " open" : ""}`}>
                    <div className="employee-card-panel-header">
                      <h2>Карточка отчета</h2>
                      <div className="employee-card-full-name employee-card-full-name-header">
                        {isCreatingReportCard
                          ? String(reportMainSettingsDraft.name ?? "").trim() || "Новый отчет"
                          : String(selectedReport?.name ?? "").trim() || "-"}
                      </div>
                      <button
                        type="button"
                        className="employee-card-close-button"
                        onClick={handleCloseReportCardPanel}
                        aria-label="Закрыть карточку отчета"
                        title="Закрыть"
                      >
                        ×
                      </button>
                    </div>
                    <div className="employee-card-panel-body">
                      <div className="report-card-tabs" role="tablist" aria-label="Вкладки карточки отчета">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeReportCardTab === REPORT_CARD_TABS.MAIN}
                          className={`report-card-tab${
                            activeReportCardTab === REPORT_CARD_TABS.MAIN ? " active" : ""
                          }`}
                          onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.MAIN)}
                        >
                          Основные настройки
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeReportCardTab === REPORT_CARD_TABS.SQL}
                          className={`report-card-tab${
                            activeReportCardTab === REPORT_CARD_TABS.SQL ? " active" : ""
                          }`}
                          onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.SQL)}
                          disabled={isCreatingReportCard}
                        >
                          SQL-скрипт
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeReportCardTab === REPORT_CARD_TABS.TEMPLATE}
                          className={`report-card-tab${
                            activeReportCardTab === REPORT_CARD_TABS.TEMPLATE ? " active" : ""
                          }`}
                          onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.TEMPLATE)}
                          disabled={isCreatingReportCard}
                        >
                          Настройка шаблона
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeReportCardTab === REPORT_CARD_TABS.PREVIEW}
                          className={`report-card-tab${
                            activeReportCardTab === REPORT_CARD_TABS.PREVIEW ? " active" : ""
                          }`}
                          onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.PREVIEW)}
                          disabled={isCreatingReportCard || !isReportPreviewTabAvailable}
                        >
                          Просмотр отчета
                        </button>
                      </div>
                      {activeReportCardTab === REPORT_CARD_TABS.MAIN && (
                        <div
                          className={`employee-card-main-tab-content report-card-main-tab-content${
                            isReportMainSettingsEditable ? " employee-card-main-tab-content-edit-mode" : ""
                          }`}
                        >
                          <section className="employee-card-section">
                            <div className="employee-card-subordination-header">
                              <h3>Основные настройки</h3>
                              <div className="employee-card-relations-header-actions">
                                {isReportMainSettingsEditable ? (
                                  <>
                                    <button
                                      type="button"
                                      className="panel-action-button"
                                      onClick={handleSaveReportMainSettings}
                                      disabled={isReportMainSettingsSaving || isReportDeleting}
                                    >
                                      Сохранить
                                    </button>
                                    <button
                                      type="button"
                                      className="panel-action-button"
                                      onClick={handleCancelReportMainSettingsEdit}
                                      disabled={isReportMainSettingsSaving || isReportDeleting}
                                    >
                                      Отменить
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="panel-action-button"
                                      onClick={handleOpenReportMainSettingsEdit}
                                      disabled={isReportDeleting}
                                    >
                                      ✎ Изменить
                                    </button>
                                    <button
                                      type="button"
                                      className="panel-action-button"
                                      onClick={handleOpenReportDeleteModal}
                                      disabled={isReportDeleting}
                                    >
                                      🗑 Удалить
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="employee-card-params">
                              <div className="employee-card-params-row">
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Код отчета</span>
                                  {isReportMainSettingsEditable ? (
                                    <input
                                      type="text"
                                      className="employee-card-field-input"
                                      value={reportMainSettingsDraft.codeReport}
                                      onChange={(event) =>
                                        handleChangeReportMainSettingsDraft("codeReport", event.target.value)
                                      }
                                    />
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {String(selectedReport?.codeReport ?? selectedReport?.code_report ?? "").trim() ||
                                        "-"}
                                    </span>
                                  )}
                                </div>
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Версия отчета</span>
                                  {isReportMainSettingsEditable ? (
                                    <input
                                      type="text"
                                      className="employee-card-field-input"
                                      value={reportMainSettingsDraft.version}
                                      onChange={(event) =>
                                        handleChangeReportMainSettingsDraft("version", event.target.value)
                                      }
                                    />
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {String(selectedReport?.version ?? "").trim() || "-"}
                                    </span>
                                  )}
                                </div>
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Наименование отчета</span>
                                  {isReportMainSettingsEditable ? (
                                    <input
                                      type="text"
                                      className="employee-card-field-input"
                                      value={reportMainSettingsDraft.name}
                                      onChange={(event) =>
                                        handleChangeReportMainSettingsDraft("name", event.target.value)
                                      }
                                    />
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {String(selectedReport?.name ?? "").trim() || "-"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="employee-card-params-row">
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Метод формирования</span>
                                  {isReportMainSettingsEditable ? (
                                    <select
                                      className="employee-card-field-input employee-card-field-select"
                                      value={reportMainSettingsDraft.method}
                                      onChange={(event) =>
                                        handleChangeReportMainSettingsDraft("method", event.target.value)
                                      }
                                    >
                                      <option value="AUTO">AUTO</option>
                                      <option value="HAND">HAND</option>
                                    </select>
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {String(selectedReport?.method ?? "").trim() || "-"}
                                    </span>
                                  )}
                                </div>
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Количество дней</span>
                                  {isReportMainSettingsEditable ? (
                                    <input
                                      type="text"
                                      className="employee-card-field-input"
                                      value={reportMainSettingsDraft.numberDays}
                                      onChange={(event) =>
                                        handleChangeReportMainSettingsDraft(
                                          "numberDays",
                                          sanitizePositiveIntegerDraftValue(event.target.value)
                                        )
                                      }
                                    />
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {String(
                                        selectedReport?.numberDays ?? selectedReport?.number_days ?? ""
                                      ).trim() || "-"}
                                    </span>
                                  )}
                                </div>
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Наименование выходного файла</span>
                                  {isReportMainSettingsEditable ? (
                                    <div className="report-output-file-template-help">
                                      <input
                                        type="text"
                                        className="employee-card-field-input"
                                        value={reportMainSettingsDraft.outputFileName}
                                        onChange={(event) =>
                                          handleChangeReportMainSettingsDraft("outputFileName", event.target.value)
                                        }
                                      />
                                      <div className="report-output-file-template-help-text">
                                        Доступные шаблоны: <code>{`{reportName}`}</code>,{" "}
                                        <code>{`{now:dd.MM.yyyy_HH-mm-ss}`}</code>
                                      </div>
                                      <div className="report-output-file-template-help-text">
                                        Пример:{" "}
                                        <code>
                                          {(
                                            resolveExportFileNameTemplate(
                                              String(reportMainSettingsDraft.outputFileName ?? ""),
                                              String(reportMainSettingsDraft.name ?? "").trim() || "Отчет"
                                            ) || String(reportMainSettingsDraft.outputFileName ?? "").trim() || "report"
                                          ) +
                                            "." +
                                            (String(reportMainSettingsDraft.outputFileType ?? "XLSX")
                                              .trim()
                                              .toLowerCase() || "xlsx")}
                                        </code>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {String(
                                        selectedReport?.outputFileName ?? selectedReport?.output_file_name ?? ""
                                      ).trim() || "-"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="employee-card-params-row employee-card-params-row-status">
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Статус</span>
                                  {isReportMainSettingsEditable ? (
                                    <select
                                      className="employee-card-field-input employee-card-field-select"
                                      value={reportMainSettingsDraft.status}
                                      onChange={(event) =>
                                        handleChangeReportMainSettingsDraft("status", event.target.value)
                                      }
                                    >
                                      <option value="ACTIVE">ACTIVE</option>
                                      <option value="INACTIVE">INACTIVE</option>
                                    </select>
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {String(selectedReport?.status ?? "").trim() || "-"}
                                    </span>
                                  )}
                                </div>
                                <div className="employee-card-param">
                                  <span className="employee-card-field-label">Тип выходного файла</span>
                                  {isReportMainSettingsEditable ? (
                                    <select
                                      className="employee-card-field-input employee-card-field-select"
                                      value={reportMainSettingsDraft.outputFileType}
                                      onChange={(event) =>
                                        handleChangeReportMainSettingsDraft("outputFileType", event.target.value)
                                      }
                                    >
                                      <option value="XLSX">XLSX</option>
                                    </select>
                                  ) : (
                                    <span className="employee-card-field-value employee-card-field-value-block">
                                      {String(
                                        selectedReport?.outputFileType ?? selectedReport?.output_file_type ?? ""
                                      ).trim() || "-"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </section>
                          <section
                            className={`employee-card-section report-card-links-section${
                              isCreatingReportCard ? " report-card-section-disabled" : ""
                            }`}
                          >
                            {isCreatingReportCard && (
                              <p className="report-card-links-disabled-note">
                                Сохраните отчет, чтобы управлять связями с организациями, получателями и группами доступа.
                              </p>
                            )}
                            <div className="report-card-links-grid">
                              <div className="report-card-links-card report-card-links-card-organizations">
                                <div className="employee-card-subordination-header">
                                  <h3>Организации</h3>
                                  <button
                                    type="button"
                                    className="panel-action-button employee-card-add-position-button"
                                    onClick={handleOpenReportOrganizationAdd}
                                    disabled={
                                      isCreatingReportCard ||
                                      isReportOrganizationAddMode ||
                                      addingReportOrganization ||
                                      Boolean(deletingReportOrganizationId) ||
                                      Boolean(deletingReportAccessGroupCode) ||
                                      Boolean(deletingReportRecipientEmail)
                                    }
                                  >
                                    + Добавить
                                  </button>
                                </div>
                                {isReportOrganizationAddMode && (
                                  <div className="report-card-links-actions report-card-links-actions-report-organizations">
                                    <div
                                      className={`relation-combobox report-organization-combobox${
                                        isReportOrganizationComboOpen ? " open" : ""
                                      }`}
                                      ref={reportOrganizationComboRef}
                                    >
                                      <input
                                        type="text"
                                        className="relation-combobox-trigger employee-card-relations-filter-input"
                                        value={
                                          isReportOrganizationComboOpen
                                            ? reportOrganizationSearch
                                            : (
                                                reportOrganizationOptions.find(
                                                  (item) =>
                                                    item.organUnitId ===
                                                    String(selectedReportOrganizationIdForAdd ?? "").trim()
                                                )?.organUnitName ?? reportOrganizationSearch
                                              )
                                        }
                                        placeholder="Выберите сбытовую организацию"
                                        onFocus={() => {
                                          setIsReportOrganizationComboOpen(true);
                                          if (!reportOrganizationOptions.length) {
                                            void fetchReportOrganizationOptions(reportOrganizationSearch);
                                          }
                                        }}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          setReportOrganizationSearch(value);
                                          setSelectedReportOrganizationIdForAdd("");
                                          setIsReportOrganizationComboOpen(true);
                                          void fetchReportOrganizationOptions(value);
                                        }}
                                      />
                                      {String(reportOrganizationSearch ?? "").trim() && (
                                        <button
                                          type="button"
                                          className="relation-combobox-clear-button"
                                          aria-label="Очистить поле"
                                          onClick={() => {
                                            setReportOrganizationSearch("");
                                            setSelectedReportOrganizationIdForAdd("");
                                            setReportOrganizationOptions([]);
                                            setIsReportOrganizationComboOpen(false);
                                          }}
                                        >
                                          ×
                                        </button>
                                      )}
                                      {isReportOrganizationComboOpen && (
                                        <div className="relation-combobox-menu report-organization-combobox-menu">
                                          <div className="relation-combobox-options">
                                            {reportOrganizationOptions.length === 0 ? (
                                              <div className="relation-combobox-empty">Нет данных</div>
                                            ) : (
                                              reportOrganizationOptions.map((item) => (
                                                <button
                                                  key={item.organUnitId}
                                                  type="button"
                                                  className="relation-combobox-option"
                                                  onMouseEnter={(event) => {
                                                    const tooltipText = formatOrganizationTooltip({
                                                      organName: item.fieldName,
                                                      sapId: item.sapId,
                                                      inn: item.inn,
                                                      kpp: item.kpp,
                                                      ogrn: item.ogrn,
                                                      fullAddress: item.fullAddress
                                                    });
                                                    handleCellMouseEnter(event, tooltipText, tooltipText);
                                                  }}
                                                  onMouseMove={updateCellTooltipPosition}
                                                  onMouseLeave={handleCellMouseLeave}
                                                  onClick={() => {
                                                    setSelectedReportOrganizationIdForAdd(item.organUnitId);
                                                    setReportOrganizationSearch(item.organUnitName);
                                                    setIsReportOrganizationComboOpen(false);
                                                  }}
                                                >
                                                  {item.organUnitName}
                                                </button>
                                              ))
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      className="employee-card-position-action-button"
                                      onClick={() => void handleAddReportOrganization()}
                                      disabled={
                                        isCreatingReportCard ||
                                        addingReportOrganization ||
                                        !selectedReportOrganizationIdForAdd ||
                                        Boolean(deletingReportOrganizationId) ||
                                        Boolean(deletingReportAccessGroupCode) ||
                                        Boolean(deletingReportRecipientEmail)
                                      }
                                      aria-label="Сохранить связь с организацией"
                                      title="Сохранить"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      className="employee-card-position-action-button"
                                      onClick={handleCancelReportOrganizationAdd}
                                      disabled={addingReportOrganization}
                                      aria-label="Отменить добавление связи с организацией"
                                      title="Отменить"
                                    >
                                      ↩
                                    </button>
                                  </div>
                                )}
                                <div className="report-card-links-table-wrapper">
                                  <table className="employee-card-positions-table report-card-links-table">
                                    <tbody>
                                      {selectedReportOrganizations.length > 0 ? (
                                        selectedReportOrganizations.map((item) => {
                                          const rowKey = item.organUnitId || item.organUnitName;
                                          const isDeleting =
                                            deletingReportOrganizationId === item.organUnitId &&
                                            Boolean(item.organUnitId);
                                          return (
                                            <tr key={`report-organization-${rowKey}`}>
                                              <td>{item.organUnitName || item.organUnitId || "-"}</td>
                                              <td className="employee-card-positions-actions-cell">
                                                <button
                                                  type="button"
                                                  className="employee-card-position-action-button"
                                                  onClick={() =>
                                                    void handleDeleteReportOrganization(item.organUnitId)
                                                  }
                                                  disabled={
                                                    isCreatingReportCard ||
                                                    !item.organUnitId ||
                                                    isDeleting ||
                                                    Boolean(deletingReportAccessGroupCode) ||
                                                    Boolean(deletingReportRecipientEmail)
                                                  }
                                                  aria-label="Удалить связь с организацией"
                                                  title="Удалить"
                                                >
                                                  {isDeleting ? "..." : "✕"}
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })
                                      ) : (
                                        <tr>
                                          <td colSpan={2} className="report-card-links-empty-cell">
                                            Нет связанных организаций
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              <div className="report-card-links-card report-card-links-card-recipients">
                                <div className="employee-card-subordination-header">
                                  <h3>Email получателей</h3>
                                  <button
                                    type="button"
                                    className="panel-action-button employee-card-add-position-button"
                                    onClick={handleOpenReportRecipientAdd}
                                    disabled={
                                      isCreatingReportCard ||
                                      isReportRecipientAddMode ||
                                      addingReportRecipient ||
                                      Boolean(deletingReportOrganizationId) ||
                                      Boolean(deletingReportAccessGroupCode) ||
                                      Boolean(deletingReportRecipientEmail)
                                    }
                                  >
                                    + Добавить
                                  </button>
                                </div>
                                {isReportRecipientAddMode && (
                                  <div className="report-card-links-actions report-card-links-actions-report-recipients">
                                    <input
                                      type="text"
                                      className="employee-card-field-input"
                                      value={newReportRecipientEmail}
                                      onChange={(event) => setNewReportRecipientEmail(event.target.value)}
                                      placeholder="Введите email"
                                      disabled={addingReportRecipient || Boolean(deletingReportRecipientEmail)}
                                    />
                                    <button
                                      type="button"
                                      className="employee-card-position-action-button"
                                      onClick={() => void handleAddReportRecipient()}
                                      disabled={
                                        isCreatingReportCard ||
                                        addingReportRecipient ||
                                        !String(newReportRecipientEmail ?? "").trim() ||
                                        Boolean(deletingReportOrganizationId) ||
                                        Boolean(deletingReportAccessGroupCode) ||
                                        Boolean(deletingReportRecipientEmail)
                                      }
                                      aria-label="Сохранить получателя отчета"
                                      title="Сохранить"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      className="employee-card-position-action-button"
                                      onClick={handleCancelReportRecipientAdd}
                                      disabled={addingReportRecipient}
                                      aria-label="Отменить добавление получателя отчета"
                                      title="Отменить"
                                    >
                                      ↩
                                    </button>
                                  </div>
                                )}
                                <div className="report-card-links-table-wrapper">
                                  <table className="employee-card-positions-table report-card-links-table">
                                    <tbody>
                                      {selectedReportRecipients.length > 0 ? (
                                        selectedReportRecipients.map((item) => {
                                          const isDeleting = deletingReportRecipientEmail === item.email;
                                          return (
                                            <tr key={`report-recipient-${item.email}`}>
                                              <td>{item.email}</td>
                                              <td className="employee-card-positions-actions-cell">
                                                <button
                                                  type="button"
                                                  className="employee-card-position-action-button"
                                                  onClick={() =>
                                                    void handleDeleteReportRecipient(item.email)
                                                  }
                                                  disabled={
                                                    isCreatingReportCard ||
                                                    !item.email ||
                                                    isDeleting ||
                                                    Boolean(deletingReportOrganizationId) ||
                                                    Boolean(deletingReportAccessGroupCode)
                                                  }
                                                  aria-label="Удалить получателя отчета"
                                                  title="Удалить"
                                                >
                                                  {isDeleting ? "..." : "✕"}
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })
                                      ) : (
                                        <tr>
                                          <td colSpan={2} className="report-card-links-empty-cell">
                                            Нет получателей отчета
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              <div className="report-card-links-card report-card-links-card-access-groups">
                                <div className="employee-card-subordination-header">
                                  <h3>Группы доступа</h3>
                                  <button
                                    type="button"
                                    className="panel-action-button employee-card-add-position-button"
                                    onClick={handleOpenReportAccessGroupAdd}
                                    disabled={
                                      isCreatingReportCard ||
                                      isReportAccessGroupAddMode ||
                                      addingReportAccessGroup ||
                                      Boolean(deletingReportOrganizationId) ||
                                      Boolean(deletingReportAccessGroupCode) ||
                                      Boolean(deletingReportRecipientEmail)
                                    }
                                  >
                                    + Добавить
                                  </button>
                                </div>
                                {isReportAccessGroupAddMode && (
                                  <div className="report-card-links-actions report-card-links-actions-report-access-groups">
                                    <select
                                      className="employee-card-field-input employee-card-field-select"
                                      value={newReportAccessGroupCode}
                                      onChange={(event) =>
                                        setNewReportAccessGroupCode(String(event.target.value ?? ""))
                                      }
                                      disabled={addingReportAccessGroup || Boolean(deletingReportAccessGroupCode)}
                                    >
                                      {REPORT_ACCESS_GROUP_ENUM.map((codeAccess) => (
                                        <option key={codeAccess} value={codeAccess}>
                                          {codeAccess}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="employee-card-position-action-button"
                                      onClick={() => void handleAddReportAccessGroup()}
                                      disabled={
                                        isCreatingReportCard ||
                                        addingReportAccessGroup ||
                                        !String(newReportAccessGroupCode ?? "").trim() ||
                                        Boolean(deletingReportOrganizationId) ||
                                        Boolean(deletingReportAccessGroupCode) ||
                                        Boolean(deletingReportRecipientEmail)
                                      }
                                      aria-label="Сохранить группу доступа"
                                      title="Сохранить"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      className="employee-card-position-action-button"
                                      onClick={handleCancelReportAccessGroupAdd}
                                      disabled={addingReportAccessGroup}
                                      aria-label="Отменить добавление группы доступа"
                                      title="Отменить"
                                    >
                                      ↩
                                    </button>
                                  </div>
                                )}
                                <div className="report-card-links-table-wrapper">
                                  <table className="employee-card-positions-table report-card-links-table">
                                    <tbody>
                                      {selectedReportAccessGroups.length > 0 ? (
                                        selectedReportAccessGroups.map((item) => {
                                          const isDeleting = deletingReportAccessGroupCode === item.codeAccess;
                                          return (
                                            <tr key={`report-access-group-${item.codeAccess}`}>
                                              <td>{item.codeAccess}</td>
                                              <td className="employee-card-positions-actions-cell">
                                                <button
                                                  type="button"
                                                  className="employee-card-position-action-button"
                                                  onClick={() =>
                                                    void handleDeleteReportAccessGroup(item.codeAccess)
                                                  }
                                                  disabled={
                                                    isCreatingReportCard ||
                                                    !item.codeAccess ||
                                                    isDeleting ||
                                                    Boolean(deletingReportOrganizationId) ||
                                                    Boolean(deletingReportRecipientEmail)
                                                  }
                                                  aria-label="Удалить группу доступа"
                                                  title="Удалить"
                                                >
                                                  {isDeleting ? "..." : "✕"}
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })
                                      ) : (
                                        <tr>
                                          <td colSpan={2} className="report-card-links-empty-cell">
                                            Нет групп доступа
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </section>
                        </div>
                      )}
                      {activeReportCardTab === REPORT_CARD_TABS.SQL && (
                        <div className="report-card-tab-content">
                          <section className="employee-card-section report-card-sql-section">
                            <div className="employee-card-subordination-header report-card-sql-header">
                              <h3>SQL-скрипт</h3>
                              <div className="report-card-sql-header-actions">
                                {!isReportSqlEditMode ? (
                                  <>
                                    <button
                                      type="button"
                                      className={`panel-action-button report-card-sql-view-button${
                                        reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR ? " is-active" : ""
                                      }`}
                                      onClick={handleOpenReportSqlEditorView}
                                      disabled={reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR}
                                    >
                                      Редактор
                                    </button>
                                    <button
                                      type="button"
                                      className={`panel-action-button report-card-sql-view-button${
                                        reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS ? " is-active" : ""
                                      }`}
                                      onClick={handleOpenReportSqlResultsView}
                                      disabled={reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS}
                                    >
                                      Результаты запроса
                                    </button>
                                  </>
                                ) : null}
                                {reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR ? (
                                  isReportSqlEditMode ? (
                                    <>
                                      <button
                                        type="button"
                                        className="panel-action-button"
                                        onClick={handleEditOrSaveReportSql}
                                        disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                      >
                                        Сохранить
                                      </button>
                                      <button
                                        type="button"
                                        className="panel-action-button"
                                        onClick={handleCancelReportSqlEdit}
                                        disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                      >
                                        Отменить
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="panel-action-button"
                                      onClick={handleEditOrSaveReportSql}
                                      disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                    >
                                      Изменить скрипт
                                    </button>
                                  )
                                ) : null}
                                <button
                                  type="button"
                                  className="panel-action-button report-card-sql-zoom-button"
                                  onClick={handleDecreaseReportSqlZoom}
                                  aria-label="Отдалить текст SQL"
                                  title="Отдалить"
                                  disabled={reportSqlZoom <= 0.7}
                                >
                                  −
                                </button>
                                <button
                                  type="button"
                                  className="panel-action-button report-card-sql-zoom-button"
                                  onClick={handleIncreaseReportSqlZoom}
                                  aria-label="Приблизить текст SQL"
                                  title="Приблизить"
                                  disabled={reportSqlZoom >= 1.6}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <div className="report-card-sql-layout">
                              <div className="report-card-sql-main">
                                <div
                                  className={`report-card-sql-main-view${
                                    reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR ? "" : " is-hidden"
                                  }`}
                                >
                                  {isReportSqlEditMode ? (
                                    <div
                                      className="report-card-sql-editor-wrapper is-editing"
                                      style={{
                                        "--sql-font-size-px": `${reportSqlFontSizePx}px`,
                                        "--sql-line-height-px": `${reportSqlLineHeightPx}px`
                                      }}
                                    >
                                      <div
                                        className="report-card-sql-active-line"
                                        style={{ top: `${reportSqlActiveLineTopPx}px` }}
                                        aria-hidden="true"
                                      />
                                      <pre
                                        ref={reportSqlGutterRef}
                                        className="report-card-sql-gutter"
                                        aria-hidden="true"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={handleReportSqlGutterClick}
                                      >
                                        {reportSqlLineNumbers}
                                      </pre>
                                      <pre
                                        ref={reportSqlHighlightRef}
                                        className="report-card-sql-highlight"
                                        aria-hidden="true"
                                      >
                                        <code
                                          className="language-sql"
                                          dangerouslySetInnerHTML={{ __html: highlightedReportSql }}
                                        />
                                      </pre>
                                      <textarea
                                        ref={reportSqlEditorRef}
                                        className="report-card-sql-editor"
                                        aria-label="SQL query editor"
                                        value={reportSqlDraft}
                                        spellCheck={false}
                                        onScroll={handleReportSqlEditorScroll}
                                        onSelect={(event) => updateReportSqlActiveLineFromTarget(event.target)}
                                        onKeyUp={(event) => updateReportSqlActiveLineFromTarget(event.target)}
                                        onClick={(event) => updateReportSqlActiveLineFromTarget(event.target)}
                                        onChange={(event) => {
                                          setReportSqlDraft(event.target.value);
                                          updateReportSqlActiveLineFromTarget(event.target);
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <pre
                                      className="report-card-sql-code"
                                      aria-label="SQL query with syntax highlighting"
                                      style={{
                                        "--sql-font-size-px": `${reportSqlFontSizePx}px`,
                                        "--sql-line-height-px": `${reportSqlLineHeightPx}px`
                                      }}
                                    >
                                      <code
                                        className="language-sql"
                                        dangerouslySetInnerHTML={{ __html: highlightedReportSql }}
                                      />
                                    </pre>
                                  )}
                                </div>
                                <div
                                  className={`report-card-sql-main-view${
                                    reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS ? "" : " is-hidden"
                                  }`}
                                >
                                  <div
                                    className="report-sql-results-wrapper"
                                    ref={reportSqlResultsWrapperRef}
                                    onScroll={handleReportSqlResultsScroll}
                                    style={{
                                      "--sql-font-size-px": `${reportSqlFontSizePx}px`,
                                      "--sql-line-height-px": `${reportSqlLineHeightPx}px`
                                    }}
                                  >
                                    <MemoizedReportSqlResultsContent
                                      isLoading={isReportSqlResultsLoading}
                                      error={reportSqlResultsError}
                                      columns={reportSqlResultsColumns}
                                      rows={sortedReportSqlResultsRows}
                                      getSortDirectionForField={getReportSqlResultsSortDirectionForField}
                                      getSortOrderForField={getReportSqlResultsSortOrderForField}
                                      onSortClick={handleReportSqlResultsSortClick}
                                      formatCellValue={formatReportSqlResultCellValue}
                                    />
                                    {!isReportSqlResultsLoading && isReportSqlResultsLoadingMore && (
                                      <div className="report-sql-results-loading-more">Загрузка следующих записей...</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="report-card-sql-actions">
                              <div className="report-card-sql-actions-left">
                                {reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS ? (
                                  <button
                                    type="button"
                                    className="panel-action-button"
                                    onClick={handleRefreshReportSqlResults}
                                    disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                  >
                                    {isReportSqlResultsLoading || isReportSqlResultsLoadingMore
                                      ? "Обновление результатов..."
                                      : "Обновить результаты"}
                                  </button>
                                ) : null}
                              </div>
                              {reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR && (
                                <div className="report-card-sql-actions-right">
                                  <span className="report-card-sql-caret-info">
                                    Строка: {reportSqlCaretInfo.line}, символ: {reportSqlCaretInfo.column}, позиция:{" "}
                                    {reportSqlCaretInfo.position}
                                  </span>
                                </div>
                              )}
                              {reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS && (
                                <div className="report-card-sql-actions-right">
                                  <span>
                                    Найдено записей: {Number(reportSqlResultsStats.selectedRows).toLocaleString("ru-RU")},
                                    {" "}на экран выведены первые {REPORT_SQL_RESULTS_PREVIEW_LIMIT} (для проверки
                                    корректности запроса)
                                  </span>
                                  <span>
                                    Время выполнения: {reportSqlResultsStats.executionTime} (
                                    {Number(reportSqlResultsStats.executionMs).toLocaleString("ru-RU")} мс)
                                  </span>
                                </div>
                              )}
                            </div>
                          </section>
                        </div>
                      )}
                      {activeReportCardTab === REPORT_CARD_TABS.TEMPLATE && (
                        <div className="report-card-tab-content">
                          <section className="employee-card-section report-template-settings-section">
                            <div className="employee-card-subordination-header">
                            <h3>Настройка шаблона</h3>
                              {!isReportTemplateSettingsLoading && (
                                <div className="report-template-settings-actions">
                                  {isReportTemplateSqlSyncing && (
                                    <span className="report-template-sql-sync-indicator">
                                      Сверка с SQL...
                                    </span>
                                  )}
                                  {reportTemplateViewMode === REPORT_TEMPLATE_VIEW_MODES.SETTINGS ? (
                                    isReportTemplateEditMode ? (
                                      <>
                                        <button
                                          type="button"
                                          className="panel-action-button"
                                          onClick={handleRefreshReportTemplateFieldsFromSql}
                                          disabled={isReportTemplateSettingsSaving || isReportSqlEditMode}
                                        >
                                          Обновить
                                        </button>
                                        <button
                                          type="button"
                                          className="panel-action-button"
                                          onClick={handleSaveReportTemplateSettings}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          {isReportTemplateSettingsSaving ? "Сохранение..." : "Сохранить"}
                                        </button>
                                        <button
                                          type="button"
                                          className="panel-action-button"
                                          onClick={handleCancelReportTemplateEdit}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          Отменить
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          className="panel-action-button"
                                          onClick={handleOpenReportTemplateJsonView}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          Параметры json
                                        </button>
                                        <button
                                          type="button"
                                          className="panel-action-button"
                                          onClick={handleStartReportTemplateEdit}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          Изменить
                                        </button>
                                      </>
                                    )
                                  ) : isReportTemplateJsonEditMode ? (
                                    <>
                                      <button
                                        type="button"
                                        className="panel-action-button"
                                        onClick={handleSaveReportTemplateJson}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        {isReportTemplateSettingsSaving ? "Сохранение..." : "Сохранить"}
                                      </button>
                                      <button
                                        type="button"
                                        className="panel-action-button"
                                        onClick={handleCancelReportTemplateJsonEdit}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Отменить
                                      </button>
                                      <button
                                        type="button"
                                        className="panel-action-button report-card-sql-zoom-button"
                                        onClick={handleDecreaseReportTemplateJsonZoom}
                                        aria-label="Отдалить текст JSON"
                                        title="Отдалить"
                                        disabled={reportTemplateJsonZoom <= 0.7}
                                      >
                                        −
                                      </button>
                                      <button
                                        type="button"
                                        className="panel-action-button report-card-sql-zoom-button"
                                        onClick={handleIncreaseReportTemplateJsonZoom}
                                        aria-label="Приблизить текст JSON"
                                        title="Приблизить"
                                        disabled={reportTemplateJsonZoom >= 1.6}
                                      >
                                        +
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="panel-action-button"
                                        onClick={handleOpenReportTemplateSettingsView}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Настройка параметров
                                      </button>
                                      <button
                                        type="button"
                                        className="panel-action-button"
                                        onClick={handleDownloadReportTemplateJson}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Выгрузить json
                                      </button>
                                      <button
                                        type="button"
                                        className="panel-action-button"
                                        onClick={handleUploadReportTemplateJsonClick}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Загрузить json
                                      </button>
                                      <button
                                        type="button"
                                        className="panel-action-button"
                                        onClick={handleToggleReportTemplateJsonEdit}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Изменить
                                      </button>
                                      <button
                                        type="button"
                                        className="panel-action-button report-card-sql-zoom-button"
                                        onClick={handleDecreaseReportTemplateJsonZoom}
                                        aria-label="Отдалить текст JSON"
                                        title="Отдалить"
                                        disabled={reportTemplateJsonZoom <= 0.7}
                                      >
                                        −
                                      </button>
                                      <button
                                        type="button"
                                        className="panel-action-button report-card-sql-zoom-button"
                                        onClick={handleIncreaseReportTemplateJsonZoom}
                                        aria-label="Приблизить текст JSON"
                                        title="Приблизить"
                                        disabled={reportTemplateJsonZoom >= 1.6}
                                      >
                                        +
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            <input
                              ref={reportTemplateJsonFileInputRef}
                              type="file"
                              accept=".json,application/json"
                              hidden
                              onChange={handleReportTemplateJsonFileSelect}
                            />

                            <div className="report-template-content-shell">
                              {!hasReportTemplateContentLoaded ? (
                                <div className="report-template-loading-state">Загрузка настроек шаблона...</div>
                              ) : (
                                <>
                                <div
                                  className={`report-template-content-slider${
                                    reportTemplateViewMode === REPORT_TEMPLATE_VIEW_MODES.JSON ? " is-json" : ""
                                  }`}
                                >
                                  <div className="report-template-content-track">
                                    <div className="report-template-content-pane report-template-content-pane-settings">
                                <div className="report-template-level-section report-template-level-section-two">
                                  <button
                                    type="button"
                                    className="report-template-level-toggle"
                                    onClick={() => setIsReportTemplateLevelTwoExpanded((prev) => !prev)}
                                  >
                                    <span className="report-template-level-toggle-icon" aria-hidden="true">
                                      {isReportTemplateLevelTwoExpanded ? "▾" : "▸"}
                                    </span>
                                    <span>Логотип и общие настройки</span>
                                  </button>
                                  {isReportTemplateLevelTwoExpanded ? (
                                <div className="report-template-top-grid">
                                  <div className="report-template-logo-card">
                                    <h4>Логотип</h4>
                                    <label
                                      className={`report-template-logo-uploader${
                                        isReportTemplateEditMode ? " editable" : ""
                                      }`}
                                    >
                                      {reportTemplateLogoBase64 ? (
                                        <img
                                          src={`data:${reportTemplateLogoMimeType || "image/png"};base64,${reportTemplateLogoBase64}`}
                                          alt="Логотип отчета"
                                        />
                                      ) : (
                                        <span className="report-template-logo-placeholder">Логотип не задан</span>
                                      )}
                                      <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                        hidden
                                        disabled={!isReportTemplateEditMode}
                                        onChange={handleReportTemplateLogoSelect}
                                      />
                                    </label>
                                    {isReportTemplateEditMode && reportTemplateLogoBase64 ? (
                                      <button
                                        type="button"
                                        className="panel-action-button report-template-logo-clear-button"
                                        onClick={handleClearReportTemplateLogo}
                                      >
                                        ✕ Очистить логотип
                                      </button>
                                    ) : null}
                                  </div>

                                  <div className="report-template-general-card">
                                    <h4>Общие настройки</h4>
                                    <div
                                      className="report-template-general-table-wrapper"
                                      ref={reportTemplateGeneralSettingsTableWrapperRef}
                                    >
                                      <table className="report-template-general-table">
                                        <colgroup>
                                          <col style={{ width: `${reportTemplateGeneralParameterColumnWidth}px` }} />
                                          <col />
                                        </colgroup>
                                        <thead>
                                          <tr>
                                            <th>
                                              <button
                                                type="button"
                                                className="column-sort-button report-template-general-sort-button"
                                                onClick={handleToggleReportTemplateGeneralSettingsSort}
                                              >
                                                <span>{REPORT_TEMPLATE_GENERAL_SETTINGS_COLUMNS.parameter.title}</span>
                                                <span className="sort-icon-group">
                                                  <span className="sort-icon">
                                                    {reportTemplateGeneralSettingsSortDirection ===
                                                    REPORT_TEMPLATE_GENERAL_SETTINGS_SORT_DIRECTIONS.ASC
                                                      ? "▲"
                                                      : "▼"}
                                                  </span>
                                                </span>
                                              </button>
                                              <span
                                                className="column-resize-handle"
                                                onMouseDown={
                                                  handleResizeReportTemplateGeneralSettingsParameterColumnStart
                                                }
                                                role="presentation"
                                              />
                                            </th>
                                            <th>{REPORT_TEMPLATE_GENERAL_SETTINGS_COLUMNS.value.title}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {reportTemplateGeneralSettingsRows.map((row) => {
                                            const rowValue = reportTemplateSettingsDraft[row.key];
                                            const isBooleanField = row.type === "boolean";
                                            const isNumberField = row.type === "number";
                                            const isColorField = row.type === "color";
                                            const isTextField = row.type === "text";
                                            return (
                                              <tr key={`report-template-general-${row.key}`}>
                                                <td>{row.label}</td>
                                                <td>
                                                  {isReportTemplateEditMode ? (
                                                    isBooleanField ? (
                                                      <select
                                                        className="employee-card-field-input employee-card-field-select"
                                                        value={rowValue ? "true" : "false"}
                                                        onChange={(event) =>
                                                          handleChangeReportTemplateField(
                                                            row.key,
                                                            String(event.target.value) === "true"
                                                          )
                                                        }
                                                      >
                                                        <option value="true">ДА</option>
                                                        <option value="false">НЕТ</option>
                                                      </select>
                                                    ) : isColorField ? (
                                                      <div className="report-template-color-input-group">
                                                        <input
                                                          type="color"
                                                          className="report-template-color-picker"
                                                          value={normalizeHexColorOrDefault(rowValue, "#000000")}
                                                          onChange={(event) =>
                                                            handleChangeReportTemplateField(
                                                              row.key,
                                                              String(event.target.value ?? "").toUpperCase()
                                                            )
                                                          }
                                                        />
                                                        <input
                                                          type="text"
                                                          className="employee-card-field-input"
                                                          defaultValue={String(rowValue ?? "")}
                                                          key={`report-template-general-color-text-${row.key}-${String(
                                                            rowValue ?? ""
                                                          )}`}
                                                          inputMode="text"
                                                          maxLength={7}
                                                          onBlur={(event) =>
                                                            handleChangeReportTemplateField(row.key, event.target.value)
                                                          }
                                                          onKeyDown={(event) => {
                                                            if (event.key === "Enter") {
                                                              event.preventDefault();
                                                              event.currentTarget.blur();
                                                            }
                                                          }}
                                                        />
                                                      </div>
                                                    ) : (
                                                      <input
                                                        type="text"
                                                        className="employee-card-field-input"
                                                        defaultValue={String(rowValue ?? "")}
                                                        key={`report-template-general-text-${row.key}-${String(
                                                          rowValue ?? ""
                                                        )}`}
                                                        inputMode={isNumberField ? "numeric" : "text"}
                                                        maxLength={isColorField ? 7 : undefined}
                                                        onBlur={(event) =>
                                                          handleChangeReportTemplateField(row.key, event.target.value)
                                                        }
                                                        onKeyDown={(event) => {
                                                          if (event.key === "Enter") {
                                                            event.preventDefault();
                                                            event.currentTarget.blur();
                                                          }
                                                        }}
                                                      />
                                                    )
                                                  ) : isBooleanField ? (
                                                    rowValue ? (
                                                      "ДА"
                                                    ) : (
                                                      "НЕТ"
                                                    )
                                                  ) : isTextField ? (
                                                    String(rowValue ?? "").trim() || "-"
                                                  ) : (
                                                    String(rowValue ?? "").trim() || "-"
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                                  ) : null}
                                </div>
                                <div
                                  className={`report-template-level-gap${
                                    !isReportTemplateLevelTwoExpanded && !isReportTemplateLevelThreeExpanded
                                      ? " is-collapsed"
                                      : ""
                                  }`}
                                  aria-hidden="true"
                                />

                                <div className="report-template-level-section report-template-level-section-three">
                                <div
                                  className="report-template-fields-card"
                                >
                                  <div className="report-template-fields-header">
                                    <button
                                      type="button"
                                      className="report-template-level-toggle report-template-level-toggle-inline"
                                      onClick={() => setIsReportTemplateLevelThreeExpanded((prev) => !prev)}
                                    >
                                      <span className="report-template-level-toggle-icon" aria-hidden="true">
                                        {isReportTemplateLevelThreeExpanded ? "▾" : "▸"}
                                      </span>
                                      <span>Настройка столбцов</span>
                                    </button>
                                  </div>
                                  {isReportTemplateLevelThreeExpanded ? (
                                  <div
                                    className="report-template-fields-table-wrapper"
                                    ref={reportTemplateFieldsTableWrapperRef}
                                    onDragOver={handleReportTemplateFieldsWrapperDragOver}
                                  >
                                    <table
                                      className="report-template-fields-table"
                                      style={{ width: `${reportTemplateFieldsTableWidthPx}px` }}
                                    >
                                      <colgroup>
                                        {REPORT_TEMPLATE_FIELDS_COLUMNS.map((column) => (
                                          <col
                                            key={`report-template-fields-col-${column.key}`}
                                            style={{
                                              width: `${
                                                Number(reportTemplateFieldsColumnWidths[column.key]) ||
                                                REPORT_TEMPLATE_FIELDS_DEFAULT_COLUMN_WIDTHS[column.key]
                                              }px`
                                            }}
                                          />
                                        ))}
                                      </colgroup>
                                      <thead>
                                        <tr>
                                          {REPORT_TEMPLATE_FIELDS_COLUMNS.map((column) => {
                                            return (
                                              <th key={column.key}>
                                                <div className="column-sort-button">
                                                  <span>{column.title}</span>
                                                </div>
                                                <span
                                                  className="column-resize-handle"
                                                  onMouseDown={(event) =>
                                                    handleResizeReportTemplateFieldColumnStart(column.key, event)
                                                  }
                                                  role="presentation"
                                                />
                                              </th>
                                            );
                                          })}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Array.isArray(reportTemplateSettingsDraft.fields) &&
                                        reportTemplateSettingsDraft.fields.length > 0 ? (
                                          sortedReportTemplateFields.map(({ field, sourceIndex }) => {
                                            const isFieldVisible = isReportTemplateFieldVisible(field);
                                            const isRowEditable = isReportTemplateEditMode && isFieldVisible;
                                            const fieldType = String(field.fieldDataType ?? "text").trim().toLowerCase();
                                            const fieldFormatOptions =
                                              REPORT_TEMPLATE_DATA_FORMAT_OPTIONS[fieldType] ??
                                              REPORT_TEMPLATE_DATA_FORMAT_OPTIONS.text;
                                            return (
                                              <tr
                                                key={`report-template-field-${sourceIndex}`}
                                                className={
                                                  !isFieldVisible ? "report-template-fields-row report-template-fields-row-hidden" : ""
                                                }
                                                onDragOver={(event) =>
                                                  handleReportTemplateFieldDragOver(sourceIndex, event)
                                                }
                                                onDrop={(event) => handleReportTemplateFieldDrop(sourceIndex, event)}
                                              >
                                                <td>
                                                  {isFieldVisible
                                                    ? String(
                                                        reportTemplateVisibleOrderBySourceIndex.get(sourceIndex) ?? "-"
                                                      )
                                                    : "-"}
                                                </td>
                                                <td>
                                                  <div className="report-template-field-name-cell">
                                                    {isReportTemplateEditMode && (
                                                      <span
                                                        className="report-template-row-drag-handle"
                                                        draggable={isFieldVisible}
                                                        onDragStart={(event) =>
                                                            handleReportTemplateFieldDragStart(
                                                              sourceIndex,
                                                              field.fieldName,
                                                              event
                                                            )
                                                        }
                                                        onDrag={handleReportTemplateFieldDrag}
                                                        onDragEnd={handleReportTemplateFieldDragEnd}
                                                        title={isFieldVisible ? "Перетащить строку" : "Строка скрыта"}
                                                        aria-label={isFieldVisible ? "Перетащить строку" : "Строка скрыта"}
                                                      >
                                                        ⋮⋮
                                                      </span>
                                                    )}
                                                    <span
                                                      className="report-template-cell-overflow-text"
                                                      onMouseEnter={(event) =>
                                                        handleCellMouseEnter(event, String(field.fieldName ?? "").trim())
                                                      }
                                                      onMouseMove={updateCellTooltipPosition}
                                                      onMouseLeave={handleCellMouseLeave}
                                                    >
                                                      {String(field.fieldName ?? "").trim() || "-"}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td>
                                                  {isReportTemplateEditMode ? (
                                                    <select
                                                      className="employee-card-field-input employee-card-field-select"
                                                      value={isFieldVisible ? "true" : "false"}
                                                      onChange={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "reportVisible",
                                                          String(event.target.value) === "true"
                                                        )
                                                      }
                                                    >
                                                      <option value="true">ДА</option>
                                                      <option value="false">НЕТ</option>
                                                    </select>
                                                  ) : isFieldVisible ? (
                                                    "ДА"
                                                  ) : (
                                                    "НЕТ"
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <input
                                                      type="text"
                                                      className="employee-card-field-input"
                                                      defaultValue={String(field.fieldCaption ?? "")}
                                                      key={`report-template-field-caption-${sourceIndex}-${String(
                                                        field.fieldCaption ?? ""
                                                      )}`}
                                                      onBlur={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "fieldCaption",
                                                          event.target.value
                                                        )
                                                      }
                                                      onKeyDown={(event) => {
                                                        if (event.key === "Enter") {
                                                          event.preventDefault();
                                                          event.currentTarget.blur();
                                                        }
                                                      }}
                                                    />
                                                  ) : (
                                                    renderReportTemplateFieldOverflowText(field.fieldCaption)
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <select
                                                      className="employee-card-field-input employee-card-field-select"
                                                      value={fieldType}
                                                      onChange={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "fieldDataType",
                                                          event.target.value
                                                        )
                                                      }
                                                    >
                                                      {REPORT_TEMPLATE_DATA_TYPE_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                          {option.label}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  ) : (
                                                    renderReportTemplateFieldOverflowText(
                                                      REPORT_TEMPLATE_DATA_TYPE_OPTIONS.find(
                                                        (option) => option.value === fieldType
                                                      )?.label
                                                    )
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <select
                                                      className="employee-card-field-input employee-card-field-select"
                                                      value={String(field.fieldDataFormat ?? "")}
                                                      onChange={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "fieldDataFormat",
                                                          event.target.value
                                                        )
                                                      }
                                                    >
                                                      {fieldFormatOptions.map((option) => (
                                                        <option key={option.value || "empty"} value={option.value}>
                                                          {option.label}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  ) : (
                                                    renderReportTemplateFieldOverflowText(field.fieldDataFormat)
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <select
                                                      className="employee-card-field-input employee-card-field-select"
                                                      value={String(field.fieldVertAlign ?? "ВЕРХ")}
                                                      onChange={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "fieldVertAlign",
                                                          event.target.value
                                                        )
                                                      }
                                                    >
                                                      {REPORT_TEMPLATE_VERTICAL_ALIGN_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                          {option.label}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  ) : (
                                                    renderReportTemplateFieldOverflowText(field.fieldVertAlign)
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <select
                                                      className="employee-card-field-input employee-card-field-select"
                                                      value={String(field.fieldHorizAlign ?? "СЛЕВА")}
                                                      onChange={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "fieldHorizAlign",
                                                          event.target.value
                                                        )
                                                      }
                                                    >
                                                      {REPORT_TEMPLATE_HORIZONTAL_ALIGN_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                          {option.label}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  ) : (
                                                    renderReportTemplateFieldOverflowText(field.fieldHorizAlign)
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <select
                                                      className="employee-card-field-input employee-card-field-select"
                                                      value={String(field.fieldLink ?? "")}
                                                      onChange={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "fieldLink",
                                                          event.target.value
                                                        )
                                                      }
                                                    >
                                                      <option value="">-</option>
                                                      {reportTemplateLinkFieldOptions.map((linkName) => (
                                                        <option key={linkName} value={linkName}>
                                                          {linkName}
                                                        </option>
                                                      ))}
                                                      {String(field.fieldLink ?? "").trim() &&
                                                        !reportTemplateLinkFieldOptions.includes(
                                                          String(field.fieldLink ?? "").trim()
                                                        ) && (
                                                          <option value={String(field.fieldLink ?? "").trim()}>
                                                            {String(field.fieldLink ?? "").trim()}
                                                          </option>
                                                        )}
                                                    </select>
                                                  ) : (
                                                    renderReportTemplateFieldOverflowText(field.fieldLink)
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <select
                                                      className="employee-card-field-input employee-card-field-select"
                                                      value={field.fieldAutoWidth ? "true" : "false"}
                                                      onChange={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "fieldAutoWidth",
                                                          String(event.target.value) === "true"
                                                        )
                                                      }
                                                    >
                                                      <option value="true">ДА</option>
                                                      <option value="false">НЕТ</option>
                                                    </select>
                                                  ) : field.fieldAutoWidth ? (
                                                    "ДА"
                                                  ) : (
                                                    "НЕТ"
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <input
                                                      type="text"
                                                      className={`employee-card-field-input${
                                                        field.fieldAutoWidth
                                                          ? " report-template-field-width-input-disabled"
                                                          : ""
                                                      }`}
                                                      inputMode="numeric"
                                                      placeholder="напр. 18"
                                                      defaultValue={String(field.filedWidth ?? "")}
                                                      key={`report-template-field-width-${sourceIndex}-${String(
                                                        field.filedWidth ?? ""
                                                      )}-${field.fieldAutoWidth ? "auto" : "manual"}`}
                                                      disabled={Boolean(field.fieldAutoWidth)}
                                                      title={
                                                        field.fieldAutoWidth
                                                          ? "Поле недоступно, пока включена Автоширина = ДА"
                                                          : "Ширина колонки в единицах Excel"
                                                      }
                                                      onBlur={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "filedWidth",
                                                          event.target.value
                                                        )
                                                      }
                                                      onKeyDown={(event) => {
                                                        if (event.key === "Enter") {
                                                          event.preventDefault();
                                                          event.currentTarget.blur();
                                                        }
                                                      }}
                                                    />
                                                  ) : (
                                                    renderReportTemplateFieldOverflowText(field.filedWidth)
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <select
                                                      className="employee-card-field-input employee-card-field-select"
                                                      value={field.fieldAutoTransfer ? "true" : "false"}
                                                      onChange={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "fieldAutoTransfer",
                                                          String(event.target.value) === "true"
                                                        )
                                                      }
                                                    >
                                                      <option value="true">ДА</option>
                                                      <option value="false">НЕТ</option>
                                                    </select>
                                                  ) : field.fieldAutoTransfer ? (
                                                    "ДА"
                                                  ) : (
                                                    "НЕТ"
                                                  )}
                                                </td>
                                                <td>
                                                  {isRowEditable ? (
                                                    <select
                                                      className="employee-card-field-input employee-card-field-select"
                                                      value={field.fieldBoldFont ? "true" : "false"}
                                                      onChange={(event) =>
                                                        handleChangeReportTemplateSettingsFieldRow(
                                                          sourceIndex,
                                                          "fieldBoldFont",
                                                          String(event.target.value) === "true"
                                                        )
                                                      }
                                                    >
                                                      <option value="true">ДА</option>
                                                      <option value="false">НЕТ</option>
                                                    </select>
                                                  ) : field.fieldBoldFont ? (
                                                    "ДА"
                                                  ) : (
                                                    "НЕТ"
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })
                                        ) : (
                                          <tr>
                                            <td colSpan={13}>Поля для настройки отсутствуют</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                  ) : null}
                                </div>
                                </div>
                                    </div>
                                    <div className="report-template-content-pane report-template-content-pane-json">
                                  <div
                                    className={`report-template-json-panel${
                                      isReportTemplateJsonEditMode ? " is-editing" : ""
                                    }`}
                                    style={{
                                      "--json-font-size-px": `${reportTemplateJsonFontSizePx}px`,
                                      "--json-line-height-px": `${reportTemplateJsonLineHeightPx}px`
                                    }}
                                  >
                                    {isReportTemplateJsonEditMode ? (
                                      <div
                                        className="report-template-json-active-line"
                                        style={{
                                          top: `${reportTemplateJsonActiveLineTopPx}px`,
                                          left: `${13 + REPORT_TEMPLATE_JSON_GUTTER_WIDTH_PX + 1}px`
                                        }}
                                        aria-hidden="true"
                                      />
                                    ) : null}
                                    {isReportTemplateJsonEditMode ? (
                                      <div className="report-template-json-gutter" aria-hidden="true">
                                        <pre
                                          className="report-template-json-gutter-content"
                                          style={{
                                            transform: `translateY(-${reportTemplateJsonEditorScrollTop}px)`
                                          }}
                                        >
                                          {reportTemplateJsonLineNumbers}
                                        </pre>
                                      </div>
                                    ) : null}
                                    <textarea
                                      className={`report-template-json-textarea${
                                        isReportTemplateJsonEditMode ? " is-editing" : ""
                                      }`}
                                      ref={reportTemplateJsonTextareaRef}
                                      value={reportTemplateJsonDraft}
                                      onChange={(event) => setReportTemplateJsonDraft(event.target.value)}
                                      onSelect={handleReportTemplateJsonEditorSelect}
                                      onScroll={handleReportTemplateJsonEditorScroll}
                                      readOnly={!isReportTemplateJsonEditMode}
                                    />
                                  </div>
                                    </div>
                                  </div>
                                </div>
                                </>
                              )}
                              {isReportTemplateSettingsLoading && hasReportTemplateContentLoaded ? (
                                <div className="report-template-loading-overlay" aria-hidden="true">
                                  <span className="report-template-loading-overlay-text">
                                    Загрузка настроек шаблона...
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </section>
                        </div>
                      )}
                      {activeReportCardTab === REPORT_CARD_TABS.PREVIEW && (
                        <div className="report-card-tab-content">
                          <section className="employee-card-section report-preview-section">
                            <div className="employee-card-subordination-header report-preview-header">
                              <h3>Просмотр отчета Excel</h3>
                              <div className="report-preview-actions">
                                <ExportToExcelButton
                                  exportFile={requestFullReportTemplateExcel}
                                  disabled={isReportPreviewLoading || !isReportPreviewTabAvailable}
                                  className="panel-action-button"
                                  onError={(error) =>
                                    setReportPreviewError(
                                      error instanceof Error && error.message
                                        ? error.message
                                        : "Ошибка формирования Excel-отчета"
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  className="panel-action-button"
                                  onClick={handleRefreshReportPreview}
                                  disabled={isReportPreviewLoading}
                                >
                                  {isReportPreviewLoading ? "Обновление..." : "Обновить"}
                                </button>
                              </div>
                            </div>
                            <div className="report-preview-stats">
                              <span>
                                Найдено записей: {Number(reportPreviewStats.selectedRows).toLocaleString("ru-RU")}
                              </span>
                              <span>
                                Время выполнения: {reportPreviewStats.executionTime} (
                                {Number(reportPreviewStats.executionMs).toLocaleString("ru-RU")} мс)
                              </span>
                              <span>
                                Запрос: {Number(reportPreviewStats.queryExecutionMs ?? 0).toLocaleString("ru-RU")} мс
                              </span>
                              <span>
                                Заполнение шаблона: {Number(reportPreviewStats.templateFillMs ?? 0).toLocaleString("ru-RU")} мс
                              </span>
                              <span>{reportPreviewPeriodLabel}</span>
                            </div>
                            <div className="report-preview-note report-preview-note-warning">
                              Внимание: в режиме превью отображается не более 50 записей.
                              Выгрузка по кнопке формирует полный Excel.
                            </div>
                            <div className="report-preview-viewer">
                              {isReportPreviewLoading ? (
                                <div className="report-preview-empty-state">Формируется Excel-отчет...</div>
                              ) : reportPreviewError ? (
                                <div className="report-preview-empty-state">{reportPreviewError}</div>
                              ) : reportPreviewSheetRows.length === 0 ? (
                                <div className="report-preview-empty-state">Нет данных для отображения</div>
                              ) : (
                                <table className="report-preview-table">
                                  <tbody>
                                    {reportPreviewSheetRows.map((row, rowIndex) => (
                                      <tr key={`report-preview-row-${rowIndex}`}>
                                        <td className="report-preview-row-number-cell">{rowIndex + 1}</td>
                                        {Array.isArray(row)
                                          ? row.map((cellValue, cellIndex) => (
                                              <td
                                                key={`report-preview-cell-${rowIndex}-${cellIndex}`}
                                                style={
                                                  rowIndex >= Number(reportPreviewSheetMeta.dataRowStartRelative)
                                                    ? {
                                                        textAlign:
                                                          reportPreviewSheetMeta.columnAlignByAbsoluteCol[
                                                            Number(reportPreviewSheetMeta.rangeStartCol) + cellIndex
                                                          ] ?? "left"
                                                      }
                                                    : undefined
                                                }
                                              >
                                                {formatReportSqlResultCellValue(cellValue)}
                                              </td>
                                            ))
                                          : null}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
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
            <section className="print-forms-page">
              <div className="employee-card-tabs">
                <button
                  type="button"
                  className={`employee-card-tab${
                    activePrintFormsTab === PRINT_FORMS_TABS.LIST ? " active" : ""
                  }`}
                  onClick={() => setActivePrintFormsTab(PRINT_FORMS_TABS.LIST)}
                >
                  Список шаблонов
                </button>
                <button
                  type="button"
                  className={`employee-card-tab${
                    activePrintFormsTab === PRINT_FORMS_TABS.CREATE ? " active" : ""
                  }`}
                  onClick={() => setActivePrintFormsTab(PRINT_FORMS_TABS.CREATE)}
                >
                  Создание шаблона
                </button>
              </div>
              {printFormsError && <div className="print-forms-error">{printFormsError}</div>}
              {activePrintFormsTab === PRINT_FORMS_TABS.LIST ? (
                <div className="print-forms-list-wrapper">
                  <div className="main-panel-actions">
                    <button
                      type="button"
                      className="panel-action-button"
                      onClick={() => setPrintFormsRefreshToken((prev) => prev + 1)}
                      disabled={printFormsLoading}
                    >
                      <span aria-hidden="true">↻</span>
                      <span>Обновить</span>
                    </button>
                  </div>
                  <div className="table-wrapper">
                    <table className="employee-grid">
                      <thead>
                        <tr>
                          <th>
                            <div className="column-sort-button">Код</div>
                          </th>
                          <th>
                            <div className="column-sort-button">Название</div>
                          </th>
                          <th>
                            <div className="column-sort-button">Описание</div>
                          </th>
                          <th>
                            <div className="column-sort-button">Обновлен</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {printFormsLoading && (
                          <tr>
                            <td colSpan={4}>Загрузка шаблонов...</td>
                          </tr>
                        )}
                        {!printFormsLoading && printFormsItems.length === 0 && (
                          <tr>
                            <td colSpan={4}>Шаблоны не найдены</td>
                          </tr>
                        )}
                        {!printFormsLoading &&
                          printFormsItems.map((item) => (
                            <tr key={String(item?.id ?? "")}>
                              <td>{String(item?.code ?? "")}</td>
                              <td>{String(item?.name ?? "")}</td>
                              <td>{String(item?.description ?? "")}</td>
                              <td>{String(item?.updatedAt ?? item?.updated_at ?? "")}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="print-forms-create-form">
                  <label className="employee-card-param">
                    <span className="employee-card-field-label">Название</span>
                    <input
                      type="text"
                      className="employee-card-field-input"
                      value={printFormName}
                      onChange={(event) => setPrintFormName(event.target.value)}
                    />
                  </label>
                  <label className="employee-card-param">
                    <span className="employee-card-field-label">Код</span>
                    <input
                      type="text"
                      className="employee-card-field-input"
                      value={printFormCode}
                      onChange={(event) => setPrintFormCode(event.target.value)}
                    />
                  </label>
                  <label className="employee-card-param">
                    <span className="employee-card-field-label">Описание</span>
                    <input
                      type="text"
                      className="employee-card-field-input"
                      value={printFormDescription}
                      onChange={(event) => setPrintFormDescription(event.target.value)}
                    />
                  </label>
                  <label className="employee-card-param">
                    <span className="employee-card-field-label">SQL для данных</span>
                    <textarea
                      className="employee-card-field-input print-forms-textarea"
                      value={printFormDataSql}
                      onChange={(event) => setPrintFormDataSql(event.target.value)}
                    />
                  </label>
                  <label className="employee-card-param">
                    <span className="employee-card-field-label">Field mapping (JSON-массив)</span>
                    <textarea
                      className="employee-card-field-input print-forms-textarea"
                      value={printFormFieldMappingText}
                      onChange={(event) => setPrintFormFieldMappingText(event.target.value)}
                    />
                  </label>
                  <label className="employee-card-param">
                    <span className="employee-card-field-label">Overlay settings (JSON-объект)</span>
                    <textarea
                      className="employee-card-field-input print-forms-textarea"
                      value={printFormOverlaySettingsText}
                      onChange={(event) => setPrintFormOverlaySettingsText(event.target.value)}
                    />
                  </label>
                  <div className="employee-card-param">
                    <span className="employee-card-field-label">PDF шаблон</span>
                    <div className="print-forms-upload-actions">
                      <label className="panel-action-button upload-action-button print-forms-upload-label">
                        <span aria-hidden="true">↑</span>
                        <span>{printFormPdfName ? `Файл: ${printFormPdfName}` : "Загрузить PDF"}</span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handlePrintFormPdfSelect}
                          hidden
                        />
                      </label>
                      <button
                        type="button"
                        className="panel-action-button"
                        onClick={handleRecognizePrintFormTemplate}
                        disabled={isPrintFormRecognizing || !printFormPdfBase64}
                      >
                        <span aria-hidden="true">⧉</span>
                        <span>{isPrintFormRecognizing ? "Распознавание..." : "Распознать {атрибуты}"}</span>
                      </button>
                    </div>
                    {printFormDetectedFields.length > 0 && (
                      <div className="print-forms-detected-fields">
                        <span className="employee-card-field-label">Найдены атрибуты:</span>
                        <div className="print-forms-detected-fields-list">
                          {printFormDetectedFields.map((field) => (
                            <span key={field} className="print-forms-detected-field-item">
                              {`{${field}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="main-panel-actions">
                    <button
                      type="button"
                      className="panel-action-button"
                      onClick={handleCreatePrintFormTemplate}
                      disabled={isPrintFormSaving}
                    >
                      <span aria-hidden="true">+</span>
                      <span>{isPrintFormSaving ? "Сохранение..." : "Создать шаблон"}</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
          {isListPage && (
            <section className="bottom-controls-panel" ref={bottomPanelRef}>
              <div className="grid-controls">
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pager-button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={employeesLoading || displayedCurrentPage <= 1}
                    aria-label="Предыдущая страница"
                    title="Предыдущая страница"
                  >
                    ←
                  </button>
                  {displayedVisiblePaginationItems.map((item, index) =>
                    typeof item === "string" && item.startsWith("ellipsis-") ? (
                      <span key={`ellipsis-${index}`} className="pager-ellipsis" aria-hidden="true">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`pager-button${item === displayedCurrentPage ? " active" : ""}`}
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
                    onClick={() => setCurrentPage((prev) => Math.min(displayedTotalPages, prev + 1))}
                    disabled={employeesLoading || displayedCurrentPage >= displayedTotalPages}
                    aria-label="Следующая страница"
                    title="Следующая страница"
                  >
                    →
                  </button>
                </div>
                <label className="page-jump-control">
                  <span>Перейти на страницу:</span>
                  <input
                    ref={pageJumpInputRef}
                    type="number"
                    min={1}
                    max={displayedTotalPages}
                    defaultValue={displayedCurrentPage}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        goToPage();
                      }
                    }}
                    disabled={employeesLoading}
                  />
                  <button
                    type="button"
                    className="page-jump-button"
                    onClick={goToPage}
                    disabled={employeesLoading}
                  >
                    Перейти
                  </button>
                </label>
                <span className="selected-count-label">Отобрано - {displayedTotalCount} записей</span>
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
        </section>
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
        {pendingOrganizationDelete && (
          <div className="modal-overlay" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-label="Удаление организации">
              <p className="result-message">
                Удалить организацию{pendingOrganizationDelete.name ? ` "${pendingOrganizationDelete.name}"` : ""}?
              </p>
              <div className="confirm-actions">
                <button type="button" className="modal-close-button" onClick={confirmDeleteOrganization}>
                  Да
                </button>
                <button
                  type="button"
                  className="modal-close-button secondary"
                  onClick={closeDeleteOrganizationModal}
                >
                  Нет
                </button>
              </div>
            </div>
          </div>
        )}
        {pendingReportDelete && (
          <div className="modal-overlay" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-label="Удаление отчета">
              <p className="result-message">
                Удалить отчет{pendingReportDelete.name ? ` "${pendingReportDelete.name}"` : ""}?
              </p>
              <p className="result-message">
                Будут удалены связанные записи из report_access_group, report_template_organizations, report_template_recipients и report_templates.
              </p>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="modal-close-button"
                  onClick={confirmDeleteReport}
                  disabled={isReportDeleting}
                >
                  Да
                </button>
                <button
                  type="button"
                  className="modal-close-button secondary"
                  onClick={closeDeleteReportModal}
                  disabled={isReportDeleting}
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
            ref={buttonTooltipElementRef}
            style={{ left: `${buttonTooltip.x}px`, top: `${buttonTooltip.y}px` }}
          >
            {buttonTooltip.text}
          </div>
        )}
        {String(systemErrorToast?.message ?? "").trim() && (
          <div
            className={`relations-error-toast ${
              String(systemErrorToast?.type ?? "").trim() === "success"
                ? "relations-error-toast-success"
                : "relations-error-toast-error"
            }${isSystemErrorToastClosing ? " closing" : ""}`}
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
