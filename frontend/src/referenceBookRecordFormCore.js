import { normalizeFieldLinkShowFieldsFromApi, normalizeFieldLinkShowListsFromApi } from "./referenceBookProperties";

export function columnFieldKey(col) {
  return String(col?.fieldName ?? col?.field_name ?? "").trim();
}

export function columnCaption(col) {
  return String(col?.fieldCaption ?? col?.field_caption ?? col?.fieldName ?? col?.field_name ?? "").trim();
}

/** Первичный ключ строки для PATCH (id / Id / любой регистр). */
export function resolveReferenceBookRecordRowId(row) {
  if (row == null || typeof row !== "object") {
    return null;
  }
  if (row.id != null && String(row.id).trim() !== "") {
    return row.id;
  }
  if (row.Id != null && String(row.Id).trim() !== "") {
    return row.Id;
  }
  const idKey = Object.keys(row).find((k) => String(k).toLowerCase() === "id");
  if (idKey != null && row[idKey] != null && String(row[idKey]).trim() !== "") {
    return row[idKey];
  }
  return null;
}

export function hasFieldLinkMeta(col) {
  const lt = String(col?.fieldLinkTable ?? col?.field_link_table ?? "").trim();
  const lf = String(col?.fieldLinkField ?? col?.field_link_field ?? "").trim();
  if (!lt || !lf) {
    return false;
  }
  const show = normalizeFieldLinkShowFieldsFromApi(col);
  const lists = normalizeFieldLinkShowListsFromApi(col).filter((r) => String(r?.fieldLinkShowList ?? "").trim());
  return show.length > 0 || lists.length > 0;
}

const LINK_RAW_SUFFIX = "__linkRaw";

/**
 * Сырое значение поля связи (UUID/id), см. applyFieldLinkDisplayValues на бэкенде: в ячейке подпись, в `fieldName__linkRaw` — ключ.
 */
export function readReferenceBookRowLinkRaw(row, fieldKey) {
  if (row == null || fieldKey == null) {
    return undefined;
  }
  const fk = String(fieldKey).trim();
  if (!fk) {
    return undefined;
  }
  const tryKeys = [fk + LINK_RAW_SUFFIX];
  if (fk.includes("_")) {
    const camel = fk.replace(/_([a-z0-9])/gi, (_, ch) => ch.toUpperCase());
    if (camel !== fk) {
      tryKeys.push(camel + LINK_RAW_SUFFIX);
    }
  }
  for (const key of tryKeys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const v = row[key];
      if (v != null && String(v).trim() !== "") {
        return v;
      }
    }
  }
  for (const key of Object.keys(row)) {
    if (!key.endsWith(LINK_RAW_SUFFIX)) {
      continue;
    }
    const base = key.slice(0, -LINK_RAW_SUFFIX.length);
    if (base === fk || base.toLowerCase() === fk.toLowerCase()) {
      const v = row[key];
      if (v != null && String(v).trim() !== "") {
        return v;
      }
    }
  }
  return undefined;
}

export function buildInitialFormState(fields) {
  const out = {};
  for (const col of fields) {
    const k = columnFieldKey(col);
    if (!k) {
      continue;
    }
    const ft = String(col.fieldType ?? "varchar").toLowerCase();
    if (ft === "boolean") {
      out[k] = col.fieldDefaultValueBoolean === true;
    } else if (ft === "numeric") {
      /* Не подставляем fieldDefaultValueNumeric — при вставке бэкенд раньше дублировал тот же default и ломал UNIQUE (code). */
      out[k] = "";
    } else {
      out[k] = String(col.fieldDefaultValueString ?? "").trim();
    }
  }
  return out;
}

/** Значения из строки грида для режима редактирования */
export function buildFormStateFromRow(row, fields) {
  const out = {};
  if (row == null || typeof row !== "object") {
    return buildInitialFormState(fields);
  }
  for (const col of fields) {
    const k = columnFieldKey(col);
    if (!k) {
      continue;
    }
    let raw = row[k];
    if (hasFieldLinkMeta(col)) {
      const linkRaw = readReferenceBookRowLinkRaw(row, k);
      if (linkRaw !== undefined && linkRaw !== null) {
        raw = linkRaw;
      }
    }
    const ft = String(col.fieldType ?? "varchar").toLowerCase();
    if (ft === "boolean") {
      out[k] = raw === true || raw === "t" || String(raw ?? "").toLowerCase() === "true" || raw === 1;
    } else if (ft === "numeric") {
      out[k] = raw != null && raw !== "" ? String(raw) : "";
    } else if (ft === "date") {
      out[k] = raw ? String(raw).slice(0, 10) : "";
    } else if (ft === "datetime") {
      const s = raw != null ? String(raw) : "";
      out[k] = s.length >= 16 ? s.slice(0, 16) : s;
    } else {
      out[k] = raw != null && raw !== undefined ? String(raw) : "";
    }
  }
  return out;
}

/** Сравнение значений поля формы (для отслеживания смены полей, влияющих на fieldLinkFiltr). */
export function formFieldValuesEqual(col, a, b) {
  const ft = String(col?.fieldType ?? "varchar").toLowerCase();
  if (ft === "boolean") {
    return Boolean(a) === Boolean(b);
  }
  if (ft === "numeric") {
    const na = a === "" || a === null || a === undefined ? null : Number(String(a).replace(",", "."));
    const nb = b === "" || b === null || b === undefined ? null : Number(String(b).replace(",", "."));
    if (na === null && nb === null) {
      return true;
    }
    if (na === null || nb === null) {
      return false;
    }
    return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
  }
  return String(a ?? "") === String(b ?? "");
}

/** Имена полей справочника из плейсхолдеров [field_name] в Условии доступности. */
export function parseFieldLinkFiltrReferencedFieldNames(filtr) {
  if (filtr == null || typeof filtr !== "string") {
    return [];
  }
  const re = /\[([a-zA-Z_][a-zA-Z0-9_]*)\]/g;
  const out = [];
  let m;
  while ((m = re.exec(filtr)) !== null) {
    out.push(m[1]);
  }
  return out;
}

export function serializeForApi(col, raw) {
  const ft = String(col.fieldType ?? "varchar").toLowerCase();
  if (ft === "boolean") {
    return Boolean(raw);
  }
  if (ft === "numeric") {
    if (raw === "" || raw === null || raw === undefined) {
      return null;
    }
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (raw === "" || raw === null || raw === undefined) {
    return null;
  }
  return raw;
}

/** Значения полей формы для подстановки в fieldLinkFiltr ([имя_поля]) на бэкенде. */
export function buildReferenceRowValuesForLink(form, fields) {
  const out = {};
  if (form == null || typeof form !== "object" || !Array.isArray(fields)) {
    return out;
  }
  for (const col of fields) {
    const k = columnFieldKey(col);
    if (!k) {
      continue;
    }
    out[k] = serializeForApi(col, form[k]);
  }
  return out;
}
