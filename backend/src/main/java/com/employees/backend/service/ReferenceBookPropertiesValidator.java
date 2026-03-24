package com.employees.backend.service;

import com.employees.backend.repository.ReferenceBookRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Проверка структуры properties и соответствия таблицам/полям в БД (public schema).
 */
@Service
public class ReferenceBookPropertiesValidator {

    private static final Pattern IDENTIFIER = Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_]*$");
    /** Имя таблицы: сегменты identifier, разделённые точкой (например schema.table). */
    private static final Pattern TABLE_NAME = Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*$");
    private static final Pattern FIELD_NAME_LATIN = Pattern.compile("^[a-zA-Z][a-zA-Z0-9_]*$");
    private static final Set<String> FIELD_TYPES = Set.of("varchar", "numeric", "date", "datetime", "boolean");
    private static final Set<String> FIELD_SHOW_LINK = Set.of("Нет", "Справочник", "Карточка");
    private static final Set<String> FIELD_CART_TYPE = Set.of("Организация", "Сотрудник");

    private final ReferenceBookRepository referenceBookRepository;

    public ReferenceBookPropertiesValidator(ReferenceBookRepository referenceBookRepository) {
        this.referenceBookRepository = referenceBookRepository;
    }

    /**
     * Проверка имени целевой таблицы (колонка table_name).
     */
    public void validateMainTableBinding(String tableName) {
        if (tableName == null || tableName.isBlank()) {
            throw new IllegalArgumentException("Имя таблицы справочника (tableName) обязательно");
        }
        String tn = tableName.trim();
        if (!TABLE_NAME.matcher(tn).matches()) {
            throw new IllegalArgumentException(
                    "tableName: допустимы только латинские буквы, цифры, _ и точка (сегменты вида имя или схема.имя)");
        }
        if (!referenceBookRepository.existsTableInPublicSchema(tn)) {
            throw new IllegalArgumentException("Таблица \"" + tn + "\" не найдена в схеме public");
        }
    }

    /**
     * Только поля UI в JSON: {@code { "fields": [...] }}; tableName берётся из колонки БД.
     *
     * @return нормализованный объект для записи в {@code properties}
     */
    public Map<String, Object> validatePropertiesOnly(Map<String, Object> raw, String tableName) {
        validateMainTableBinding(tableName);
        if (raw == null) {
            raw = new LinkedHashMap<>();
        }
        Object fieldsRaw = raw.get("fields");
        if (!(fieldsRaw instanceof List<?> fieldsList)) {
            throw new IllegalArgumentException("properties.fields должен быть массивом");
        }
        List<Map<String, Object>> normalizedFields = new ArrayList<>();
        Set<String> seenFieldNames = new HashSet<>();
        int index = 0;
        for (Object item : fieldsList) {
            if (!(item instanceof Map<?, ?> fieldMap)) {
                throw new IllegalArgumentException("properties.fields[" + index + "]: ожидается объект");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> field = new LinkedHashMap<>((Map<String, Object>) fieldMap);
            String fnPreview = readString(field, "fieldName", false);
            if (fnPreview != null && !fnPreview.isBlank()) {
                String key = fnPreview.toLowerCase(Locale.ROOT);
                if (seenFieldNames.contains(key)) {
                    throw new IllegalArgumentException("Дублируется наименование поля: " + fnPreview);
                }
                seenFieldNames.add(key);
            }
            normalizedFields.add(normalizeField(field, tableName, index));
            index += 1;
        }
        List<Map<String, Object>> normalizedLinkTables = normalizeLinkTables(raw.get("linkTables"));
        List<Map<String, Object>> normalizedSynonyms = normalizeSynonymKeyFields(raw.get("synonymKeyFields"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("fields", normalizedFields);
        out.put("linkTables", normalizedLinkTables);
        out.put("synonymKeyFields", normalizedSynonyms);
        return out;
    }

    private List<Map<String, Object>> normalizeLinkTables(Object linkRaw) {
        if (linkRaw == null) {
            return List.of();
        }
        if (!(linkRaw instanceof List<?> list)) {
            throw new IllegalArgumentException("properties.linkTables должен быть массивом");
        }
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int index = 0;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> fieldMap)) {
                throw new IllegalArgumentException("properties.linkTables[" + index + "]: ожидается объект");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> m = new LinkedHashMap<>((Map<String, Object>) fieldMap);
            String linkName = readString(m, "linkTableName", true);
            if (linkName == null || linkName.isBlank()) {
                throw new IllegalArgumentException("properties.linkTables[" + index + "]: linkTableName обязателен");
            }
            String trimmed = linkName.trim();
            String dedupKey = trimmed.toLowerCase(Locale.ROOT);
            if (seen.contains(dedupKey)) {
                throw new IllegalArgumentException("Дублируется связанная таблица: " + trimmed);
            }
            seen.add(dedupKey);
            if (!TABLE_NAME.matcher(trimmed).matches()) {
                throw new IllegalArgumentException(
                    "properties.linkTables[" + index + "]: недопустимое имя таблицы (схема.имя или имя)"
                );
            }
            if (!referenceBookRepository.existsTableInPublicSchema(trimmed)) {
                throw new IllegalArgumentException("Связанная таблица не найдена: " + trimmed);
            }
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("linkTableName", trimmed);
            result.add(one);
            index += 1;
        }
        return result;
    }

    private List<Map<String, Object>> normalizeSynonymKeyFields(Object synRaw) {
        if (synRaw == null) {
            return List.of();
        }
        if (!(synRaw instanceof List<?> list)) {
            throw new IllegalArgumentException("properties.synonymKeyFields должен быть массивом");
        }
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int index = 0;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> fieldMap)) {
                throw new IllegalArgumentException("properties.synonymKeyFields[" + index + "]: ожидается объект");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> m = new LinkedHashMap<>((Map<String, Object>) fieldMap);
            String syn = readString(m, "synonymKeyField", true);
            if (syn == null || syn.isBlank()) {
                throw new IllegalArgumentException("properties.synonymKeyFields[" + index + "]: synonymKeyField обязателен");
            }
            String trimmed = syn.trim();
            String dedupKey = trimmed.toLowerCase(Locale.ROOT);
            if (seen.contains(dedupKey)) {
                throw new IllegalArgumentException("Дублируется синоним ключевого поля: " + trimmed);
            }
            seen.add(dedupKey);
            if (!IDENTIFIER.matcher(trimmed).matches()) {
                throw new IllegalArgumentException(
                    "properties.synonymKeyFields[" + index + "]: synonymKeyField — только латиница, цифры и _"
                );
            }
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("synonymKeyField", trimmed);
            result.add(one);
            index += 1;
        }
        return result;
    }

    private Map<String, Object> normalizeField(Map<String, Object> field, String tableName, int index) {
        String prefix = "Поле [" + (index + 1) + "]: ";
        String fieldName = readString(field, "fieldName", true);
        if (fieldName == null || fieldName.isBlank()) {
            throw new IllegalArgumentException(prefix + "наименование поля (fieldName) обязательно");
        }
        if (!FIELD_NAME_LATIN.matcher(fieldName).matches()) {
            throw new IllegalArgumentException(prefix + "fieldName: только латиница, цифры и _");
        }
        String fieldCaption = readString(field, "fieldCaption", true);
        if (fieldCaption == null || fieldCaption.isBlank()) {
            throw new IllegalArgumentException(prefix + "заголовок поля (fieldCaption) обязателен");
        }
        String fieldType = readFieldType(field);
        Optional<ReferenceBookRepository.ColumnDbType> columnOpt =
            referenceBookRepository.findColumnInPublicTable(tableName, fieldName);
        if (columnOpt.isEmpty()) {
            throw new IllegalArgumentException(
                prefix + "в таблице \"" + tableName + "\" нет столбца \"" + fieldName + "\""
            );
        }
        ReferenceBookRepository.ColumnDbType col = columnOpt.get();
        if (!isCompatibleType(fieldType, col)) {
            throw new IllegalArgumentException(
                prefix + "тип столбца \"" + fieldName + "\" в БД не соответствует fieldType=" + fieldType
            );
        }

        boolean fieldRequired = readBoolean(field, "fieldRequired", null, false);
        boolean fieldShow = readBoolean(field, "fieldShow", null, true);
        boolean fieldEdit = readBoolean(field, "fieldEdit", null, true);
        boolean uniqueValue = readBoolean(field, "uniqueValue", null, false);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("fieldName", fieldName);
        out.put("fieldCaption", fieldCaption);
        out.put("fieldType", fieldType);
        out.put("fieldRequired", fieldRequired);
        out.put("fieldShow", fieldShow);
        out.put("fieldEdit", fieldEdit);
        out.put("uniqueValue", uniqueValue);
        String fieldShowLinkNorm = normalizeFieldShowLink(field, prefix);
        out.put("fieldShowLink", fieldShowLinkNorm);
        out.put("fieldCartType", normalizeFieldCartType(field, fieldShowLinkNorm, prefix));

        putDefaultValues(out, field, fieldType, prefix);

        if ("varchar".equals(fieldType)) {
            out.put("fieldValues", normalizeFieldValues(field, prefix));
        } else {
            out.put("fieldValues", List.of());
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldValuesOut = (List<Map<String, Object>>) out.get("fieldValues");
        boolean fieldValuesNotEmpty = fieldValuesOut != null && !fieldValuesOut.isEmpty();

        /* fieldValues и связь по полю — взаимоисключающие; при непустом fieldValues связь сбрасывается */
        if (fieldValuesNotEmpty) {
            out.put("fieldShowLink", "Нет");
            out.put("fieldCartType", "");
            out.put("fieldLinkTable", "");
            out.put("fieldLinkField", "");
            out.put("fieldLinkShowFields", List.of());
            out.put("fieldLinkShowLists", List.of());
            out.put("fieldLinkShowTooltips", List.of());
            out.put("fieldLinkFiltr", "");
            out.put("fieldLinkListType", "full");
            out.put("orderNumber", index + 1);
            return out;
        }

        String linkTable = readString(field, "fieldLinkTable", false);
        String linkField = readString(field, "fieldLinkField", false);

        if (linkTable != null && !linkTable.isBlank()) {
            if (!TABLE_NAME.matcher(linkTable.trim()).matches()) {
                throw new IllegalArgumentException(prefix + "fieldLinkTable: недопустимое имя (схема.таблица или таблица)");
            }
            if (!referenceBookRepository.existsTableInPublicSchema(linkTable.trim())) {
                throw new IllegalArgumentException(prefix + "таблица связи \"" + linkTable + "\" не найдена");
            }
            String lt = linkTable.trim();
            out.put("fieldLinkTable", lt);
            if (linkField != null && !linkField.isBlank()) {
                if (!IDENTIFIER.matcher(linkField.trim()).matches()) {
                    throw new IllegalArgumentException(prefix + "fieldLinkField: недопустимое имя");
                }
                if (referenceBookRepository.findColumnInPublicTable(lt, linkField.trim()).isEmpty()) {
                    throw new IllegalArgumentException(
                        prefix + "в таблице \"" + lt + "\" нет столбца \"" + linkField + "\""
                    );
                }
                out.put("fieldLinkField", linkField.trim());
            } else {
                out.put("fieldLinkField", "");
            }
            List<Map<String, Object>> showRows = normalizeFieldLinkShowFields(field, lt, prefix);
            if (linkField != null
                && !linkField.isBlank()
                && (showRows == null || showRows.isEmpty())) {
                throw new IllegalArgumentException(
                    prefix + "укажите хотя бы одно поле отображения связи (fieldLinkShowFields) или одно поле fieldLinkShowField"
                );
            }
            out.put("fieldLinkShowFields", showRows == null ? List.of() : showRows);
            List<Map<String, Object>> listRows = normalizeFieldLinkShowLists(field, lt, prefix);
            out.put("fieldLinkShowLists", listRows);
            out.put("fieldLinkListType", normalizeFieldLinkListType(field, prefix));
            List<Map<String, Object>> tipRows = normalizeFieldLinkShowTooltips(field, lt, prefix);
            out.put("fieldLinkShowTooltips", tipRows);
            String filtrRaw = readString(field, "fieldLinkFiltr", false);
            String filtrTrim = filtrRaw == null ? "" : filtrRaw.trim();
            if (!filtrTrim.isEmpty()) {
                referenceBookRepository.validateFieldLinkWhereFragment(lt, filtrTrim, tableName);
            }
            out.put("fieldLinkFiltr", filtrTrim);
        } else {
            out.put("fieldLinkTable", "");
            out.put("fieldLinkField", "");
            out.put("fieldLinkShowFields", List.of());
            out.put("fieldLinkShowLists", List.of());
            out.put("fieldLinkShowTooltips", List.of());
            out.put("fieldLinkFiltr", "");
            out.put("fieldLinkListType", "full");
        }

        out.put("orderNumber", index + 1);

        return out;
    }

    private static String normalizeFieldLinkListType(Map<String, Object> field, String prefix) {
        String raw = readString(field, "fieldLinkListType", false);
        if (raw == null || raw.isBlank()) {
            raw = readString(field, "field_link_list_type", false);
        }
        if (raw == null || raw.isBlank()) {
            return "full";
        }
        String t = raw.trim().toLowerCase(Locale.ROOT);
        if ("match".equals(t) || "совпадение".equals(t)) {
            return "match";
        }
        if ("full".equals(t) || "полный".equals(t)) {
            return "full";
        }
        throw new IllegalArgumentException(prefix + "fieldLinkListType: ожидается «Полный» (full) или «Совпадение» (match)");
    }

    private void putDefaultValues(Map<String, Object> out, Map<String, Object> field, String fieldType, String prefix) {
        switch (fieldType) {
            case "varchar" -> {
                String s = readString(field, "fieldDefaultValueString", false);
                out.put("fieldDefaultValueString", s == null ? "" : s);
                out.put("fieldDefaultValueNumeric", null);
                out.put("fieldDefaultValueBoolean", null);
            }
            case "numeric" -> {
                Object n = field.get("fieldDefaultValueNumeric");
                out.put("fieldDefaultValueString", null);
                out.put("fieldDefaultValueNumeric", n == null || "".equals(String.valueOf(n).trim()) ? null : n);
                out.put("fieldDefaultValueBoolean", null);
            }
            case "boolean" -> {
                Object b = field.get("fieldDefaultValueBoolean");
                if (b == null || "".equals(String.valueOf(b).trim())) {
                    out.put("fieldDefaultValueBoolean", null);
                } else if (b instanceof Boolean bool) {
                    out.put("fieldDefaultValueBoolean", bool);
                } else {
                    String t = String.valueOf(b).trim().toLowerCase(Locale.ROOT);
                    out.put("fieldDefaultValueBoolean", "true".equals(t) || "1".equals(t) || "да".equals(t));
                }
                out.put("fieldDefaultValueString", null);
                out.put("fieldDefaultValueNumeric", null);
            }
            default -> {
                out.put("fieldDefaultValueString", null);
                out.put("fieldDefaultValueNumeric", null);
                out.put("fieldDefaultValueBoolean", null);
            }
        }
    }

    private record LinkOrderRow(String name, int orderPos) {
    }

    private int readPositiveOrderPos(Map<String, Object> row, String key, int fallback, String itemPrefix) {
        Object v = row.get(key);
        if (v == null) {
            return fallback;
        }
        int i;
        if (v instanceof Number n) {
            i = n.intValue();
        } else {
            String s = String.valueOf(v).trim();
            if (s.isEmpty()) {
                return fallback;
            }
            try {
                i = Integer.parseInt(s);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException(itemPrefix + "orderPos: ожидается целое число");
            }
        }
        if (i <= 0) {
            throw new IllegalArgumentException(itemPrefix + "orderPos должен быть положительным числом");
        }
        return i;
    }

    private void validateUniqueOrderPos(List<LinkOrderRow> parsed, String prefix) {
        Set<Integer> seen = new HashSet<>();
        for (LinkOrderRow r : parsed) {
            if (!seen.add(r.orderPos())) {
                throw new IllegalArgumentException(prefix + "дублируется orderPos: " + r.orderPos());
            }
        }
    }

    private List<Map<String, Object>> normalizeFieldLinkShowFields(
        Map<String, Object> field,
        String linkTableTrimmed,
        String prefix
    ) {
        Object raw = field.get("fieldLinkShowFields");
        List<LinkOrderRow> parsed = new ArrayList<>();
        if (raw instanceof List<?> list && !list.isEmpty()) {
            int i = 0;
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) {
                    throw new IllegalArgumentException(prefix + "fieldLinkShowFields[" + i + "]: ожидается объект");
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> row = (Map<String, Object>) m;
                String name = readString(row, "fieldLinkShowField", false);
                if (name == null || name.isBlank()) {
                    i++;
                    continue;
                }
                if (!IDENTIFIER.matcher(name.trim()).matches()) {
                    throw new IllegalArgumentException(prefix + "fieldLinkShowFields[" + i + "]: недопустимое имя столбца");
                }
                int orderPos = readPositiveOrderPos(row, "orderPos", i + 1, prefix + "fieldLinkShowFields[" + i + "].");
                parsed.add(new LinkOrderRow(name.trim(), orderPos));
                i++;
            }
        } else {
            String legacy = readString(field, "fieldLinkShowField", false);
            if (legacy != null && !legacy.isBlank()) {
                if (!IDENTIFIER.matcher(legacy.trim()).matches()) {
                    throw new IllegalArgumentException(prefix + "fieldLinkShowField: недопустимое имя");
                }
                parsed.add(new LinkOrderRow(legacy.trim(), 1));
            }
        }
        parsed.sort(Comparator.comparingInt(LinkOrderRow::orderPos));
        validateUniqueOrderPos(parsed, prefix + "fieldLinkShowFields: ");
        List<Map<String, Object>> out = new ArrayList<>();
        for (LinkOrderRow r : parsed) {
            if (referenceBookRepository.findColumnInPublicTable(linkTableTrimmed, r.name()).isEmpty()) {
                throw new IllegalArgumentException(
                    prefix + "в таблице \"" + linkTableTrimmed + "\" нет столбца \"" + r.name() + "\""
                );
            }
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("fieldLinkShowField", r.name());
            one.put("orderPos", r.orderPos());
            out.add(one);
        }
        return out;
    }

    private List<Map<String, Object>> normalizeFieldLinkShowTooltips(
        Map<String, Object> field,
        String linkTableTrimmed,
        String prefix
    ) {
        Object raw = field.get("fieldLinkShowTooltips");
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            return List.of();
        }
        List<LinkOrderRow> parsed = new ArrayList<>();
        int i = 0;
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> m)) {
                throw new IllegalArgumentException(prefix + "fieldLinkShowTooltips[" + i + "]: ожидается объект");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> row = (Map<String, Object>) m;
            String name = readString(row, "fieldLinkShowTooltip", false);
            if (name == null || name.isBlank()) {
                i++;
                continue;
            }
            if (!IDENTIFIER.matcher(name.trim()).matches()) {
                throw new IllegalArgumentException(prefix + "fieldLinkShowTooltips[" + i + "]: недопустимое имя столбца");
            }
            int orderPos = readPositiveOrderPos(row, "orderPos", i + 1, prefix + "fieldLinkShowTooltips[" + i + "].");
            parsed.add(new LinkOrderRow(name.trim(), orderPos));
            i++;
        }
        parsed.sort(Comparator.comparingInt(LinkOrderRow::orderPos));
        validateUniqueOrderPos(parsed, prefix + "fieldLinkShowTooltips: ");
        List<Map<String, Object>> out = new ArrayList<>();
        for (LinkOrderRow r : parsed) {
            if (referenceBookRepository.findColumnInPublicTable(linkTableTrimmed, r.name()).isEmpty()) {
                throw new IllegalArgumentException(
                    prefix + "в таблице \"" + linkTableTrimmed + "\" нет столбца \"" + r.name() + "\""
                );
            }
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("fieldLinkShowTooltip", r.name());
            one.put("orderPos", r.orderPos());
            out.add(one);
        }
        return out;
    }

    private List<Map<String, Object>> normalizeFieldValues(Map<String, Object> field, String prefix) {
        Object raw = field.get("fieldValues");
        if (raw == null) {
            return List.of();
        }
        if (!(raw instanceof List<?> list)) {
            throw new IllegalArgumentException(prefix + "fieldValues должен быть массивом");
        }
        List<Map<String, Object>> result = new ArrayList<>();
        int i = 0;
        for (Object row : list) {
            if (!(row instanceof Map<?, ?> m)) {
                throw new IllegalArgumentException(prefix + "fieldValues[" + i + "]: ожидается объект");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> rowMap = (Map<String, Object>) (Map<?, ?>) m;
            String vs = readString(rowMap, "fieldValueString", false);
            String vshow = readString(rowMap, "fieldValueShow", false);
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("fieldValueString", vs == null ? "" : vs);
            if (vshow == null || vshow.isBlank()) {
                one.put("fieldValueShow", vs == null ? "" : vs);
            } else {
                one.put("fieldValueShow", vshow);
            }
            result.add(one);
            i += 1;
        }
        return result;
    }

    private static boolean isCompatibleType(String fieldType, ReferenceBookRepository.ColumnDbType col) {
        String udt = col.udtName() == null ? "" : col.udtName().toLowerCase(Locale.ROOT);
        return switch (fieldType) {
            case "varchar" -> udt.equals("varchar")
                || udt.equals("text")
                || udt.equals("bpchar")
                || udt.equals("name")
                || udt.equals("uuid");
            case "numeric" -> udt.equals("int2")
                || udt.equals("int4")
                || udt.equals("int8")
                || udt.equals("numeric")
                || udt.equals("float4")
                || udt.equals("float8")
                || udt.equals("money");
            case "date" -> udt.equals("date");
            case "datetime" -> udt.equals("timestamp") || udt.equals("timestamptz");
            case "boolean" -> udt.equals("bool");
            default -> false;
        };
    }

    private static String readFieldType(Map<String, Object> field) {
        Object v = field.get("fieldType");
        if (v == null) {
            v = field.get("fieldTYpe");
        }
        String t = v == null ? "" : String.valueOf(v).trim().toLowerCase(Locale.ROOT);
        if (!FIELD_TYPES.contains(t)) {
            throw new IllegalArgumentException("fieldType обязателен: varchar, numeric, date, datetime, boolean");
        }
        return t;
    }

    private static String readString(Map<?, ?> map, String key, boolean required) {
        Object v = map.get(key);
        if (v == null) {
            return required ? null : "";
        }
        String s = String.valueOf(v).trim();
        return s;
    }

    private static boolean readBoolean(Map<?, ?> map, String primaryKey, String aliasKey, boolean defaultValue) {
        Object v = map.get(primaryKey);
        if (v == null && aliasKey != null) {
            v = map.get(aliasKey);
        }
        if (v == null) {
            return defaultValue;
        }
        if (v instanceof Boolean b) {
            return b;
        }
        String s = String.valueOf(v).trim().toLowerCase(Locale.ROOT);
        if (s.isEmpty()) {
            return defaultValue;
        }
        return "true".equals(s) || "1".equals(s) || "да".equals(s);
    }

    private static String normalizeFieldShowLink(Map<String, Object> field, String prefix) {
        Object v = field.get("fieldShowLink");
        String t = v == null ? "" : String.valueOf(v).trim();
        if (t.isEmpty()) {
            return "Нет";
        }
        if (!FIELD_SHOW_LINK.contains(t)) {
            throw new IllegalArgumentException(prefix + "fieldShowLink: допустимы «Нет», «Справочник», «Карточка»");
        }
        return t;
    }

    private static String normalizeFieldCartType(Map<String, Object> field, String fieldShowLink, String prefix) {
        if (!"Карточка".equals(fieldShowLink)) {
            return "";
        }
        Object v = field.get("fieldCartType");
        String t = v == null ? "" : String.valueOf(v).trim();
        if (t.isEmpty()) {
            return "Организация";
        }
        if (!FIELD_CART_TYPE.contains(t)) {
            throw new IllegalArgumentException(prefix + "fieldCartType: допустимы «Организация» или «Сотрудник»");
        }
        return t;
    }

    private List<Map<String, Object>> normalizeFieldLinkShowLists(
        Map<String, Object> field,
        String linkTableTrimmed,
        String prefix
    ) {
        Object raw = field.get("fieldLinkShowLists");
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            return List.of();
        }
        List<LinkOrderRow> parsed = new ArrayList<>();
        int i = 0;
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> m)) {
                throw new IllegalArgumentException(prefix + "fieldLinkShowLists[" + i + "]: ожидается объект");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> row = (Map<String, Object>) m;
            String name = readString(row, "fieldLinkShowList", false);
            if (name == null || name.isBlank()) {
                i++;
                continue;
            }
            if (!IDENTIFIER.matcher(name.trim()).matches()) {
                throw new IllegalArgumentException(prefix + "fieldLinkShowLists[" + i + "]: недопустимое имя столбца");
            }
            int orderPos = readPositiveOrderPos(row, "orderPos", i + 1, prefix + "fieldLinkShowLists[" + i + "].");
            parsed.add(new LinkOrderRow(name.trim(), orderPos));
            i++;
        }
        parsed.sort(Comparator.comparingInt(LinkOrderRow::orderPos));
        validateUniqueOrderPos(parsed, prefix + "fieldLinkShowLists: ");
        List<Map<String, Object>> out = new ArrayList<>();
        for (LinkOrderRow r : parsed) {
            if (referenceBookRepository.findColumnInPublicTable(linkTableTrimmed, r.name()).isEmpty()) {
                throw new IllegalArgumentException(
                    prefix + "в таблице \"" + linkTableTrimmed + "\" нет столбца \"" + r.name() + "\""
                );
            }
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("fieldLinkShowList", r.name());
            one.put("orderPos", r.orderPos());
            out.add(one);
        }
        return out;
    }
}
