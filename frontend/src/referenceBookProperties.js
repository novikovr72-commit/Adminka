/** properties в БД — { fields, linkTables, synonymKeyFields }; tableName / addRecords / editRecords — отдельные колонки. */

export const REFERENCE_BOOK_FIELD_TYPES = [
  { value: "varchar", label: "Строка (varchar)" },
  { value: "numeric", label: "Число (numeric)" },
  { value: "date", label: "Дата (date)" },
  { value: "datetime", label: "Дата/время (datetime)" },
  { value: "boolean", label: "Булево (boolean)" }
];

export const REFERENCE_BOOK_FIELD_SHOW_LINK_OPTIONS = [
  { value: "Нет", label: "Нет" },
  { value: "Справочник", label: "Справочник" },
  { value: "Карточка", label: "Карточка" }
];

export const REFERENCE_BOOK_FIELD_CART_TYPE_OPTIONS = [
  { value: "Организация", label: "Организация" },
  { value: "Сотрудник", label: "Сотрудник" }
];

const FIELD_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
/** Как synonymKeyField на бэкенде (IDENTIFIER). */
const SYNONYM_KEY_FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
/** Согласовано с ReferenceBookPropertiesValidator.TABLE_NAME */
const TABLE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

export function sanitizeTableNameInput(raw) {
  return String(raw ?? "").replace(/[^a-zA-Z0-9_.]/g, "");
}

/** Суффикс URL: схема_таблица (нижний регистр), согласовано с ReferenceBookService.deriveReferenceUrlFromTableName */
export function referenceUrlSuffixFromTableName(raw) {
  const tableName = String(raw ?? "").trim();
  if (!tableName) {
    return "";
  }
  let schema;
  let table;
  if (!tableName.includes(".")) {
    schema = "public";
    table = tableName;
  } else {
    const i = tableName.lastIndexOf(".");
    schema = tableName.slice(0, i).trim();
    table = tableName.slice(i + 1).trim();
  }
  if (!schema || !table) {
    return "";
  }
  return `${schema.toLowerCase()}_${table.toLowerCase()}`;
}

/** Ввод имени поля (латиница, цифры, _) — как в UI fieldName. */
export function sanitizeFieldNameInput(raw) {
  return String(raw ?? "").replace(/[^a-zA-Z0-9_]/g, "");
}

