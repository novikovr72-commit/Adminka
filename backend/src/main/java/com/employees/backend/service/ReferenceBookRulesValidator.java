package com.employees.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.employees.backend.repository.ReferenceBookRepository;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Структура {@code rules} в {@code reference_books.rules} (jsonb):
 * <ul>
 *   <li>корень — массив правил (неограниченное число элементов {@code uniqueness} и {@code presence});</li>
 *   <li>каждый элемент: {@code rule} — {@code "uniqueness"} или {@code "presence"};</li>
 *   <li>{@code fields} — непустой массив объектов с {@code tableName} (имя столбца целевой таблицы справочника, не {@code id}).</li>
 * </ul>
 * Правила задают связки полей (не одиночные колонки — для них есть флаги в properties полей).
 */
@Service
public class ReferenceBookRulesValidator {

    public static final Set<String> RULE_TYPES = Set.of("uniqueness", "presence");

    private static final String ID_COLUMN = "id";

    private final ReferenceBookRepository referenceBookRepository;
    private final ObjectMapper objectMapper;

    public ReferenceBookRulesValidator(ReferenceBookRepository referenceBookRepository, ObjectMapper objectMapper) {
        this.referenceBookRepository = referenceBookRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * @param tableName целевая таблица справочника ({@code table_name} записи), для проверки имён столбцов
     * @return JSON-строка для {@code jsonb} или {@code null}
     */
    public String validateAndSerializeRules(Object raw, String tableName) throws IOException {
        if (raw == null) {
            return null;
        }
        List<?> root = parseRootArray(raw);
        if (root.isEmpty()) {
            return objectMapper.writeValueAsString(List.of());
        }
        if (tableName == null || tableName.isBlank()) {
            throw new IllegalArgumentException("Имя таблицы справочника (tableName) обязательно для проверки rules");
        }
        List<String> dbColumns = referenceBookRepository.listColumnNamesForTable(tableName);
        Set<String> dbColumnsLower = dbColumns.stream()
            .map(c -> c.toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());

        List<Map<String, Object>> normalized = new ArrayList<>();
        for (int i = 0; i < root.size(); i++) {
            Object item = root.get(i);
            if (!(item instanceof Map<?, ?> rawMap)) {
                throw new IllegalArgumentException("rules[" + i + "]: ожидается объект");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> ruleObj = new LinkedHashMap<>((Map<String, Object>) rawMap);
            String ruleType = readRuleType(ruleObj, i);
            if (!RULE_TYPES.contains(ruleType)) {
                throw new IllegalArgumentException(
                    "rules[" + i + "].rule: допустимы только " + RULE_TYPES + ", передано: \"" + ruleType + "\"");
            }
            List<Map<String, Object>> fieldsNorm = readAndNormalizeFields(ruleObj, i, dbColumnsLower, tableName);
            LinkedHashMap<String, Object> one = new LinkedHashMap<>();
            one.put("rule", ruleType);
            one.put("fields", fieldsNorm);
            normalized.add(one);
        }
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(normalized);
    }

    private List<?> parseRootArray(Object raw) throws IOException {
        if (raw instanceof List<?> list) {
            return list;
        }
        if (raw instanceof String text) {
            String t = text.trim();
            if (t.isEmpty()) {
                return List.of();
            }
            Object parsed = objectMapper.readValue(t, new TypeReference<Object>() {});
            if (parsed instanceof List<?> list) {
                return list;
            }
            throw new IllegalArgumentException("rules: корень должен быть JSON-массивом");
        }
        throw new IllegalArgumentException("rules: ожидается JSON-массив или null");
    }

    private static String readRuleType(Map<String, Object> ruleObj, int index) {
        Object r = ruleObj.get("rule");
        if (r == null) {
            throw new IllegalArgumentException("rules[" + index + "]: отсутствует поле rule");
        }
        String s = String.valueOf(r).trim();
        if (s.isEmpty()) {
            throw new IllegalArgumentException("rules[" + index + "].rule не может быть пустым");
        }
        return s.toLowerCase(Locale.ROOT);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readAndNormalizeFields(
        Map<String, Object> ruleObj,
        int ruleIndex,
        Set<String> dbColumnsLower,
        String tableName
    ) {
        Object fraw = ruleObj.get("fields");
        if (fraw == null) {
            fraw = ruleObj.get("fileds");
        }
        if (!(fraw instanceof List<?> flist)) {
            throw new IllegalArgumentException("rules[" + ruleIndex + "]: поле fields должно быть непустым массивом");
        }
        if (flist.isEmpty()) {
            throw new IllegalArgumentException("rules[" + ruleIndex + "].fields: нужен хотя бы один столбец");
        }
        if (flist.size() < 2) {
            throw new IllegalArgumentException(
                "rules[" + ruleIndex + "].fields: в правиле должно быть не менее двух столбцов "
                    + "(для одного поля используйте «Обязательное» / «Уникальное значение» в свойствах поля)");
        }
        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (int j = 0; j < flist.size(); j++) {
            Object el = flist.get(j);
            if (!(el instanceof Map<?, ?> fm)) {
                throw new IllegalArgumentException(
                    "rules[" + ruleIndex + "].fields[" + j + "]: ожидается объект с tableName");
            }
            Map<String, Object> fieldMap = (Map<String, Object>) fm;
            String col = readTableName(fieldMap, ruleIndex, j);
            if (col.equalsIgnoreCase(ID_COLUMN)) {
                throw new IllegalArgumentException(
                    "rules[" + ruleIndex + "].fields[" + j + "]: поле id в правилах не указывается");
            }
            String low = col.toLowerCase(Locale.ROOT);
            if (!dbColumnsLower.contains(low)) {
                throw new IllegalArgumentException(
                    "rules[" + ruleIndex + "].fields[" + j + "]: неизвестный столбец \"" + col + "\" для таблицы "
                        + tableName);
            }
            if (!seen.add(low)) {
                throw new IllegalArgumentException(
                    "rules[" + ruleIndex + "].fields: столбец \"" + col + "\" указан дважды");
            }
            LinkedHashMap<String, Object> norm = new LinkedHashMap<>();
            norm.put("tableName", col);
            out.add(norm);
        }
        return out;
    }

    private static String readTableName(Map<String, Object> fieldMap, int ruleIndex, int fieldIndex) {
        Object o = fieldMap.get("tableName");
        if (o == null) {
            o = fieldMap.get("table_name");
        }
        if (o == null) {
            throw new IllegalArgumentException(
                "rules[" + ruleIndex + "].fields[" + fieldIndex + "]: ожидается tableName");
        }
        String s = String.valueOf(o).trim();
        if (s.isEmpty()) {
            throw new IllegalArgumentException(
                "rules[" + ruleIndex + "].fields[" + fieldIndex + "].tableName не может быть пустым");
        }
        return s;
    }
}