function newFieldClientKey() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `fk-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createEmptySynonymKeyFieldRow() {
  return { synonymKeyField: "" };
}

export function createEmptyLinkTableRow() {
  return { linkTableName: "" };
}

/** Строка столбца в правиле (имя столбца БД справочника). */
export function createEmptyReferenceBookRuleFieldRow() {
  return { tableName: "" };
}

/** Новое правило связки полей: по умолчанию два пустых столбца (минимум 2 по схеме API). */
export function createEmptyReferenceBookRuleRow() {
  return {
    ruleClientKey: newFieldClientKey(),
    rule: "presence",
    fields: [createEmptyReferenceBookRuleFieldRow(), createEmptyReferenceBookRuleFieldRow()]
  };
}

/** Нормализация массива rules из API в черновик карточки. */
export function normalizeRulesFromApi(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((r) => ({
    ruleClientKey: newFieldClientKey(),
    rule: String(r?.rule ?? "presence").trim().toLowerCase() === "uniqueness" ? "uniqueness" : "presence",
    fields: Array.isArray(r?.fields)
      ? r.fields.map((f) => ({
          tableName: String(f?.tableName ?? f?.table_name ?? "").trim()
        }))
      : []
  }));
}

/** Тело для API: только rule и fields[].tableName; пустые tableName отбрасываются. */
export function buildReferenceBookRulesPayload(draft) {
  const rules = Array.isArray(draft?.rules) ? draft.rules : [];
  return rules.map((r) => ({
    rule: r?.rule === "uniqueness" ? "uniqueness" : "presence",
    fields: (Array.isArray(r?.fields) ? r.fields : [])
      .map((f) => ({ tableName: String(f?.tableName ?? "").trim() }))
      .filter((f) => f.tableName)
  }));
}

/** Клиентская проверка перед сохранением (согласована с ReferenceBookRulesValidator). */
export function validateReferenceBookRulesDraftClient(draft) {
  const rules = Array.isArray(draft?.rules) ? draft.rules : [];
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const names = (Array.isArray(r?.fields) ? r.fields : [])
      .map((f) => String(f?.tableName ?? "").trim())
      .filter(Boolean);
    if (names.length < 2) {
      return `Правило ${i + 1}: укажите не менее двух разных столбцов`;
    }
    const seen = new Set();
    for (const n of names) {
      if (n.toLowerCase() === "id") {
        return `Правило ${i + 1}: столбец id в правилах не указывается`;
      }
      const low = n.toLowerCase();
      if (seen.has(low)) {
        return `Правило ${i + 1}: столбец «${n}» указан дважды`;
      }
      seen.add(low);
    }
  }
  return null;
}

/** Черновик для создания записи в reference_books до первого сохранения. */
export function createEmptyReferenceBookDraft() {
  return {
    code: "",
    name: "",
    procedureCode: "",
    referenceUrl: "",
    tableName: "",
    addRecords: true,
    editRecords: true,
    fields: [],
    linkTables: [],
    synonymKeyFields: [],
    rules: []
  };
}

export function createEmptyReferenceBookField() {
  return {
    fieldClientKey: newFieldClientKey(),
    fieldName: "",
    fieldCaption: "",
    fieldType: "varchar",
    fieldRequired: false,
    fieldDefaultValueString: "",
    fieldDefaultValueNumeric: "",
    fieldDefaultValueBoolean: false,
    fieldShow: true,
    fieldEdit: true,
    uniqueValue: false,
    fieldValues: [],
    fieldLinkTable: "",
    fieldLinkField: "",
    fieldShowLink: "Нет",
    fieldCartType: "",
    fieldLinkShowFields: [{ fieldLinkShowField: "", orderPos: 1 }],
    fieldLinkShowLists: [{ fieldLinkShowList: "", orderPos: 1 }],
    fieldLinkListType: "full",
    fieldLinkShowTooltips: [{ fieldLinkShowTooltip: "", orderPos: 1 }],
    fieldLinkFiltr: ""
  };
}

/** Тип выпадающего списка связи: full — полный (до 100 + фильтр доступности); match — только по совпадению с текстом. */
export function normalizeFieldLinkListTypeFromApi(ob) {
  if (ob == null || typeof ob !== "object") {
    return "full";
  }
  const raw = String(ob.fieldLinkListType ?? ob.field_link_list_type ?? "full")
    .trim()
    .toLowerCase();
  if (raw === "match" || raw === "совпадение") {
    return "match";
  }
  return "full";
}

/** Порядок по orderPos; legacy fieldLinkShowField → один элемент. */
export function normalizeFieldLinkShowFieldsFromApi(ob) {
  const raw = ob.fieldLinkShowFields;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((r, i) => ({
        fieldLinkShowField: String(r.fieldLinkShowField ?? "").trim(),
        orderPos: Number(r.orderPos) > 0 ? Math.floor(Number(r.orderPos)) : i + 1
      }))
      .sort((a, b) => a.orderPos - b.orderPos);
  }
  const legacy = String(ob.fieldLinkShowField ?? "").trim();
  if (legacy) {
    return [{ fieldLinkShowField: legacy, orderPos: 1 }];
  }
  return [];
}

export function normalizeFieldLinkShowTooltipsFromApi(ob) {
  const raw = ob.fieldLinkShowTooltips;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((r, i) => ({
        fieldLinkShowTooltip: String(r.fieldLinkShowTooltip ?? "").trim(),
        orderPos: Number(r.orderPos) > 0 ? Math.floor(Number(r.orderPos)) : i + 1
      }))
      .sort((a, b) => a.orderPos - b.orderPos);
  }
  return [];
}

export function normalizeFieldLinkShowListsFromApi(ob) {
  const raw = ob.fieldLinkShowLists;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((r, i) => ({
        fieldLinkShowList: String(r.fieldLinkShowList ?? "").trim(),
        orderPos: Number(r.orderPos) > 0 ? Math.floor(Number(r.orderPos)) : i + 1
      }))
      .sort((a, b) => a.orderPos - b.orderPos);
  }
  return [];
}

export function createEmptyFieldLinkShowRow(orderPos) {
  return { fieldLinkShowField: "", orderPos };
}

export function createEmptyFieldLinkTooltipRow(orderPos) {
  return { fieldLinkShowTooltip: "", orderPos };
}

export function createEmptyFieldLinkListRow(orderPos) {
  return { fieldLinkShowList: "", orderPos };
}

/** Значение по умолчанию для гиперссылки — «Нет». */
export function normalizeFieldShowLinkValue(raw) {
  const v = String(raw ?? "").trim();
  if (v === "Справочник" || v === "Карточка") {
    return v;
  }
  return "Нет";
}

/** При гиперссылке «Карточка» тип карточки обязателен; по умолчанию — «Организация». */
export function normalizeFieldCartTypeValue(cartRaw, showLinkRaw) {
  if (normalizeFieldShowLinkValue(showLinkRaw) !== "Карточка") {
    return "";
  }
  const c = String(cartRaw ?? "").trim();
  if (c === "Сотрудник") {
    return "Сотрудник";
  }
  return "Организация";
}

function normalizeFieldFromApi(raw) {
  const ob = raw && typeof raw === "object" ? raw : {};
  const fieldTypeRaw = String(ob.fieldType ?? ob.fieldTYpe ?? "varchar")
    .trim()
    .toLowerCase();
  const allowed = REFERENCE_BOOK_FIELD_TYPES.some((t) => t.value === fieldTypeRaw);
  const fieldType = allowed ? fieldTypeRaw : "varchar";
  const fieldValuesRaw = Array.isArray(ob.fieldValues) ? ob.fieldValues : [];
  const fieldValues = fieldValuesRaw.map((row) => {
    const fieldValueString = String(row?.fieldValueString ?? "").trim();
    const showRaw = String(row?.fieldValueShow ?? "").trim();
    return {
      fieldValueString,
      fieldValueShow: showRaw || fieldValueString
    };
  });
  const orderNum = Number(ob.orderNumber);
  const showLink = normalizeFieldShowLinkValue(ob.fieldShowLink);
  const fieldCartType = normalizeFieldCartTypeValue(ob.fieldCartType, showLink);
  return {
    fieldClientKey: String(ob.fieldClientKey ?? "").trim() || newFieldClientKey(),
    fieldName: String(ob.fieldName ?? "").trim(),
    fieldCaption: String(ob.fieldCaption ?? "").trim(),
    fieldType,
    fieldRequired: Boolean(ob.fieldRequired),
    fieldDefaultValueString:
      ob.fieldDefaultValueString != null ? String(ob.fieldDefaultValueString) : "",
    fieldDefaultValueNumeric:
      ob.fieldDefaultValueNumeric != null && ob.fieldDefaultValueNumeric !== ""
        ? String(ob.fieldDefaultValueNumeric)
        : "",
    fieldDefaultValueBoolean: Boolean(ob.fieldDefaultValueBoolean),
    fieldShow: ob.fieldShow !== false,
    fieldEdit: ob.fieldEdit !== false,
    uniqueValue: Boolean(ob.uniqueValue),
    orderNumber: Number.isFinite(orderNum) && orderNum > 0 ? Math.floor(orderNum) : 0,
    fieldShowLink: showLink,
    fieldCartType,
    fieldValues,
    fieldLinkTable: String(ob.fieldLinkTable ?? "").trim(),
    fieldLinkField: String(ob.fieldLinkField ?? "").trim(),
    fieldLinkShowFields: (() => {
      const s = normalizeFieldLinkShowFieldsFromApi(ob);
      return s.length > 0 ? s : [{ fieldLinkShowField: "", orderPos: 1 }];
    })(),
    fieldLinkShowLists: (() => {
      const l = normalizeFieldLinkShowListsFromApi(ob);
      return l.length > 0 ? l : [{ fieldLinkShowList: "", orderPos: 1 }];
    })(),
    fieldLinkShowTooltips: (() => {
      const t = normalizeFieldLinkShowTooltipsFromApi(ob);
      return t.length > 0 ? t : [{ fieldLinkShowTooltip: "", orderPos: 1 }];
    })(),
    fieldLinkFiltr: String(ob.fieldLinkFiltr ?? ob.field_link_filtr ?? "").trim(),
    /* иначе после merge из API поле теряется и normalizeFieldLinkListTypeFromApi(f) всегда даёт full */
    fieldLinkListType: normalizeFieldLinkListTypeFromApi(ob)
  };
}

function normalizeLinkTableFromApi(raw) {
  return { linkTableName: String(raw?.linkTableName ?? "").trim() };
}

function normalizeSynonymKeyFieldFromApi(raw) {
  return { synonymKeyField: String(raw?.synonymKeyField ?? "").trim() };
}

/** Поля UI + связанные таблицы + синонимы из JSON колонки. */
export function normalizeReferenceBookPropertiesFromApi(raw) {
  const ob = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const fields = Array.isArray(ob.fields) ? ob.fields.map(normalizeFieldFromApi) : [];
  const linkTables = Array.isArray(ob.linkTables)
    ? ob.linkTables.map(normalizeLinkTableFromApi)
    : [];
  const synonymKeyFields = Array.isArray(ob.synonymKeyFields)
    ? ob.synonymKeyFields.map(normalizeSynonymKeyFieldFromApi)
    : [];
  return { fields, linkTables, synonymKeyFields };
}

function sortFieldsByOrderNumber(fieldRows) {
  return [...fieldRows].sort((a, b) => {
    const ao = Number(a.orderNumber) || 999999;
    const bo = Number(b.orderNumber) || 999999;
    return ao - bo;
  });
}

export function buildReferenceBookDraftFromItem(item) {
  const props = normalizeReferenceBookPropertiesFromApi(item?.properties);
  const fields = sortFieldsByOrderNumber(
    (props.fields || []).map((f) => ({
      ...createEmptyReferenceBookField(),
      ...f,
      fieldShowLink: normalizeFieldShowLinkValue(f.fieldShowLink),
      fieldCartType: normalizeFieldCartTypeValue(f.fieldCartType, f.fieldShowLink),
      fieldLinkListType: normalizeFieldLinkListTypeFromApi(f),
      fieldValues: Array.isArray(f.fieldValues) ? f.fieldValues : []
    }))
  );
  const linkTables = (props.linkTables || []).map((row) => ({
    linkTableName: String(row?.linkTableName ?? "").trim()
  }));
  const synonymKeyFields = (props.synonymKeyFields || []).map((row) => ({
    synonymKeyField: String(row?.synonymKeyField ?? "").trim()
  }));
  const tableName = String(
    item?.tableName ?? item?.table_name ?? ""
  ).trim();
  const derivedSuffix = referenceUrlSuffixFromTableName(tableName);
  const addRecords =
    item?.addRecords !== undefined && item?.addRecords !== null
      ? Boolean(item.addRecords)
      : item?.add_records !== undefined && item?.add_records !== null
        ? Boolean(item.add_records)
        : true;
  const editRecords =
    item?.editRecords !== undefined && item?.editRecords !== null
      ? Boolean(item.editRecords)
      : item?.edit_records !== undefined && item?.edit_records !== null
        ? Boolean(item.edit_records)
        : true;
  return {
    code: String(item?.code ?? "").trim(),
    name: String(item?.name ?? "").trim(),
    procedureCode: String(item?.procedureCode ?? "").trim(),
    referenceUrl: derivedSuffix || String(item?.referenceUrl ?? "").trim(),
    tableName,
    addRecords,
    editRecords,
    fields,
    linkTables,
    synonymKeyFields,
    rules: normalizeRulesFromApi(item?.rules)
  };
}

/** Подмешивает только fields из загруженного JSON properties. */
export function mergeReferenceBookPropertiesIntoDraft(draft, propertiesRaw) {
  if (!draft || typeof draft !== "object") {
    return draft;
  }
  const props = normalizeReferenceBookPropertiesFromApi(propertiesRaw);
  const fields = sortFieldsByOrderNumber(
    (props.fields || []).map((f) => ({
      ...createEmptyReferenceBookField(),
      ...f,
      fieldShowLink: normalizeFieldShowLinkValue(f.fieldShowLink),
      fieldCartType: normalizeFieldCartTypeValue(f.fieldCartType, f.fieldShowLink),
      fieldLinkListType: normalizeFieldLinkListTypeFromApi(f),
      fieldValues: Array.isArray(f.fieldValues) ? f.fieldValues : []
    }))
  );
  const linkTables = (props.linkTables || []).map((row) => ({
    linkTableName: String(row?.linkTableName ?? "").trim()
  }));
  const synonymKeyFields = (props.synonymKeyFields || []).map((row) => ({
    synonymKeyField: String(row?.synonymKeyField ?? "").trim()
  }));
  return {
    ...draft,
    fields,
    linkTables,
    synonymKeyFields
  };
}

/** Непустой fieldValues[] (varchar) и связь взаимоисключающие — для UI и payload. */
export function fieldHasFieldValuesBlockingLink(f) {
  const ft = String(f?.fieldType ?? "varchar").trim().toLowerCase();
  if (ft !== "varchar") {
    return false;
  }
  const fv = Array.isArray(f?.fieldValues) ? f.fieldValues : [];
  return fv.length > 0;
}

export const REFERENCE_BOOK_LINK_BLOCKED_BY_FIELD_VALUES_HINT =
  "Сначала удалите все строки в колонках «Значение»";

function buildFieldLinkArraysForPayload(f) {
  if (fieldHasFieldValuesBlockingLink(f)) {
    return {
      fieldLinkShowFields: [],
      fieldLinkShowLists: [],
      fieldLinkShowTooltips: [],
      fieldLinkFiltr: "",
      fieldLinkListType: "full"
    };
  }
  const lt = String(f.fieldLinkTable ?? "").trim();
  const lf = String(f.fieldLinkField ?? "").trim();
  if (!lt || !lf) {
    return {
      fieldLinkShowFields: [],
      fieldLinkShowLists: [],
      fieldLinkShowTooltips: [],
      fieldLinkFiltr: "",
      fieldLinkListType: "full"
    };
  }
  const rawShow = Array.isArray(f.fieldLinkShowFields) ? f.fieldLinkShowFields : [];
  const rawList = Array.isArray(f.fieldLinkShowLists) ? f.fieldLinkShowLists : [];
  const rawTip = Array.isArray(f.fieldLinkShowTooltips) ? f.fieldLinkShowTooltips : [];
  const showRows = [];
  for (let i = 0; i < rawShow.length; i += 1) {
    const name = String(rawShow[i]?.fieldLinkShowField ?? "").trim();
    if (name) {
      showRows.push({ fieldLinkShowField: name, orderPos: showRows.length + 1 });
    }
  }
  const listRows = [];
  for (let i = 0; i < rawList.length; i += 1) {
    const name = String(rawList[i]?.fieldLinkShowList ?? "").trim();
    if (name) {
      listRows.push({ fieldLinkShowList: name, orderPos: listRows.length + 1 });
    }
  }
  const tipRows = [];
  for (let i = 0; i < rawTip.length; i += 1) {
    const name = String(rawTip[i]?.fieldLinkShowTooltip ?? "").trim();
    if (name) {
      tipRows.push({ fieldLinkShowTooltip: name, orderPos: tipRows.length + 1 });
    }
  }
  return {
    fieldLinkShowFields: showRows,
    fieldLinkShowLists: listRows,
    fieldLinkShowTooltips: tipRows,
    fieldLinkFiltr: String(f.fieldLinkFiltr ?? "").trim(),
    fieldLinkListType: normalizeFieldLinkListTypeFromApi(f)
  };
}

/** Тело для PATCH .../properties — только описание полей. */
export function buildReferenceBookPropertiesPayload(draft) {
  const fields = (Array.isArray(draft.fields) ? draft.fields : []).map((f, index) => {
    const fieldType = String(f.fieldType ?? "varchar").trim().toLowerCase();
    const blockLink = fieldHasFieldValuesBlockingLink(f);
    let fieldShowLink = normalizeFieldShowLinkValue(f.fieldShowLink);
    let fieldCartType = normalizeFieldCartTypeValue(f.fieldCartType, fieldShowLink);
    if (blockLink) {
      fieldShowLink = "Нет";
      fieldCartType = "";
    }
    const base = {
      fieldName: String(f.fieldName ?? "").trim(),
      fieldCaption: String(f.fieldCaption ?? "").trim(),
      fieldType,
      fieldRequired: Boolean(f.fieldRequired),
      fieldShow: f.fieldShow !== false,
      fieldEdit: f.fieldEdit !== false,
      uniqueValue: Boolean(f.uniqueValue),
      fieldShowLink,
      fieldCartType,
      orderNumber: index + 1,
      fieldValues:
        fieldType === "varchar"
          ? (Array.isArray(f.fieldValues) ? f.fieldValues : []).map((row) => {
              const fieldValueString = String(row?.fieldValueString ?? "").trim();
              const showRaw = String(row?.fieldValueShow ?? "").trim();
              return {
                fieldValueString,
                fieldValueShow: showRaw || fieldValueString
              };
            })
          : [],
      fieldLinkTable: blockLink ? "" : String(f.fieldLinkTable ?? "").trim(),
      fieldLinkField: blockLink ? "" : String(f.fieldLinkField ?? "").trim(),
      ...buildFieldLinkArraysForPayload(f),
      /* Явно с конца: чтобы значение из черновика не терялось при сериализации/слиянии */
      fieldLinkListType: normalizeFieldLinkListTypeFromApi(f)
    };
    if (fieldType === "varchar") {
      return {
        ...base,
        fieldDefaultValueString: String(f.fieldDefaultValueString ?? "").trim(),
        fieldDefaultValueNumeric: null,
        fieldDefaultValueBoolean: null
      };
    }
    if (fieldType === "numeric") {
      const numRaw = String(f.fieldDefaultValueNumeric ?? "").trim();
      return {
        ...base,
        fieldDefaultValueString: null,
        fieldDefaultValueNumeric: numRaw === "" ? null : Number(numRaw),
        fieldDefaultValueBoolean: null
      };
    }
    if (fieldType === "boolean") {
      return {
        ...base,
        fieldDefaultValueString: null,
        fieldDefaultValueNumeric: null,
        fieldDefaultValueBoolean: Boolean(f.fieldDefaultValueBoolean)
      };
    }
    return {
      ...base,
      fieldDefaultValueString: null,
      fieldDefaultValueNumeric: null,
      fieldDefaultValueBoolean: null
    };
  });
  const linkTables = (Array.isArray(draft.linkTables) ? draft.linkTables : [])
    .map((row) => ({
      linkTableName: String(row?.linkTableName ?? "").trim()
    }))
    .filter((row) => row.linkTableName !== "");

  const synonymKeyFields = (Array.isArray(draft.synonymKeyFields) ? draft.synonymKeyFields : [])
    .map((row) => ({
      synonymKeyField: String(row?.synonymKeyField ?? "").trim()
    }))
    .filter((row) => row.synonymKeyField !== "");

  return { fields, linkTables, synonymKeyFields };
}

export function validateReferenceBookMainDraftClient(draft) {
  if (!String(draft.code ?? "").trim()) {
    return "Укажите код справочника";
  }
  if (!String(draft.name ?? "").trim()) {
    return "Укажите наименование справочника";
  }
  const tableName = String(draft.tableName ?? "").trim();
  if (!tableName) {
    return "Укажите имя таблицы справочника (tableName)";
  }
  if (!TABLE_NAME_RE.test(tableName)) {
    return "Имя таблицы (tableName): допустимы латинские буквы, цифры, _ и точка (например schema.table)";
  }
  return null;
}

export function validateReferenceBookFieldsDraftClient(draft) {
  const fields = Array.isArray(draft.fields) ? draft.fields : [];
  for (let i = 0; i < fields.length; i += 1) {
    const f = fields[i];
    const prefix = `Поле ${i + 1}: `;
    const fn = String(f.fieldName ?? "").trim();
    if (!fn) {
      return `${prefix}укажите наименование поля (латиница)`;
    }
    if (!FIELD_NAME_RE.test(fn)) {
      return `${prefix}наименование поля: только латинские буквы, цифры и _`;
    }
    if (!String(f.fieldCaption ?? "").trim()) {
      return `${prefix}укажите заголовок поля`;
    }
    const ft = String(f.fieldType ?? "").trim().toLowerCase();
    if (!REFERENCE_BOOK_FIELD_TYPES.some((t) => t.value === ft)) {
      return `${prefix}выберите тип поля`;
    }
  }

  const linkTables = Array.isArray(draft.linkTables) ? draft.linkTables : [];
  const linkSeen = new Set();
  for (let i = 0; i < linkTables.length; i += 1) {
    const name = String(linkTables[i]?.linkTableName ?? "").trim();
    if (!name) {
      return `Связанные таблицы: строка ${i + 1} — укажите имя таблицы`;
    }
    if (!TABLE_NAME_RE.test(name)) {
      return `Связанные таблицы: строка ${i + 1} — недопустимое имя (схема.имя или имя)`;
    }
    const k = name.toLowerCase();
    if (linkSeen.has(k)) {
      return "Связанные таблицы: дублируется имя таблицы";
    }
    linkSeen.add(k);
  }

  const synonyms = Array.isArray(draft.synonymKeyFields) ? draft.synonymKeyFields : [];
  const synSeen = new Set();
  for (let i = 0; i < synonyms.length; i += 1) {
    const s = String(synonyms[i]?.synonymKeyField ?? "").trim();
    if (!s) {
      return `Синонимы ключевого поля: строка ${i + 1} — укажите значение`;
    }
    if (!SYNONYM_KEY_FIELD_RE.test(s)) {
      return `Синонимы ключевого поля: строка ${i + 1} — только латиница, цифры и _`;
    }
    const k = s.toLowerCase();
    if (synSeen.has(k)) {
      return "Синонимы ключевого поля: дублируется значение";
    }
    synSeen.add(k);
  }

  return null;
}

/** Полная клиентская проверка (основные параметры + поля). */
export function validateReferenceBookDraftClient(draft) {
  const mainErr = validateReferenceBookMainDraftClient(draft);
  if (mainErr) {
    return mainErr;
  }
  return validateReferenceBookFieldsDraftClient(draft);
}
