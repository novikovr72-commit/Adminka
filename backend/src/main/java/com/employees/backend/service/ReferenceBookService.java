package com.employees.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.employees.backend.repository.ReferenceBookRepository;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReferenceBookService {

    private static final Set<String> ALLOWED_SORT_DIRECTIONS = Set.of("ASC", "DESC");
    private static final Set<String> SORT_FIELDS = Set.of(
        "code",
        "name",
        "reference_url",
        "procedure_code",
        "table_name",
        "add_records",
        "edit_records");
    private static final Set<String> TEXT_SORT_FIELDS = Set.of("code", "name", "reference_url", "procedure_code", "table_name");
    private static final Map<String, String> SORT_SQL = Map.of(
        "code", "rb.code",
        "name", "rb.name",
        "reference_url", "rb.reference_url",
        "procedure_code", "rb.procedure_code",
        "table_name", "rb.table_name",
        "add_records", "rb.add_records",
        "edit_records", "rb.edit_records");

    private final ReferenceBookRepository referenceBookRepository;
    private final ObjectMapper objectMapper;
    private final ReferenceBookPropertiesValidator referenceBookPropertiesValidator;
    private final ReferenceBookRulesValidator referenceBookRulesValidator;

    public ReferenceBookService(
        ReferenceBookRepository referenceBookRepository,
        ObjectMapper objectMapper,
        ReferenceBookPropertiesValidator referenceBookPropertiesValidator,
        ReferenceBookRulesValidator referenceBookRulesValidator
    ) {
        this.referenceBookRepository = referenceBookRepository;
        this.objectMapper = objectMapper;
        this.referenceBookPropertiesValidator = referenceBookPropertiesValidator;
        this.referenceBookRulesValidator = referenceBookRulesValidator;
    }

    public ResponseEntity<Map<String, Object>> listPost(Map<String, Object> rawBody) {
        try {
            Map<String, Object> body = normalizeRequestBody(rawBody);
            ParseResult limitParsed = parsePositiveInteger(body.get("limit"), 50, "limit");
            if (limitParsed.error() != null) {
                return badRequest(limitParsed.error());
            }
            ParseResult offsetParsed = parsePositiveInteger(body.get("offset"), 1, "offset");
            if (offsetParsed.error() != null) {
                return badRequest(offsetParsed.error());
            }
            SortParseResult sortsResult = parseSorts(body);
            if (sortsResult.error() != null) {
                return badRequest(sortsResult.error());
            }
            List<SortRule> sorts = sortsResult.sorts().isEmpty()
                ? List.of(new SortRule("code", "ASC"))
                : sortsResult.sorts();

            int limit = limitParsed.value().intValue();
            int offset = offsetParsed.value().intValue();
            int sqlOffset = (offset - 1) * limit;

            List<String> where = new ArrayList<>();
            where.add("rb.deleted = false");
            MapSqlParameterSource params = new MapSqlParameterSource();

            appendIlikeTokens(where, params, "code", "rb.code", body.get("code"));
            appendIlikeTokens(where, params, "name", "rb.name", body.get("name"));
            appendIlikeTokens(where, params, "refurl", "rb.reference_url", body.get("referenceUrl"));
            appendIlikeTokens(where, params, "proc", "rb.procedure_code", body.get("procedureCode"));
            appendIlikeTokens(where, params, "tblname", "rb.table_name", body.get("tableName"));
            appendIlikeTokens(where, params, "addrec", "rb.add_records::text", body.get("addRecords"));
            appendIlikeTokens(where, params, "editrec", "rb.edit_records::text", body.get("editRecords"));

            String whereSql = " where " + String.join(" and ", where);
            String orderBy = buildOrderBy(sorts);

            params.addValue("limit", limit);
            params.addValue("offset", sqlOffset);

            int total = referenceBookRepository.countActive(whereSql, params);
            List<Map<String, Object>> rows = referenceBookRepository.listPage(whereSql, orderBy, params);
            List<Map<String, Object>> items = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                items.add(mapRowToResponseItem(row));
            }

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "total", total,
                "limit", limit,
                "offset", offset,
                "sorts", toSortMapsCamel(sorts)
            ));
        } catch (DataAccessException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", "Ошибка БД: " + formatDataAccessMessage(exception)));
        }
    }

    private static String formatDataAccessMessage(DataAccessException exception) {
        Throwable root = exception.getMostSpecificCause();
        String message = root.getMessage() != null ? root.getMessage() : exception.getMessage();
        return message == null ? "неизвестная ошибка" : message;
    }

    public ResponseEntity<Map<String, Object>> getById(String idRaw) {
        String id = normalizeText(idRaw);
        if (id == null || !isUuid(id)) {
            return badRequest("Некорректный идентификатор");
        }
        Map<String, Object> row = referenceBookRepository.findActiveById(id);
        if (row == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Запись не найдена"));
        }
        return ResponseEntity.ok(mapOf("ok", true, "item", mapRowToResponseItem(row)));
    }

    public ResponseEntity<Map<String, Object>> listDbTables() {
        try {
            List<String> items = referenceBookRepository.listAllBaseTablesQualifiedNames();
            return ResponseEntity.ok(mapOf("ok", true, "items", items));
        } catch (DataAccessException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", "Ошибка БД: " + formatDataAccessMessage(exception)));
        }
    }

    public ResponseEntity<Map<String, Object>> listDbTableColumns(String tableRaw) {
        String tableName = normalizeText(tableRaw);
        if (tableName == null || tableName.isBlank()) {
            return badRequest("Параметр table обязателен");
        }
        try {
            if (!referenceBookRepository.existsTableInPublicSchema(tableName)) {
                return badRequest("Таблица не найдена: " + tableName);
            }
            List<String> items = referenceBookRepository.listColumnNamesForTable(tableName);
            return ResponseEntity.ok(mapOf("ok", true, "items", items));
        } catch (DataAccessException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", "Ошибка БД: " + formatDataAccessMessage(exception)));
        }
    }

    /**
     * Страница строк таблицы справочника: колонки из {@code properties.fields} с {@code fieldShow},
     * данные в порядке полей, безопасный SELECT из {@code table_name}.
     */
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> listDataRecords(String refSuffixRaw, Map<String, Object> rawBody) {
        String refSuffix = normalizeText(refSuffixRaw);
        if (refSuffix == null || refSuffix.isBlank()) {
            return badRequest("Некорректный суффикс URL справочника");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        ParseResult limitParsed = parsePositiveInteger(body.get("limit"), 50, "limit");
        if (limitParsed.error() != null) {
            return badRequest(limitParsed.error());
        }
        ParseResult offsetParsed = parsePositiveInteger(body.get("offset"), 1, "offset");
        if (offsetParsed.error() != null) {
            return badRequest(offsetParsed.error());
        }
        int limit = limitParsed.value().intValue();
        int offset = offsetParsed.value().intValue();
        int sqlOffset = (offset - 1) * limit;

        Map<String, Object> row = referenceBookRepository.findActiveByReferenceUrl(refSuffix);
        if (row == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Справочник с таким суффиксом URL не найден"));
        }
        String procedureCodeRow = normalizeText(row.get("procedure_code"));
        if (procedureCodeRow != null && !procedureCodeRow.isBlank()) {
            return badRequest(
                "Для этого справочника задан код процедуры (procedureCode). Стандартный просмотр данных недоступен; "
                    + "эксклюзивные сценарии выводите отдельными процедурами, в procedureCode укажите имя для вызова: «"
                    + procedureCodeRow
                    + "»."
            );
        }
        String tableName = normalizeText(row.get("table_name"));
        if (tableName == null || tableName.isBlank()) {
            return badRequest("Справочник не привязан к таблице (tableName)");
        }
        try {
            if (!referenceBookRepository.existsTableInPublicSchema(tableName)) {
                return badRequest("Таблица не найдена: " + tableName);
            }
            List<String> dbColumns = referenceBookRepository.listColumnNamesForTable(tableName);
            Set<String> dbColumnSet = new HashSet<>(dbColumns);

            Object propsParsed = parsePropertiesFromDb(row.get("properties"));
            Map<String, Object> props;
            if (propsParsed instanceof Map<?, ?> propsMap) {
                props = new LinkedHashMap<>((Map<String, Object>) propsMap);
            } else {
                props = new LinkedHashMap<>();
            }
            Object fieldsObj = props.get("fields");
            if (fieldsObj == null) {
                fieldsObj = props.get("Fields");
            }
            List<Map<String, Object>> fieldsList = new ArrayList<>();
            if (fieldsObj instanceof List<?> list) {
                for (Object o : list) {
                    if (o instanceof Map<?, ?> m) {
                        fieldsList.add((Map<String, Object>) m);
                    }
                }
            }
            fieldsList.sort(
                Comparator.comparingInt(
                    f -> {
                        Object o = f.get("orderNumber");
                        if (o instanceof Number n) {
                            return n.intValue();
                        }
                        return 0;
                    }
                )
            );

            List<LinkedHashMap<String, Object>> columnsMeta = new ArrayList<>();
            List<String> selectColumnNames = new ArrayList<>();
            List<String> rowKeys = new ArrayList<>();

            for (Map<String, Object> field : fieldsList) {
                if (!readFieldBooleanFlexible(field, "fieldShow", true)) {
                    continue;
                }
                String fieldName = normalizeText(getPropertyFieldValue(field, "fieldName"));
                if (fieldName == null) {
                    continue;
                }
                String colLower = fieldName.toLowerCase(Locale.ROOT);
                if (!dbColumnSet.contains(colLower)) {
                    continue;
                }
                String caption = normalizeText(getPropertyFieldValue(field, "fieldCaption"));
                if (caption == null) {
                    caption = fieldName;
                }
                String fieldType = normalizeText(getPropertyFieldValue(field, "fieldType"));
                if (fieldType == null) {
                    fieldType = "varchar";
                }
                LinkedHashMap<String, Object> col = new LinkedHashMap<>();
                col.put("fieldName", fieldName);
                col.put("fieldCaption", caption);
                col.put("fieldType", fieldType);
                putFieldValuesMeta(col, field);
                putFieldShowLinkMeta(col, field);
                putFieldLinkMetadataIfValid(col, field);
                putFieldInsertMeta(col, field, fieldType);
                columnsMeta.add(col);
                selectColumnNames.add(colLower);
                rowKeys.add(fieldName);
            }

            /* Нет ни одного поля из JSON — показываем все столбцы таблицы (порядок из information_schema). */
            if (selectColumnNames.isEmpty() && !dbColumns.isEmpty()) {
                for (String colName : dbColumns) {
                    if (colName == null || colName.isBlank()) {
                        continue;
                    }
                    String colLower = colName.toLowerCase(Locale.ROOT);
                    Optional<ReferenceBookRepository.ColumnDbType> colType =
                        referenceBookRepository.findColumnInPublicTable(tableName, colName);
                    String fieldType = colType.map(this::inferFieldTypeForFallbackColumn).orElse("varchar");
                    LinkedHashMap<String, Object> col = new LinkedHashMap<>();
                    col.put("fieldName", colName);
                    col.put("fieldCaption", colName);
                    col.put("fieldType", fieldType);
                    putFieldInsertMeta(col, new LinkedHashMap<>(), fieldType);
                    columnsMeta.add(col);
                    selectColumnNames.add(colLower);
                    rowKeys.add(colName);
                }
            }

            if (selectColumnNames.isEmpty()) {
                long totalEmpty = referenceBookRepository.countAllRowsInTable(tableName);
                return ResponseEntity.ok(
                    mapOf(
                        "ok",
                        true,
                        "referenceBook",
                        mapRowToResponseItem(row),
                        "columns",
                        columnsMeta,
                        "items",
                        List.of(),
                        "total",
                        totalEmpty,
                        "limit",
                        limit,
                        "offset",
                        offset,
                        "sorts",
                        List.of()
                    )
                );
            }

            DataSortParseResult dataSortParse = parseDataRecordSorts(body.get("sorts"), rowKeys);
            if (dataSortParse.error() != null) {
                return badRequest(dataSortParse.error());
            }
            List<DataSortRule> orderRules = dataSortParse.sorts().isEmpty()
                ? List.of(new DataSortRule(rowKeys.get(0), "ASC"))
                : dataSortParse.sorts();

            Optional<BuiltWhere> builtWhere = buildDataRecordFiltersWhere(body, rowKeys, selectColumnNames, columnsMeta);
            String orderByClause = buildDataRecordsOrderBy(
                orderRules,
                selectColumnNames,
                columnsMeta,
                rowKeys,
                tableName,
                builtWhere.isPresent()
            );
            List<Map<String, String>> sortsOut = toDataSortMaps(orderRules);
            /* Первичный ключ id нужен для PATCH, даже если столбец id не в списке отображаемых полей */
            List<String> sqlSelectColumnNames = new ArrayList<>(selectColumnNames);
            if (dbColumnSet.contains("id") && !selectColumnNames.contains("id")) {
                sqlSelectColumnNames.add("id");
            }
            long total;
            List<Map<String, Object>> dbRows;
            if (builtWhere.isEmpty()) {
                total = referenceBookRepository.countAllRowsInTable(tableName);
                dbRows =
                    referenceBookRepository.selectPageFromTable(tableName, sqlSelectColumnNames, orderByClause, limit, sqlOffset);
            } else {
                BuiltWhere bw = builtWhere.get();
                total = referenceBookRepository.countRowsFromTableWhere(tableName, bw.sql(), bw.params());
                dbRows =
                    referenceBookRepository.selectPageFromTableWhere(
                        tableName,
                        sqlSelectColumnNames,
                        bw.sql(),
                        orderByClause,
                        limit,
                        sqlOffset,
                        bw.params());
            }
            List<Map<String, Object>> items = new ArrayList<>();
            for (Map<String, Object> dbRow : dbRows) {
                LinkedHashMap<String, Object> out = new LinkedHashMap<>();
                for (int i = 0; i < selectColumnNames.size(); i++) {
                    String col = selectColumnNames.get(i);
                    String key = rowKeys.get(i);
                    Object val = dbRow.get(col);
                    if (val == null) {
                        val = dbRow.get(col.toLowerCase(Locale.ROOT));
                    }
                    out.put(key, val);
                }
                if (dbColumnSet.contains("id")) {
                    Object idVal = dbRow.get("id");
                    if (idVal == null) {
                        idVal = dbRow.get("ID");
                    }
                    if (idVal != null) {
                        out.put("id", idVal);
                    }
                }
                items.add(out);
            }
            applyFieldLinkDisplayValues(columnsMeta, rowKeys, items);
            return ResponseEntity.ok(
                mapOf(
                    "ok",
                    true,
                    "referenceBook",
                    mapRowToResponseItem(row),
                    "columns",
                    columnsMeta,
                    "items",
                    items,
                    "total",
                    total,
                    "limit",
                    limit,
                    "offset",
                    offset,
                    "sorts",
                    sortsOut
                )
            );
        } catch (DataAccessException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", "Ошибка БД: " + formatDataAccessMessage(exception)));
        } catch (IllegalArgumentException exception) {
            return badRequest(exception.getMessage());
        }
    }

    /**
     * Варианты для выпадающего списка связи (поле связи + отображение), порядок как в SQL.
     * Тело: {@code fieldLinkTable}, {@code fieldLinkField}, {@code fieldLinkShowFields} (массив) или
     * устаревшее {@code fieldLinkShowField} (одно поле); опционально {@code referenceRowValues} для подстановки в
     * {@code fieldLinkFiltr} выражений вида {@code object_type = [object_type]}.
     */
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> listLinkFieldOptions(String refSuffixRaw, Map<String, Object> rawBody) {
        String refSuffix = normalizeText(refSuffixRaw);
        if (refSuffix == null || refSuffix.isBlank()) {
            return badRequest("Некорректный суффикс URL справочника");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String linkTable = normalizeText(body.get("fieldLinkTable"));
        String linkField = normalizeText(body.get("fieldLinkField"));
        List<String> linkShowNames = extractOrderedLinkShowNamesFromRequestBody(body);
        if (linkTable == null || linkTable.isBlank() || linkField == null || linkField.isBlank() || linkShowNames.isEmpty()) {
            return badRequest("Укажите fieldLinkTable, fieldLinkField и fieldLinkShowFields, fieldLinkShowLists или fieldLinkShowField");
        }
        Map<String, Object> row = referenceBookRepository.findActiveByReferenceUrl(refSuffix);
        if (row == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Справочник с таким суффиксом URL не найден"));
        }
        if (!referenceBookRepository.existsTableInPublicSchema(linkTable)) {
            return badRequest("Таблица связи не найдена: " + linkTable);
        }
        if (referenceBookRepository.findColumnInPublicTable(linkTable, linkField).isEmpty()) {
            return badRequest("Столбец не найден: " + linkField);
        }
        for (String col : linkShowNames) {
            if (referenceBookRepository.findColumnInPublicTable(linkTable, col).isEmpty()) {
                return badRequest("Столбец не найден: " + col);
            }
        }
        Object propsParsed = parsePropertiesFromDb(row.get("properties"));
        Map<String, Object> props;
        if (propsParsed instanceof Map<?, ?> propsMap) {
            props = new LinkedHashMap<>((Map<String, Object>) propsMap);
        } else {
            props = new LinkedHashMap<>();
        }
        Object fieldsObj = props.get("fields");
        if (fieldsObj == null) {
            fieldsObj = props.get("Fields");
        }
        boolean allowed = false;
        Map<String, Object> matchedField = null;
        if (fieldsObj instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                Map<String, Object> field = (Map<String, Object>) m;
                if (linkTripleMatchesProperties(field, linkTable, linkField, linkShowNames)) {
                    allowed = true;
                    matchedField = field;
                    break;
                }
            }
        }
        if (!allowed || matchedField == null) {
            return badRequest("Комбинация связи не описана в структуре этого справочника");
        }
        /* Подпись в ответе и в выпадающем списке — по полям «Показ» (fieldLinkShowFields), не по «Список». */
        List<String> optionShowCols = extractOrderedLinkShowNamesFromMeta(new LinkedHashMap<>(matchedField));
        if (optionShowCols.isEmpty()) {
            optionShowCols = linkShowNames;
        }
        for (String col : optionShowCols) {
            if (referenceBookRepository.findColumnInPublicTable(linkTable, col).isEmpty()) {
                return badRequest("Столбец не найден: " + col);
            }
        }
        String linkFiltr = normalizeText(getPropertyFieldValue(matchedField, "fieldLinkFiltr"));
        if (linkFiltr == null) {
            linkFiltr = "";
        }
        String refTableName = normalizeText(row.get("table_name"));
        Map<String, Object> referenceRowValues = null;
        Object rvRaw = body.get("referenceRowValues");
        if (rvRaw instanceof Map<?, ?> rvMap) {
            referenceRowValues = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : rvMap.entrySet()) {
                if (e.getKey() != null) {
                    referenceRowValues.put(String.valueOf(e.getKey()), e.getValue());
                }
            }
        }
        String listType = normalizeFieldLinkListTypeStatic(getPropertyFieldValue(matchedField, "fieldLinkListType"));
        int limit = 100;
        Object limitRaw = body.get("limit");
        if (limitRaw instanceof Number number) {
            limit = Math.min(100, Math.max(1, number.intValue()));
        }
        int offset = 0;
        Object offRaw = body.get("offset");
        if (offRaw instanceof Number number) {
            offset = Math.max(0, number.intValue());
        }
        String search = normalizeText(body.get("search"));
        try {
            List<Map<String, Object>> rows;
            boolean applySearchFilter;
            if ("match".equals(listType)) {
                if (search == null || search.isBlank()) {
                    return ResponseEntity.ok(mapOf("ok", true, "items", List.of(), "hasMore", false));
                }
                applySearchFilter = true;
            } else {
                /* full: без текста — полный набор с учётом fieldLinkFiltr, порциями limit/offset; с текстом — фильтр ILIKE, offset для следующих порций */
                applySearchFilter = search != null && !search.isBlank();
            }
            MapSqlParameterSource filtrParams = new MapSqlParameterSource();
            String effectiveFiltr =
                linkFiltr.isEmpty()
                    ? ""
                    : referenceBookRepository.expandFieldLinkFiltrPlaceholdersForExecution(
                        linkFiltr,
                        refTableName,
                        referenceRowValues,
                        filtrParams
                    );
            rows =
                referenceBookRepository.listLinkFieldOptionsOrdered(
                    linkTable,
                    linkField,
                    optionShowCols,
                    limit,
                    offset,
                    search == null ? "" : search,
                    applySearchFilter,
                    effectiveFiltr.isBlank() ? null : effectiveFiltr,
                    filtrParams
                );
            List<Map<String, Object>> items = new ArrayList<>();
            for (Map<String, Object> r : rows) {
                Object lv = r.get("link_value");
                if (lv == null) {
                    lv = r.get("LINK_VALUE");
                }
                Object sv = r.get("show_value");
                if (sv == null) {
                    sv = r.get("SHOW_VALUE");
                }
                items.add(mapOf("linkValue", lv, "showValue", sv));
            }
            boolean hasMore = rows.size() >= limit;
            return ResponseEntity.ok(mapOf("ok", true, "items", items, "hasMore", hasMore));
        } catch (IllegalArgumentException exception) {
            return badRequest(exception.getMessage());
        } catch (DataAccessException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", "Ошибка БД: " + formatDataAccessMessage(exception)));
        }
    }

    /**
     * Вставка строки в таблицу справочника. Тело: {@code values} — объект {@code fieldName -> значение} (как ключи в данных).
     */
    @Transactional(rollbackFor = Exception.class)
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> insertDataRecord(String refSuffixRaw, Map<String, Object> rawBody) {
        String refSuffix = normalizeText(refSuffixRaw);
        if (refSuffix == null || refSuffix.isBlank()) {
            return badRequest("Некорректный суффикс URL справочника");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        Object valuesRaw = body.get("values");
        if (!(valuesRaw instanceof Map<?, ?> vm)) {
            return badRequest("Ожидается объект values");
        }
        Map<String, Object> valuesIn = new LinkedHashMap<>((Map<String, Object>) vm);
        Map<String, Object> row = referenceBookRepository.findActiveByReferenceUrl(refSuffix);
        if (row == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Справочник с таким суффиксом URL не найден"));
        }
        String procedureCodeRow = normalizeText(row.get("procedure_code"));
        if (procedureCodeRow != null && !procedureCodeRow.isBlank()) {
            return badRequest("Для этого справочника задан код процедуры; вставка строк недоступна");
        }
        if (!readBooleanFlag(row.get("add_records"), true)) {
            return badRequest("Добавление записей запрещено");
        }
        String tableName = normalizeText(row.get("table_name"));
        if (tableName == null || tableName.isBlank()) {
            return badRequest("Справочник не привязан к таблице (tableName)");
        }
        try {
            if (!referenceBookRepository.existsTableInPublicSchema(tableName)) {
                return badRequest("Таблица не найдена: " + tableName);
            }
            List<String> dbColumns = referenceBookRepository.listColumnNamesForTable(tableName);
            Set<String> dbColumnSet = new HashSet<>(dbColumns);
            Object propsParsed = parsePropertiesFromDb(row.get("properties"));
            Map<String, Object> props;
            if (propsParsed instanceof Map<?, ?> propsMap) {
                props = new LinkedHashMap<>((Map<String, Object>) propsMap);
            } else {
                props = new LinkedHashMap<>();
            }
            Object fieldsObj = props.get("fields");
            if (fieldsObj == null) {
                fieldsObj = props.get("Fields");
            }
            List<Map<String, Object>> fieldsList = new ArrayList<>();
            if (fieldsObj instanceof List<?> list) {
                for (Object o : list) {
                    if (o instanceof Map<?, ?> m) {
                        fieldsList.add((Map<String, Object>) m);
                    }
                }
            }
            fieldsList.sort(
                Comparator.comparingInt(
                    f -> {
                        Object o = f.get("orderNumber");
                        if (o instanceof Number n) {
                            return n.intValue();
                        }
                        return 0;
                    }
                )
            );
            List<LinkedHashMap<String, Object>> columnsMeta = new ArrayList<>();
            List<String> selectColumnNames = new ArrayList<>();
            List<String> rowKeys = new ArrayList<>();
            for (Map<String, Object> field : fieldsList) {
                if (!readFieldBooleanFlexible(field, "fieldShow", true)) {
                    continue;
                }
                String fieldName = normalizeText(getPropertyFieldValue(field, "fieldName"));
                if (fieldName == null) {
                    continue;
                }
                String colLower = fieldName.toLowerCase(Locale.ROOT);
                if (!dbColumnSet.contains(colLower)) {
                    continue;
                }
                String caption = normalizeText(getPropertyFieldValue(field, "fieldCaption"));
                if (caption == null) {
                    caption = fieldName;
                }
                String fieldType = normalizeText(getPropertyFieldValue(field, "fieldType"));
                if (fieldType == null) {
                    fieldType = "varchar";
                }
                LinkedHashMap<String, Object> col = new LinkedHashMap<>();
                col.put("fieldName", fieldName);
                col.put("fieldCaption", caption);
                col.put("fieldType", fieldType);
                putFieldValuesMeta(col, field);
                putFieldShowLinkMeta(col, field);
                putFieldLinkMetadataIfValid(col, field);
                putFieldInsertMeta(col, field, fieldType);
                columnsMeta.add(col);
                selectColumnNames.add(colLower);
                rowKeys.add(fieldName);
            }
            if (selectColumnNames.isEmpty() && !dbColumns.isEmpty()) {
                for (String colName : dbColumns) {
                    if (colName == null || colName.isBlank()) {
                        continue;
                    }
                    String colLower = colName.toLowerCase(Locale.ROOT);
                    Optional<ReferenceBookRepository.ColumnDbType> colType =
                        referenceBookRepository.findColumnInPublicTable(tableName, colName);
                    String fieldType = colType.map(this::inferFieldTypeForFallbackColumn).orElse("varchar");
                    LinkedHashMap<String, Object> col = new LinkedHashMap<>();
                    col.put("fieldName", colName);
                    col.put("fieldCaption", colName);
                    col.put("fieldType", fieldType);
                    putFieldInsertMeta(col, new LinkedHashMap<>(), fieldType);
                    columnsMeta.add(col);
                    selectColumnNames.add(colLower);
                    rowKeys.add(colName);
                }
            }
            if (selectColumnNames.isEmpty()) {
                return badRequest("Нет полей для вставки");
            }
            LinkedHashMap<String, Object> insertLowerToValue = new LinkedHashMap<>();
            for (int i = 0; i < rowKeys.size(); i++) {
                String key = rowKeys.get(i);
                String colLower = selectColumnNames.get(i);
                LinkedHashMap<String, Object> meta = columnsMeta.get(i);
                String fieldType = normalizeText(meta.get("fieldType"));
                if (fieldType == null) {
                    fieldType = "varchar";
                }
                boolean editable = readFieldBooleanFlexible(meta, "fieldEdit", true);
                Object raw = editable ? valuesIn.get(key) : null;
                if (!editable) {
                    raw = getDefaultRawFromInsertMeta(meta, fieldType);
                }
                /* Редактируемое поле + null из формы: не подставляем fieldDefaultValue* — иначе при вставке дубли по UNIQUE (напр. code). */
                Object coerced;
                try {
                    coerced = coerceInsertValue(raw, fieldType, tableName, colLower);
                } catch (IllegalArgumentException ex) {
                    return badRequest(ex.getMessage());
                }
                boolean required = readFieldBooleanFlexible(meta, "fieldRequired", false);
                if (required && isEmptyInsertValue(coerced, fieldType)) {
                    return badRequest("Не заполнено обязательное поле: " + captionForInsertError(meta, key));
                }
                if (!isEmptyInsertValue(coerced, fieldType) && meta.get("fieldValues") instanceof List<?> fvList && !fvList.isEmpty()) {
                    if (!valueAllowedInFieldValues(coerced, fvList)) {
                        return badRequest("Недопустимое значение поля: " + captionForInsertError(meta, key));
                    }
                }
                String lt = normalizeText(meta.get("fieldLinkTable"));
                String lf = normalizeText(meta.get("fieldLinkField"));
                List<String> linkShowCols = extractOrderedLinkShowNamesFromMeta(meta);
                if (lt != null
                    && !lt.isBlank()
                    && lf != null
                    && !lf.isBlank()
                    && !linkShowCols.isEmpty()
                    && !isEmptyInsertValue(coerced, fieldType)) {
                    if (!referenceBookRepository.existsLinkFieldValue(lt, lf, coerced)) {
                        return badRequest("Значение не найдено в связанной таблице: " + captionForInsertError(meta, key));
                    }
                }
                if (!isEmptyInsertValue(coerced, fieldType) && readFieldBooleanFlexible(meta, "uniqueValue", false)) {
                    long cnt = referenceBookRepository.countRowsWhereColumnEquals(tableName, colLower, coerced);
                    if (cnt > 0) {
                        return badRequest("Значение должно быть уникальным: " + captionForInsertError(meta, key));
                    }
                }
                if ("id".equals(colLower) && isEmptyInsertValue(coerced, fieldType)) {
                    /* Не передаём NULL в INSERT — иначе ломается serial/identity/default у PK. */
                    continue;
                }
                insertLowerToValue.put(colLower, coerced);
            }
            String hiddenErrInsert = validateAndMergeHiddenFields(
                false, fieldsList, dbColumnSet, tableName, valuesIn, insertLowerToValue, null);
            if (hiddenErrInsert != null) {
                return badRequest(hiddenErrInsert);
            }
            syncNameEngFromName(dbColumnSet, insertLowerToValue);
            String rulesErrInsert = validateReferenceBookRulesOnSave(
                tableName,
                insertLowerToValue,
                null,
                row.get("rules"),
                buildColumnToFieldTypeMap(fieldsList, tableName, dbColumnSet));
            if (rulesErrInsert != null) {
                return badRequest(rulesErrInsert);
            }
            ensureGeneratedPrimaryKeyForInsert(tableName, dbColumnSet, insertLowerToValue);
            referenceBookRepository.insertRow(tableName, insertLowerToValue);
            return ResponseEntity.ok(mapOf("ok", true, "message", "Запись добавлена"));
        } catch (DataAccessException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", "Ошибка БД: " + formatDataAccessMessage(exception)));
        } catch (IllegalArgumentException exception) {
            return badRequest(exception.getMessage());
        }
    }

    /**
     * Обновление строки. Тело: {@code id} — ключ записи, {@code values} — как при вставке.
     */
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> updateDataRecord(String refSuffixRaw, Map<String, Object> rawBody) {
        String refSuffix = normalizeText(refSuffixRaw);
        if (refSuffix == null || refSuffix.isBlank()) {
            return badRequest("Некорректный суффикс URL справочника");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        Object idRaw = body.get("id");
        if (idRaw == null) {
            return badRequest("Ожидается id записи");
        }
        Object valuesRaw = body.get("values");
        if (!(valuesRaw instanceof Map<?, ?> vm)) {
            return badRequest("Ожидается объект values");
        }
        Map<String, Object> valuesIn = new LinkedHashMap<>((Map<String, Object>) vm);
        Map<String, Object> row = referenceBookRepository.findActiveByReferenceUrl(refSuffix);
        if (row == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Справочник с таким суффиксом URL не найден"));
        }
        String procedureCodeRow = normalizeText(row.get("procedure_code"));
        if (procedureCodeRow != null && !procedureCodeRow.isBlank()) {
            return badRequest("Для этого справочника задан код процедуры; изменение строк недоступно");
        }
        if (!readBooleanFlag(row.get("edit_records"), true)) {
            return badRequest("Редактирование записей запрещено");
        }
        String tableName = normalizeText(row.get("table_name"));
        if (tableName == null || tableName.isBlank()) {
            return badRequest("Справочник не привязан к таблице (tableName)");
        }
        try {
            if (!referenceBookRepository.existsTableInPublicSchema(tableName)) {
                return badRequest("Таблица не найдена: " + tableName);
            }
            List<String> dbColumns = referenceBookRepository.listColumnNamesForTable(tableName);
            Set<String> dbColumnSet = new HashSet<>(dbColumns);
            Object propsParsed = parsePropertiesFromDb(row.get("properties"));
            Map<String, Object> props;
            if (propsParsed instanceof Map<?, ?> propsMap) {
                props = new LinkedHashMap<>((Map<String, Object>) propsMap);
            } else {
                props = new LinkedHashMap<>();
            }
            Object fieldsObj = props.get("fields");
            if (fieldsObj == null) {
                fieldsObj = props.get("Fields");
            }
            List<Map<String, Object>> fieldsList = new ArrayList<>();
            if (fieldsObj instanceof List<?> list) {
                for (Object o : list) {
                    if (o instanceof Map<?, ?> m) {
                        fieldsList.add((Map<String, Object>) m);
                    }
                }
            }
            fieldsList.sort(
                Comparator.comparingInt(
                    f -> {
                        Object o = f.get("orderNumber");
                        if (o instanceof Number n) {
                            return n.intValue();
                        }
                        return 0;
                    }
                )
            );
            List<LinkedHashMap<String, Object>> columnsMeta = new ArrayList<>();
            List<String> selectColumnNames = new ArrayList<>();
            List<String> rowKeys = new ArrayList<>();
            for (Map<String, Object> field : fieldsList) {
                if (!readFieldBooleanFlexible(field, "fieldShow", true)) {
                    continue;
                }
                String fieldName = normalizeText(getPropertyFieldValue(field, "fieldName"));
                if (fieldName == null) {
                    continue;
                }
                String colLower = fieldName.toLowerCase(Locale.ROOT);
                if (!dbColumnSet.contains(colLower)) {
                    continue;
                }
                String caption = normalizeText(getPropertyFieldValue(field, "fieldCaption"));
                if (caption == null) {
                    caption = fieldName;
                }
                String fieldType = normalizeText(getPropertyFieldValue(field, "fieldType"));
                if (fieldType == null) {
                    fieldType = "varchar";
                }
                LinkedHashMap<String, Object> col = new LinkedHashMap<>();
                col.put("fieldName", fieldName);
                col.put("fieldCaption", caption);
                col.put("fieldType", fieldType);
                putFieldValuesMeta(col, field);
                putFieldShowLinkMeta(col, field);
                putFieldLinkMetadataIfValid(col, field);
                putFieldInsertMeta(col, field, fieldType);
                columnsMeta.add(col);
                selectColumnNames.add(colLower);
                rowKeys.add(fieldName);
            }
            if (selectColumnNames.isEmpty() && !dbColumns.isEmpty()) {
                for (String colName : dbColumns) {
                    if (colName == null || colName.isBlank()) {
                        continue;
                    }
                    String colLower = colName.toLowerCase(Locale.ROOT);
                    Optional<ReferenceBookRepository.ColumnDbType> colType =
                        referenceBookRepository.findColumnInPublicTable(tableName, colName);
                    String fieldType = colType.map(this::inferFieldTypeForFallbackColumn).orElse("varchar");
                    LinkedHashMap<String, Object> col = new LinkedHashMap<>();
                    col.put("fieldName", colName);
                    col.put("fieldCaption", colName);
                    col.put("fieldType", fieldType);
                    putFieldInsertMeta(col, new LinkedHashMap<>(), fieldType);
                    columnsMeta.add(col);
                    selectColumnNames.add(colLower);
                    rowKeys.add(colName);
                }
            }
            if (selectColumnNames.isEmpty()) {
                return badRequest("Нет полей для обновления");
            }
            LinkedHashMap<String, Object> updateLowerToValue = new LinkedHashMap<>();
            for (int i = 0; i < rowKeys.size(); i++) {
                String key = rowKeys.get(i);
                String colLower = selectColumnNames.get(i);
                if ("id".equals(colLower)) {
                    continue;
                }
                LinkedHashMap<String, Object> meta = columnsMeta.get(i);
                String fieldType = normalizeText(meta.get("fieldType"));
                if (fieldType == null) {
                    fieldType = "varchar";
                }
                boolean editable = readFieldBooleanFlexible(meta, "fieldEdit", true);
                Object raw = editable ? valuesIn.get(key) : null;
                if (!editable) {
                    raw = getDefaultRawFromInsertMeta(meta, fieldType);
                } else if (raw == null) {
                    raw = getDefaultRawFromInsertMeta(meta, fieldType);
                }
                Object coerced;
                try {
                    coerced = coerceInsertValue(raw, fieldType, tableName, colLower);
                } catch (IllegalArgumentException ex) {
                    return badRequest(ex.getMessage());
                }
                boolean required = readFieldBooleanFlexible(meta, "fieldRequired", false);
                if (required && isEmptyInsertValue(coerced, fieldType)) {
                    return badRequest("Не заполнено обязательное поле: " + captionForInsertError(meta, key));
                }
                if (!isEmptyInsertValue(coerced, fieldType) && meta.get("fieldValues") instanceof List<?> fvList && !fvList.isEmpty()) {
                    if (!valueAllowedInFieldValues(coerced, fvList)) {
                        return badRequest("Недопустимое значение поля: " + captionForInsertError(meta, key));
                    }
                }
                String lt = normalizeText(meta.get("fieldLinkTable"));
                String lf = normalizeText(meta.get("fieldLinkField"));
                List<String> linkShowCols = extractOrderedLinkShowNamesFromMeta(meta);
                if (lt != null
                    && !lt.isBlank()
                    && lf != null
                    && !lf.isBlank()
                    && !linkShowCols.isEmpty()
                    && !isEmptyInsertValue(coerced, fieldType)) {
                    if (!referenceBookRepository.existsLinkFieldValue(lt, lf, coerced)) {
                        return badRequest("Значение не найдено в связанной таблице: " + captionForInsertError(meta, key));
                    }
                }
                if (!isEmptyInsertValue(coerced, fieldType) && readFieldBooleanFlexible(meta, "uniqueValue", false)) {
                    long cnt = referenceBookRepository.countRowsWhereColumnEqualsExcludingPk(
                        tableName, colLower, coerced, "id", idRaw);
                    if (cnt > 0) {
                        return badRequest("Значение должно быть уникальным: " + captionForInsertError(meta, key));
                    }
                }
                updateLowerToValue.put(colLower, coerced);
            }
            if (updateLowerToValue.isEmpty()) {
                return badRequest("Нет полей для обновления");
            }
            String hiddenErrUpdate = validateAndMergeHiddenFields(
                true, fieldsList, dbColumnSet, tableName, valuesIn, updateLowerToValue, idRaw);
            if (hiddenErrUpdate != null) {
                return badRequest(hiddenErrUpdate);
            }
            syncNameEngFromName(dbColumnSet, updateLowerToValue);
            String rulesErrUpdate = validateReferenceBookRulesOnSave(
                tableName,
                updateLowerToValue,
                idRaw,
                row.get("rules"),
                buildColumnToFieldTypeMap(fieldsList, tableName, dbColumnSet));
            if (rulesErrUpdate != null) {
                return badRequest(rulesErrUpdate);
            }
            referenceBookRepository.updateRowByPk(tableName, "id", idRaw, updateLowerToValue);
            return ResponseEntity.ok(mapOf("ok", true, "message", "Запись сохранена"));
        } catch (DataAccessException exception) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", "Ошибка БД: " + formatDataAccessMessage(exception)));
        } catch (IllegalArgumentException exception) {
            return badRequest(exception.getMessage());
        }
    }

    /**
     * Если в таблице есть столбцы {@code name} и {@code name_eng}, задаём {@code name_eng} тем же значением, что {@code name}
     * (ключи в {@code columnLowerToValue} — в нижнем регистре, как при вставке/обновлении).
     */
    private static boolean isMissingPkValueForInsert(Object v) {
        if (v == null) {
            return true;
        }
        if (v instanceof String s) {
            return s.trim().isEmpty();
        }
        return false;
    }

    private static boolean isWholeNumberPostgresUdt(String udt) {
        if (udt == null || udt.isBlank()) {
            return false;
        }
        return switch (udt.trim().toLowerCase(Locale.ROOT)) {
            case "int2", "int4", "int8", "oid", "smallint", "integer", "bigint", "numeric", "decimal" -> true;
            default -> false;
        };
    }

    private static Object wrapIntegerPkForColumnType(long next, String udt) {
        String u = udt == null ? "" : udt.trim().toLowerCase(Locale.ROOT);
        if ("int2".equals(u) || "smallint".equals(u)) {
            if (next > Short.MAX_VALUE || next < Short.MIN_VALUE) {
                throw new IllegalArgumentException("Переполнение smallint для id");
            }
            return Short.valueOf((short) next);
        }
        if ("int4".equals(u) || "integer".equals(u)) {
            if (next > Integer.MAX_VALUE || next < Integer.MIN_VALUE) {
                throw new IllegalArgumentException("Переполнение integer для id");
            }
            return Integer.valueOf((int) next);
        }
        if ("numeric".equals(u) || "decimal".equals(u)) {
            return BigDecimal.valueOf(next);
        }
        return Long.valueOf(next);
    }

    /**
     * Если в таблице есть {@code id} без SERIAL/IDENTITY/DEFAULT в БД — задаём значение в приложении (max+1 или uuid).
     */
    private void ensureGeneratedPrimaryKeyForInsert(
        String tableName,
        Set<String> dbColumnSet,
        LinkedHashMap<String, Object> insertLowerToValue
    ) {
        if (!columnExistsIgnoreCase(dbColumnSet, "id")) {
            return;
        }
        Object cur = insertLowerToValue.get("id");
        if (!isMissingPkValueForInsert(cur)) {
            return;
        }
        if (referenceBookRepository.columnHasIdentityOrDefaultInDb(tableName, "id")) {
            insertLowerToValue.remove("id");
            return;
        }
        Optional<ReferenceBookRepository.ColumnDbType> ct = referenceBookRepository.findColumnInPublicTable(tableName, "id");
        if (ct.isEmpty()) {
            return;
        }
        String udt = ct.get().udtName() == null ? "" : ct.get().udtName().trim().toLowerCase(Locale.ROOT);
        if ("uuid".equals(udt)) {
            insertLowerToValue.put("id", UUID.randomUUID());
            return;
        }
        if (isWholeNumberPostgresUdt(udt)) {
            long next = referenceBookRepository.allocateNextIntegerPrimaryKey(tableName, "id");
            insertLowerToValue.put("id", wrapIntegerPkForColumnType(next, udt));
            return;
        }
        throw new IllegalArgumentException(
            "Колонка id без автоинкремента в БД: укажите id вручную или используйте тип uuid / целое число.");
    }

    private static void syncNameEngFromName(Set<String> dbColumns, Map<String, Object> columnLowerToValue) {
        if (columnLowerToValue == null || columnLowerToValue.isEmpty() || dbColumns == null || dbColumns.isEmpty()) {
            return;
        }
        if (!columnExistsIgnoreCase(dbColumns, "name") || !columnExistsIgnoreCase(dbColumns, "name_eng")) {
            return;
        }
        if (!columnLowerToValue.containsKey("name")) {
            return;
        }
        columnLowerToValue.put("name_eng", columnLowerToValue.get("name"));
    }

    private static boolean columnExistsIgnoreCase(Set<String> dbColumns, String logicalName) {
        if (logicalName == null || logicalName.isBlank()) {
            return false;
        }
        String want = logicalName.toLowerCase(Locale.ROOT);
        for (String c : dbColumns) {
            if (c != null && want.equals(c.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseRulesListFromDb(Object raw) {
        Object parsed = parseRulesFromDb(raw);
        if (parsed == null) {
            return List.of();
        }
        if (parsed instanceof List<?> list) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object o : list) {
                if (o instanceof Map<?, ?> m) {
                    out.add((Map<String, Object>) m);
                }
            }
            return out;
        }
        return List.of();
    }

    private Map<String, String> buildColumnToFieldTypeMap(
        List<Map<String, Object>> fieldsList,
        String tableName,
        Set<String> dbColumnSet
    ) {
        Map<String, String> map = new LinkedHashMap<>();
        for (Map<String, Object> field : fieldsList) {
            String fieldName = normalizeText(getPropertyFieldValue(field, "fieldName"));
            if (fieldName == null) {
                continue;
            }
            String colLower = fieldName.toLowerCase(Locale.ROOT);
            if (!dbColumnSet.contains(colLower)) {
                continue;
            }
            String fieldType = normalizeText(getPropertyFieldValue(field, "fieldType"));
            if (fieldType == null) {
                fieldType = "varchar";
            }
            map.put(colLower, fieldType);
        }
        for (String col : dbColumnSet) {
            if (col == null || col.isBlank()) {
                continue;
            }
            String cl = col.toLowerCase(Locale.ROOT);
            if (!map.containsKey(cl)) {
                Optional<ReferenceBookRepository.ColumnDbType> colType =
                    referenceBookRepository.findColumnInPublicTable(tableName, col);
                map.put(cl, colType.map(this::inferFieldTypeForFallbackColumn).orElse("varchar"));
            }
        }
        return map;
    }

    /**
     * Проверка {@code rules} (presence / uniqueness) по итоговому набору колонок перед записью в БД.
     */
    private String validateReferenceBookRulesOnSave(
        String tableName,
        Map<String, Object> columnLowerToValue,
        Object pkValueOrNull,
        Object rulesRaw,
        Map<String, String> fieldTypeByColumnLower
    ) {
        List<Map<String, Object>> rulesList = parseRulesListFromDb(rulesRaw);
        if (rulesList.isEmpty()) {
            return null;
        }
        for (int i = 0; i < rulesList.size(); i++) {
            Map<String, Object> ruleObj = rulesList.get(i);
            if (ruleObj == null) {
                continue;
            }
            Object r = ruleObj.get("rule");
            String ruleType = r == null ? "" : String.valueOf(r).trim().toLowerCase(Locale.ROOT);
            Object fraw = ruleObj.get("fields");
            if (fraw == null) {
                fraw = ruleObj.get("fileds");
            }
            if (!(fraw instanceof List<?> flist) || flist.size() < 2) {
                continue;
            }
            List<String> cols = new ArrayList<>();
            for (Object el : flist) {
                if (!(el instanceof Map<?, ?> fm)) {
                    continue;
                }
                String col = normalizeTextStatic(fm.get("tableName"));
                if (col == null) {
                    col = normalizeTextStatic(fm.get("table_name"));
                }
                if (col == null || col.isBlank()) {
                    continue;
                }
                cols.add(col.toLowerCase(Locale.ROOT));
            }
            if (cols.size() < 2) {
                continue;
            }
            if ("presence".equals(ruleType)) {
                boolean any = false;
                for (String col : cols) {
                    Object v = columnLowerToValue.get(col);
                    String ft = fieldTypeByColumnLower.getOrDefault(col, "varchar");
                    if (!isEmptyInsertValue(v, ft)) {
                        any = true;
                        break;
                    }
                }
                if (!any) {
                    return "Нарушение правила presence (правило "
                        + (i + 1)
                        + "): хотя бы одно из полей должно быть заполнено";
                }
            } else if ("uniqueness".equals(ruleType)) {
                List<Object> vals = new ArrayList<>();
                for (String col : cols) {
                    vals.add(columnLowerToValue.get(col));
                }
                long cnt;
                if (pkValueOrNull != null) {
                    cnt = referenceBookRepository.countRowsWhereColumnsTupleEqualsExcludingPk(
                        tableName, cols, vals, "id", pkValueOrNull);
                } else {
                    cnt = referenceBookRepository.countRowsWhereColumnsTupleEquals(tableName, cols, vals);
                }
                if (cnt > 0) {
                    return "Нарушение правила uniqueness (правило "
                        + (i + 1)
                        + "): такая комбинация значений полей уже существует";
                }
            }
        }
        return null;
    }

    /**
     * Обязательность и уникальность для полей с {@code fieldShow = false}; непустые значения добавляются в карту строки.
     */
    private String validateAndMergeHiddenFields(
        boolean isUpdate,
        List<Map<String, Object>> fieldsList,
        Set<String> dbColumnSet,
        String tableName,
        Map<String, Object> valuesIn,
        LinkedHashMap<String, Object> rowMap,
        Object idRawForUniqueExcludeOrNull
    ) {
        for (Map<String, Object> field : fieldsList) {
            if (readFieldBooleanFlexible(field, "fieldShow", true)) {
                continue;
            }
            String fieldName = normalizeText(getPropertyFieldValue(field, "fieldName"));
            if (fieldName == null) {
                continue;
            }
            String colLower = fieldName.toLowerCase(Locale.ROOT);
            if (!dbColumnSet.contains(colLower) || "id".equals(colLower)) {
                continue;
            }
            String caption = normalizeText(getPropertyFieldValue(field, "fieldCaption"));
            if (caption == null) {
                caption = fieldName;
            }
            String fieldType = normalizeText(getPropertyFieldValue(field, "fieldType"));
            if (fieldType == null) {
                fieldType = "varchar";
            }
            LinkedHashMap<String, Object> meta = new LinkedHashMap<>();
            meta.put("fieldName", fieldName);
            meta.put("fieldCaption", caption);
            meta.put("fieldType", fieldType);
            putFieldValuesMeta(meta, field);
            putFieldShowLinkMeta(meta, field);
            putFieldLinkMetadataIfValid(meta, field);
            putFieldInsertMeta(meta, field, fieldType);
            boolean required = readFieldBooleanFlexible(meta, "fieldRequired", false);
            if (!required && !readFieldBooleanFlexible(meta, "uniqueValue", false)) {
                continue;
            }
            boolean editable = readFieldBooleanFlexible(meta, "fieldEdit", true);
            Object raw;
            if (isUpdate) {
                raw = editable ? valuesIn.get(fieldName) : null;
                if (!editable) {
                    raw = getDefaultRawFromInsertMeta(meta, fieldType);
                } else if (raw == null) {
                    raw = getDefaultRawFromInsertMeta(meta, fieldType);
                }
            } else {
                raw = editable ? valuesIn.get(fieldName) : null;
                if (!editable) {
                    raw = getDefaultRawFromInsertMeta(meta, fieldType);
                }
            }
            Object coerced;
            try {
                coerced = coerceInsertValue(raw, fieldType, tableName, colLower);
            } catch (IllegalArgumentException ex) {
                return ex.getMessage();
            }
            if (required && isEmptyInsertValue(coerced, fieldType)) {
                return "Не заполнено обязательное поле: " + captionForInsertError(meta, fieldName);
            }
            if (!isEmptyInsertValue(coerced, fieldType) && meta.get("fieldValues") instanceof List<?> fvList && !fvList.isEmpty()) {
                if (!valueAllowedInFieldValues(coerced, fvList)) {
                    return "Недопустимое значение поля: " + captionForInsertError(meta, fieldName);
                }
            }
            String lt = normalizeText(meta.get("fieldLinkTable"));
            String lf = normalizeText(meta.get("fieldLinkField"));
            List<String> linkShowCols = extractOrderedLinkShowNamesFromMeta(meta);
            if (lt != null
                && !lt.isBlank()
                && lf != null
                && !lf.isBlank()
                && !linkShowCols.isEmpty()
                && !isEmptyInsertValue(coerced, fieldType)) {
                if (!referenceBookRepository.existsLinkFieldValue(lt, lf, coerced)) {
                    return "Значение не найдено в связанной таблице: " + captionForInsertError(meta, fieldName);
                }
            }
            if (!isEmptyInsertValue(coerced, fieldType) && readFieldBooleanFlexible(meta, "uniqueValue", false)) {
                long cnt;
                if (isUpdate && idRawForUniqueExcludeOrNull != null) {
                    cnt = referenceBookRepository.countRowsWhereColumnEqualsExcludingPk(
                        tableName, colLower, coerced, "id", idRawForUniqueExcludeOrNull);
                } else {
                    cnt = referenceBookRepository.countRowsWhereColumnEquals(tableName, colLower, coerced);
                }
                if (cnt > 0) {
                    return "Значение должно быть уникальным: " + captionForInsertError(meta, fieldName);
                }
            }
            if (!isEmptyInsertValue(coerced, fieldType)) {
                rowMap.put(colLower, coerced);
            }
        }
        return null;
    }

    private static String captionForInsertError(Map<String, Object> meta, String key) {
        String c = normalizeTextStatic(meta.get("fieldCaption"));
        return c != null && !c.isBlank() ? c : key;
    }

    private static String normalizeTextStatic(Object raw) {
        if (raw == null) {
            return null;
        }
        String s = String.valueOf(raw).trim();
        return s.isEmpty() ? null : s;
    }

    /** full — полный список (до 100, с фильтром доступности); match — только по совпадению с текстом + пагинация offset. */
    private static String normalizeFieldLinkListTypeStatic(Object raw) {
        String s = normalizeTextStatic(raw);
        if (s == null || s.isBlank()) {
            return "full";
        }
        String t = s.toLowerCase(Locale.ROOT);
        if ("match".equals(t) || "совпадение".equals(t)) {
            return "match";
        }
        if ("full".equals(t) || "полный".equals(t)) {
            return "full";
        }
        return "full";
    }

    private Object getDefaultRawFromInsertMeta(LinkedHashMap<String, Object> meta, String fieldType) {
        String ft = fieldType == null ? "varchar" : fieldType.toLowerCase(Locale.ROOT);
        if ("numeric".equals(ft)) {
            return meta.get("fieldDefaultValueNumeric");
        }
        if ("boolean".equals(ft)) {
            return meta.get("fieldDefaultValueBoolean");
        }
        return meta.get("fieldDefaultValueString");
    }

    private boolean isEmptyInsertValue(Object coerced, String fieldType) {
        String ft = fieldType == null ? "varchar" : fieldType.toLowerCase(Locale.ROOT);
        if (coerced == null) {
            return true;
        }
        if ("boolean".equals(ft)) {
            return false;
        }
        if (coerced instanceof String s) {
            return s.trim().isEmpty();
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private boolean valueAllowedInFieldValues(Object coerced, List<?> fvList) {
        String needle = String.valueOf(coerced).trim();
        for (Object o : fvList) {
            if (!(o instanceof Map<?, ?> m)) {
                continue;
            }
            String vs = normalizeText(getPropertyFieldValue((Map<String, Object>) m, "fieldValueString"));
            if (vs != null && vs.equals(needle)) {
                return true;
            }
        }
        return false;
    }

    private Object coerceInsertValue(Object raw, String fieldType, String tableName, String colLower)
        throws IllegalArgumentException {
        String ft = fieldType == null ? "varchar" : fieldType.toLowerCase(Locale.ROOT);
        if (raw == null) {
            return null;
        }
        if ("boolean".equals(ft)) {
            if (raw instanceof Boolean b) {
                return b;
            }
            String s = String.valueOf(raw).trim().toLowerCase(Locale.ROOT);
            if (s.isEmpty()) {
                return null;
            }
            return "true".equals(s) || "1".equals(s) || "да".equals(s) || "t".equals(s);
        }
        Optional<ReferenceBookRepository.ColumnDbType> colDb =
            referenceBookRepository.findColumnInPublicTable(tableName, colLower);
        if ("numeric".equals(ft)) {
            if (raw instanceof Number n) {
                return n;
            }
            String s = String.valueOf(raw).trim();
            if (s.isEmpty()) {
                return null;
            }
            try {
                if (s.contains(".") || s.contains("e") || s.contains("E")) {
                    return new BigDecimal(s);
                }
                return Long.parseLong(s);
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException("Некорректное число: " + s);
            }
        }
        if ("date".equals(ft)) {
            String s = String.valueOf(raw).trim();
            if (s.isEmpty()) {
                return null;
            }
            try {
                return LocalDate.parse(s);
            } catch (DateTimeParseException e1) {
                try {
                    return LocalDateTime.parse(s).toLocalDate();
                } catch (DateTimeParseException e2) {
                    throw new IllegalArgumentException("Некорректная дата: " + s);
                }
            }
        }
        if ("datetime".equals(ft)) {
            String s = String.valueOf(raw).trim();
            if (s.isEmpty()) {
                return null;
            }
            try {
                return OffsetDateTime.parse(s).toLocalDateTime();
            } catch (DateTimeParseException e1) {
                try {
                    return LocalDateTime.parse(s);
                } catch (DateTimeParseException e2) {
                    throw new IllegalArgumentException("Некорректная дата/время: " + s);
                }
            }
        }
        /* varchar / uuid / прочее */
        String s = String.valueOf(raw).trim();
        if (s.isEmpty()) {
            return null;
        }
        if (colDb.isPresent()) {
            String udt = colDb.get().udtName() == null ? "" : colDb.get().udtName().toLowerCase(Locale.ROOT);
            if ("uuid".equals(udt)) {
                try {
                    return UUID.fromString(s);
                } catch (IllegalArgumentException ex) {
                    throw new IllegalArgumentException("Некорректный UUID: " + s);
                }
            }
        }
        return s;
    }

    /** Набор допустимых значений varchar: хранение и подпись для UI (см. properties.fields[].fieldValues). */
    @SuppressWarnings("unchecked")
    private void putFieldValuesMeta(LinkedHashMap<String, Object> col, Map<String, Object> field) {
        /* Как getPropertyFieldValue для поля: в jsonb может быть field_values / field_value_string (snake_case). */
        Object raw = getPropertyFieldValue(field, "fieldValues");
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            return;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> m)) {
                continue;
            }
            Map<String, Object> rowMap = (Map<String, Object>) (Map<?, ?>) m;
            String vs = normalizeText(getPropertyFieldValue(rowMap, "fieldValueString"));
            if (vs == null) {
                vs = "";
            }
            String vshow = normalizeText(getPropertyFieldValue(rowMap, "fieldValueShow"));
            if (vshow == null || vshow.isBlank()) {
                vshow = vs;
            }
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("fieldValueString", vs);
            one.put("fieldValueShow", vshow);
            out.add(one);
        }
        if (!out.isEmpty()) {
            col.put("fieldValues", out);
        }
    }

    private void putFieldShowLinkMeta(LinkedHashMap<String, Object> col, Map<String, Object> field) {
        String sl = normalizeText(getPropertyFieldValue(field, "fieldShowLink"));
        if (sl == null || sl.isBlank()) {
            sl = "Нет";
        }
        col.put("fieldShowLink", sl);
        String ct = "";
        if ("Карточка".equals(sl)) {
            String t = normalizeText(getPropertyFieldValue(field, "fieldCartType"));
            if (t != null && "Сотрудник".equals(t)) {
                ct = "Сотрудник";
            } else {
                ct = "Организация";
            }
        }
        col.put("fieldCartType", ct);
    }

    /** Метаданные связи для колонки: таблица, поле связи и массив полей отображения (порядок по orderPos). */
    private void putFieldLinkMetadataIfValid(LinkedHashMap<String, Object> col, Map<String, Object> field) {
        String linkTable = normalizeText(getPropertyFieldValue(field, "fieldLinkTable"));
        String linkField = normalizeText(getPropertyFieldValue(field, "fieldLinkField"));
        List<String> showNames = extractOrderedLinkShowNamesFromFieldMap(field);
        if (linkTable == null
            || linkTable.isBlank()
            || linkField == null
            || linkField.isBlank()
            || showNames.isEmpty()) {
            return;
        }
        if (!referenceBookRepository.existsTableInPublicSchema(linkTable)) {
            return;
        }
        if (referenceBookRepository.findColumnInPublicTable(linkTable, linkField).isEmpty()) {
            return;
        }
        for (String s : showNames) {
            if (referenceBookRepository.findColumnInPublicTable(linkTable, s).isEmpty()) {
                return;
            }
        }
        List<String> listNames = extractOrderedLinkListNamesFromFieldMap(field);
        for (String s : listNames) {
            if (referenceBookRepository.findColumnInPublicTable(linkTable, s).isEmpty()) {
                return;
            }
        }
        List<String> tipNames = extractOrderedLinkTooltipNamesFromFieldMap(field, showNames);
        for (String s : tipNames) {
            if (referenceBookRepository.findColumnInPublicTable(linkTable, s).isEmpty()) {
                return;
            }
        }
        col.put("fieldLinkTable", linkTable);
        col.put("fieldLinkField", linkField);
        col.put("fieldLinkShowFields", buildFieldLinkShowFieldRowsForMeta(showNames));
        col.put("fieldLinkShowLists", listNames.isEmpty() ? List.of() : buildFieldLinkListRowsForMeta(listNames));
        col.put(
            "fieldLinkShowTooltips",
            hasNonEmptyTooltipRows(field) ? buildFieldLinkTooltipRowsForMeta(tipNames) : List.of()
        );
        String filtr = normalizeText(getPropertyFieldValue(field, "fieldLinkFiltr"));
        col.put("fieldLinkFiltr", filtr == null ? "" : filtr);
        col.put("fieldLinkListType", normalizeFieldLinkListTypeStatic(getPropertyFieldValue(field, "fieldLinkListType")));
    }

    /** Метаданные для формы вставки: обязательность, редактирование, уникальность, значения по умолчанию. */
    private void putFieldInsertMeta(LinkedHashMap<String, Object> col, Map<String, Object> field, String fieldType) {
        Map<String, Object> f = field == null ? Map.of() : field;
        col.put("fieldRequired", readFieldBooleanFlexible(f, "fieldRequired", false));
        col.put("fieldEdit", readFieldBooleanFlexible(f, "fieldEdit", true));
        col.put("uniqueValue", readFieldBooleanFlexible(f, "uniqueValue", false));
        String ft = fieldType == null ? "varchar" : fieldType.toLowerCase(Locale.ROOT);
        if ("numeric".equals(ft)) {
            col.put("fieldDefaultValueString", null);
            col.put("fieldDefaultValueBoolean", null);
            Object n = getPropertyFieldValue(f, "fieldDefaultValueNumeric");
            if (n == null || String.valueOf(n).trim().isEmpty()) {
                col.put("fieldDefaultValueNumeric", null);
            } else {
                col.put("fieldDefaultValueNumeric", n);
            }
        } else if ("boolean".equals(ft)) {
            col.put("fieldDefaultValueString", null);
            col.put("fieldDefaultValueNumeric", null);
            col.put("fieldDefaultValueBoolean", readFieldBooleanFlexible(f, "fieldDefaultValueBoolean", false));
        } else {
            String s = normalizeText(getPropertyFieldValue(f, "fieldDefaultValueString"));
            col.put("fieldDefaultValueString", s == null ? "" : s);
            col.put("fieldDefaultValueNumeric", null);
            col.put("fieldDefaultValueBoolean", null);
        }
    }

    /** Дублирует вспомогательные ключи в camelCase, если имя поля snake_case — как у {@code fieldName} в UI. */
    private static void putFieldLinkAuxKeyAliases(Map<String, Object> item, String rowKey, String suffix, Object value) {
        if (value == null || rowKey == null || rowKey.isBlank() || suffix == null || suffix.isBlank()) {
            return;
        }
        item.put(rowKey + suffix, value);
        String camel = snakeFieldNameToCamel(rowKey);
        if (camel != null && !camel.equalsIgnoreCase(rowKey)) {
            item.putIfAbsent(camel + suffix, value);
        }
    }

    private static String snakeFieldNameToCamel(String snake) {
        if (snake == null || snake.isBlank() || !snake.contains("_")) {
            return null;
        }
        String[] p = snake.split("_");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < p.length; i++) {
            if (p[i].isEmpty()) {
                continue;
            }
            if (i == 0) {
                sb.append(p[i]);
            } else {
                sb.append(Character.toUpperCase(p[i].charAt(0)));
                if (p[i].length() > 1) {
                    sb.append(p[i].substring(1));
                }
            }
        }
        return sb.toString();
    }

    /**
     * Подмена значения ячейки на склейку полей отображения; в {@code rowKey + "__linkTooltip"} — склейка полей тултипа.
     */
    private void applyFieldLinkDisplayValues(
        List<LinkedHashMap<String, Object>> columnsMeta,
        List<String> rowKeys,
        List<Map<String, Object>> items
    ) {
        if (items == null || items.isEmpty()) {
            return;
        }
        for (int i = 0; i < columnsMeta.size(); i++) {
            LinkedHashMap<String, Object> meta = columnsMeta.get(i);
            String lt = normalizeText(meta.get("fieldLinkTable"));
            String lf = normalizeText(meta.get("fieldLinkField"));
            List<String> showCols = extractOrderedLinkShowNamesFromMeta(meta);
            if (lt == null || lf == null || showCols.isEmpty()) {
                continue;
            }
            List<String> tipCols = extractOrderedLinkTooltipNamesFromMeta(meta, showCols);
            String rowKey = rowKeys.get(i);
            LinkedHashSet<Object> distinct = new LinkedHashSet<>();
            for (Map<String, Object> item : items) {
                Object v = item.get(rowKey);
                if (v != null) {
                    distinct.add(v);
                }
            }
            if (distinct.isEmpty()) {
                continue;
            }
            try {
                ReferenceBookRepository.LinkComposedMaps maps =
                    referenceBookRepository.mapLinkFieldToComposedValues(lt, lf, showCols, tipCols, distinct);
                for (Map<String, Object> item : items) {
                    Object raw = item.get(rowKey);
                    if (raw == null) {
                        continue;
                    }
                    putFieldLinkAuxKeyAliases(item, rowKey, "__linkRaw", raw);
                    String ks = String.valueOf(raw);
                    Object show = maps.displayByKey().get(ks);
                    if (show != null) {
                        item.put(rowKey, show);
                    }
                    Object tip = maps.tooltipByKey().get(ks);
                    if (tip != null && !String.valueOf(tip).isBlank()) {
                        putFieldLinkAuxKeyAliases(item, rowKey, "__linkTooltip", tip);
                    }
                }
            } catch (DataAccessException | IllegalArgumentException ignored) {
                /* оставляем сырое значение */
            }
        }
    }

    private DataSortParseResult parseDataRecordSorts(Object raw, List<String> rowKeys) {
        if (rowKeys == null || rowKeys.isEmpty()) {
            return new DataSortParseResult(List.of(), null);
        }
        if (raw == null) {
            return new DataSortParseResult(List.of(), null);
        }
        if (!(raw instanceof List<?> list)) {
            return new DataSortParseResult(null, "Параметр sorts должен быть массивом");
        }
        if (list.size() > 8) {
            return new DataSortParseResult(null, "Параметр sorts: не более 8 полей");
        }
        Set<String> seen = new HashSet<>();
        List<DataSortRule> out = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> sortMap)) {
                return new DataSortParseResult(null, "Каждый элемент sorts должен быть объектом");
            }
            String rawField = normalizeText(sortMap.get("field"));
            if (rawField == null) {
                return new DataSortParseResult(null, "В sorts указано пустое поле");
            }
            String canonical = findCanonicalRowKey(rowKeys, rawField);
            if (canonical == null) {
                return new DataSortParseResult(null, "Параметр sorts: неизвестное поле «" + rawField + "»");
            }
            if (!seen.add(canonical)) {
                continue;
            }
            String direction = normalizeSortDirection(sortMap.get("direction"));
            if (!ALLOWED_SORT_DIRECTIONS.contains(direction)) {
                return new DataSortParseResult(null, "Параметр sorts: недопустимое направление сортировки");
            }
            out.add(new DataSortRule(canonical, direction));
        }
        return new DataSortParseResult(out, null);
    }

    private record BuiltWhere(String sql, MapSqlParameterSource params) {
    }

    /**
     * AND-условия по полям из {@code body.filters}; для varchar с {@code fieldValues} — по совпадению подстроки
     * с {@code fieldValueShow} или {@code fieldValueString}, в SQL — по значению столбца (= / in).
     */
    @SuppressWarnings("unchecked")
    private Optional<BuiltWhere> buildDataRecordFiltersWhere(
        Map<String, Object> body,
        List<String> rowKeys,
        List<String> selectColumnNames,
        List<LinkedHashMap<String, Object>> columnsMeta
    ) {
        final String dataAlias = ReferenceBookRepository.REFERENCE_BOOK_DATA_TABLE_ALIAS;
        Object raw = body.get("filters");
        if (!(raw instanceof Map<?, ?> rawMap) || rawMap.isEmpty()) {
            return Optional.empty();
        }
        List<String> parts = new ArrayList<>();
        MapSqlParameterSource params = new MapSqlParameterSource();
        int pIdx = 0;
        for (Map.Entry<?, ?> e : rawMap.entrySet()) {
            if (e.getKey() == null) {
                continue;
            }
            String keyRaw = normalizeText(String.valueOf(e.getKey()));
            String needle = normalizeText(e.getValue());
            if (keyRaw == null || keyRaw.isBlank() || needle == null || needle.isBlank()) {
                continue;
            }
            String canonical = findCanonicalRowKey(rowKeys, keyRaw);
            if (canonical == null) {
                continue;
            }
            int idx = indexOfRowKey(rowKeys, canonical);
            if (idx < 0) {
                continue;
            }
            String colLower = selectColumnNames.get(idx);
            LinkedHashMap<String, Object> meta = columnsMeta.get(idx);
            String quoted = qualifyDataTableColumn(dataAlias, colLower);
            String fieldType = normalizeText(meta.get("fieldType"));
            if (fieldType == null) {
                fieldType = "varchar";
            }
            String ft = fieldType.toLowerCase(Locale.ROOT);
            Object fvObj = meta.get("fieldValues");
            if ("varchar".equals(ft) && fvObj instanceof List<?> fvList && !fvList.isEmpty()) {
                String needleLower = needle.toLowerCase(Locale.ROOT);
                LinkedHashSet<String> matches = new LinkedHashSet<>();
                for (Object o : fvList) {
                    if (!(o instanceof Map<?, ?> row)) {
                        continue;
                    }
                    Map<String, Object> m = (Map<String, Object>) row;
                    String vs = normalizeText(getPropertyFieldValue(m, "fieldValueString"));
                    String vshow = normalizeText(getPropertyFieldValue(m, "fieldValueShow"));
                    if (vshow == null || vshow.isBlank()) {
                        vshow = vs;
                    }
                    if (vs != null
                        && (vs.toLowerCase(Locale.ROOT).contains(needleLower)
                            || (vshow != null && vshow.toLowerCase(Locale.ROOT).contains(needleLower)))) {
                        matches.add(vs);
                    }
                }
                if (matches.isEmpty()) {
                    parts.add("0=1");
                } else if (matches.size() == 1) {
                    String pname = "flt" + pIdx++;
                    params.addValue(pname, matches.iterator().next());
                    parts.add(quoted + " = :" + pname);
                } else {
                    String pname = "flt" + pIdx++;
                    params.addValue(pname, new ArrayList<>(matches));
                    parts.add(quoted + " in (:" + pname + ")");
                }
            } else if ("boolean".equals(ft)) {
                String upper = needle.toUpperCase(Locale.ROOT);
                if (!Set.of("ДА", "НЕТ").contains(upper)) {
                    throw new IllegalArgumentException("Фильтр по булевому полю должен быть ДА или НЕТ");
                }
                String pname = "flt" + pIdx++;
                params.addValue(pname, "ДА".equals(upper));
                parts.add(quoted + " = :" + pname);
            } else if (hasFieldLinkFilterMeta(meta)) {
                /* EXISTS по связанной таблице: меньше работы, чем IN (select …), плюс без дубля ilike при одном поле показа */
                String linkTable = normalizeText(meta.get("fieldLinkTable"));
                String linkField = normalizeText(meta.get("fieldLinkField"));
                List<String> showCols = extractOrderedLinkShowNamesFromMeta(meta);
                String fromQual = quoteQualifiedTableNameForSql(linkTable);
                String linkAlias = "lt";
                String lfQ = quoteSqlIdentifier(linkAlias) + "." + quoteSqlIdentifier(linkField);
                String pname = "flt" + pIdx++;
                String esc = escapeSqlLikePattern(needle);
                params.addValue(pname, "%" + esc + "%");
                String dispExpr = ReferenceBookRepository.buildPostgresLinkDisplayExpression(showCols, linkAlias);
                StringBuilder inner = new StringBuilder("(");
                if (showCols.size() <= 1) {
                    inner.append(dispExpr).append(" ilike :").append(pname).append(" escape '\\'");
                } else {
                    inner.append(dispExpr).append(" ilike :").append(pname).append(" escape '\\'");
                    for (String sc : showCols) {
                        inner.append(" or cast(")
                            .append(quoteSqlIdentifier(linkAlias))
                            .append(".")
                            .append(quoteSqlIdentifier(sc))
                            .append(" as text) ilike :")
                            .append(pname)
                            .append(" escape '\\'");
                    }
                }
                inner.append(")");
                parts.add(
                    "("
                        + "cast(" + quoted + " as text) ilike :" + pname + " escape '\\'"
                        + " or exists (select 1 from "
                        + fromQual
                        + " "
                        + quoteSqlIdentifier(linkAlias)
                        + " where "
                        + lfQ
                        + " = "
                        + quoted
                        + " and "
                        + inner
                        + ")"
                        + ")");
            } else {
                String pname = "flt" + pIdx++;
                String esc = escapeSqlLikePattern(needle);
                params.addValue(pname, "%" + esc + "%");
                parts.add("cast(" + quoted + " as text) ilike :" + pname + " escape '\\'");
            }
        }
        if (parts.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new BuiltWhere(String.join(" and ", parts), params));
    }

    /** Как в колонках ответа listDataRecords после putFieldLinkMetadataIfValid. */
    private static boolean hasFieldLinkFilterMeta(LinkedHashMap<String, Object> meta) {
        String lt = normalizeTextStatic(meta.get("fieldLinkTable"));
        String lf = normalizeTextStatic(meta.get("fieldLinkField"));
        List<String> show = extractOrderedLinkShowNamesFromMetaStatic(meta);
        return lt != null
            && !lt.isBlank()
            && lf != null
            && !lf.isBlank()
            && !show.isEmpty();
    }

    /** schema.table для подзапроса; имена только из проверенных метаданных. */
    private static String quoteQualifiedTableNameForSql(String qualifiedTableName) {
        String t = qualifiedTableName == null ? "" : qualifiedTableName.trim();
        if (t.isBlank()) {
            throw new IllegalArgumentException("Пустое имя таблицы связи");
        }
        if (!t.contains(".")) {
            return quoteSqlIdentifier("public") + "." + quoteSqlIdentifier(t);
        }
        int i = t.lastIndexOf('.');
        return quoteSqlIdentifier(t.substring(0, i).trim()) + "." + quoteSqlIdentifier(t.substring(i + 1).trim());
    }

    private static String escapeSqlLikePattern(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private String findCanonicalRowKey(List<String> rowKeys, String rawField) {
        if (rawField == null || rawField.isBlank()) {
            return null;
        }
        String norm = normalizeSortField(rawField);
        for (String rk : rowKeys) {
            if (rk.equalsIgnoreCase(rawField) || rk.equalsIgnoreCase(norm)) {
                return rk;
            }
            if (normalizeSortField(rk).equalsIgnoreCase(norm)) {
                return rk;
            }
        }
        return null;
    }

    private String buildDataRecordsOrderBy(
        List<DataSortRule> rules,
        List<String> selectColumnNames,
        List<LinkedHashMap<String, Object>> columnsMeta,
        List<String> rowKeys,
        String tableName,
        boolean useFilteredTableAlias
    ) {
        if (selectColumnNames.isEmpty()) {
            throw new IllegalArgumentException("Нет колонок для сортировки");
        }
        String dataAlias = useFilteredTableAlias ? ReferenceBookRepository.REFERENCE_BOOK_DATA_TABLE_ALIAS : null;
        if (rules == null || rules.isEmpty()) {
            return orderChunkForIndex(tableName, selectColumnNames, columnsMeta, 0, "ASC", dataAlias);
        }
        List<String> chunks = new ArrayList<>();
        for (DataSortRule rule : rules) {
            int idx = indexOfRowKey(rowKeys, rule.fieldKey());
            if (idx < 0) {
                continue;
            }
            chunks.add(orderChunkForIndex(tableName, selectColumnNames, columnsMeta, idx, rule.direction(), dataAlias));
        }
        if (chunks.isEmpty()) {
            return orderChunkForIndex(tableName, selectColumnNames, columnsMeta, 0, "ASC", dataAlias);
        }
        return String.join(", ", chunks);
    }

    private static int indexOfRowKey(List<String> rowKeys, String fieldKey) {
        for (int i = 0; i < rowKeys.size(); i++) {
            if (rowKeys.get(i).equalsIgnoreCase(fieldKey)) {
                return i;
            }
        }
        return -1;
    }

    private String orderChunkForIndex(
        String tableName,
        List<String> selectColumnNames,
        List<LinkedHashMap<String, Object>> columnsMeta,
        int idx,
        String direction,
        String dataTableAlias
    ) {
        String colRef = qualifyDataTableColumn(dataTableAlias, selectColumnNames.get(idx));
        LinkedHashMap<String, Object> meta = columnsMeta.get(idx);
        String fieldName = normalizeText(meta.get("fieldName"));
        boolean useCollate;
        if (tableName != null
            && !tableName.isBlank()
            && fieldName != null
            && !fieldName.isBlank()) {
            Optional<ReferenceBookRepository.ColumnDbType> colDb =
                referenceBookRepository.findColumnInPublicTable(tableName, fieldName);
            useCollate = colDb.map(this::isPgTextUdtForSort).orElseGet(() -> isTextFieldTypeForSort(normalizeText(meta.get("fieldType"))));
        } else {
            useCollate = isTextFieldTypeForSort(normalizeText(meta.get("fieldType")));
        }
        String expr = useCollate ? colRef + " collate \"C\"" : colRef;
        return expr + " " + direction + " nulls last";
    }

    /** COLLATE допустим только для текстовых типов PostgreSQL; для uuid и др. — ошибка «collations are not supported». */
    private boolean isPgTextUdtForSort(ReferenceBookRepository.ColumnDbType col) {
        String udt = col.udtName() == null ? "" : col.udtName().toLowerCase(Locale.ROOT);
        return "varchar".equals(udt)
            || "text".equals(udt)
            || "bpchar".equals(udt)
            || "name".equals(udt);
    }

    private static String quoteSqlIdentifier(String ident) {
        if (ident == null || ident.isBlank()) {
            throw new IllegalArgumentException("Пустой идентификатор");
        }
        String t = ident.trim();
        if (!t.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")) {
            throw new IllegalArgumentException("Недопустимый идентификатор: " + ident);
        }
        return "\"" + t.replace("\"", "\"\"") + "\"";
    }

    /** Колонка в запросе с фильтрами: {@code "schema"."table" AS _rb} — только {@code _rb."col"}. */
    private static String qualifyDataTableColumn(String tableAlias, String colLower) {
        if (tableAlias == null || tableAlias.isBlank()) {
            return quoteSqlIdentifier(colLower);
        }
        return quoteSqlIdentifier(tableAlias) + "." + quoteSqlIdentifier(colLower);
    }

    private static boolean isTextFieldTypeForSort(String fieldType) {
        if (fieldType == null || fieldType.isBlank()) {
            return false;
        }
        String t = fieldType.toLowerCase(Locale.ROOT);
        return "varchar".equals(t) || "text".equals(t) || "char".equals(t);
    }

    private List<Map<String, String>> toDataSortMaps(List<DataSortRule> rules) {
        List<Map<String, String>> out = new ArrayList<>();
        for (DataSortRule rule : rules) {
            out.add(mapOfString("field", rule.fieldKey(), "direction", rule.direction()));
        }
        return out;
    }

    private record DataSortRule(String fieldKey, String direction) {
    }

    private record DataSortParseResult(List<DataSortRule> sorts, String error) {
    }

    private boolean readFieldBoolean(Map<String, Object> field, String key, boolean defaultValue) {
        Object raw = field.get(key);
        if (raw == null) {
            return defaultValue;
        }
        if (raw instanceof Boolean booleanValue) {
            return booleanValue;
        }
        String s = String.valueOf(raw).trim().toLowerCase(Locale.ROOT);
        if (s.isEmpty()) {
            return defaultValue;
        }
        return "true".equals(s) || "1".equals(s) || "да".equals(s);
    }

    /** Тип поля для экрана данных, если колонки взяты из БД без описания в properties. */
    private String inferFieldTypeForFallbackColumn(ReferenceBookRepository.ColumnDbType col) {
        String udt = col.udtName() == null ? "" : col.udtName().toLowerCase(Locale.ROOT);
        if ("date".equals(udt)) {
            return "date";
        }
        if ("timestamp".equals(udt) || "timestamptz".equals(udt)) {
            return "datetime";
        }
        if ("bool".equals(udt)) {
            return "boolean";
        }
        if ("uuid".equals(udt)) {
            return "uuid";
        }
        if ("int2".equals(udt)
            || "int4".equals(udt)
            || "int8".equals(udt)
            || "numeric".equals(udt)
            || "float4".equals(udt)
            || "float8".equals(udt)
            || "money".equals(udt)) {
            return "numeric";
        }
        return "varchar";
    }

    public ResponseEntity<Map<String, Object>> create(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String code = normalizeText(body.get("code"));
        String name = normalizeText(body.get("name"));
        if (code == null) {
            return badRequest("Параметр code обязателен");
        }
        if (name == null) {
            return badRequest("Параметр name обязателен");
        }
        String procedureCode = normalizeText(body.get("procedureCode"));
        String tableName = normalizeText(body.get("tableName"));
        boolean addRecords = readBooleanFlag(body.get("addRecords"), true);
        boolean editRecords = readBooleanFlag(body.get("editRecords"), true);
        String referenceUrl = deriveReferenceUrlFromTableName(tableName);
        if (referenceUrl == null || referenceUrl.isBlank()) {
            return badRequest("Не удалось вычислить суффикс URL из имени таблицы (tableName)");
        }
        String propertiesJson;
        String rulesJson;
        try {
            referenceBookPropertiesValidator.validateMainTableBinding(tableName);
            Map<String, Object> propsMap = parsePropertiesOptional(body.get("properties"));
            Map<String, Object> validated = referenceBookPropertiesValidator.validatePropertiesOnly(propsMap, tableName);
            propertiesJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(validated);
            rulesJson = referenceBookRulesValidator.validateAndSerializeRules(body.get("rules"), tableName);
        } catch (IllegalArgumentException exception) {
            return badRequest(exception.getMessage());
        } catch (IOException exception) {
            return badRequest("properties или rules не удалось сериализовать");
        }
        if (referenceBookRepository.existsActiveByTableName(tableName, null)) {
            return conflict("Справочник с таким именем таблицы (tableName) уже существует");
        }
        if (referenceBookRepository.existsActiveByReferenceUrl(referenceUrl, null)) {
            return conflict("Справочник с таким суффиксом URL (referenceUrl) уже существует");
        }
        try {
            String newId = referenceBookRepository.insert(
                code, name, procedureCode, referenceUrl, tableName, addRecords, editRecords, propertiesJson, rulesJson
            );
            Map<String, Object> row = referenceBookRepository.findActiveById(newId);
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "Справочник создан",
                "item", row == null ? mapOf("id", newId) : mapRowToResponseItem(row)
            ));
        } catch (DataIntegrityViolationException exception) {
            return conflict("Запись с таким code уже существует");
        }
    }

    public ResponseEntity<Map<String, Object>> updateMain(String idRaw, Map<String, Object> rawBody) {
        String id = normalizeText(idRaw);
        if (id == null || !isUuid(id)) {
            return badRequest("Некорректный идентификатор");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        /* Только структура (jsonb): тот же PATCH /reference-books/{id}, что и для основных полей — без отдельного пути .../properties */
        if (body.size() == 1 && body.containsKey("properties")) {
            return updateProperties(idRaw, rawBody);
        }
        if (body.size() == 1 && body.containsKey("rules")) {
            return updateRules(idRaw, rawBody);
        }
        String code = normalizeText(body.get("code"));
        String name = normalizeText(body.get("name"));
        if (code == null) {
            return badRequest("Параметр code обязателен");
        }
        if (name == null) {
            return badRequest("Параметр name обязателен");
        }
        String procedureCode = normalizeText(body.get("procedureCode"));
        String tableName = normalizeText(body.get("tableName"));
        boolean addRecords = readBooleanFlag(body.get("addRecords"), true);
        boolean editRecords = readBooleanFlag(body.get("editRecords"), true);
        String referenceUrl = deriveReferenceUrlFromTableName(tableName);
        if (referenceUrl == null || referenceUrl.isBlank()) {
            return badRequest("Не удалось вычислить суффикс URL из имени таблицы (tableName)");
        }
        try {
            referenceBookPropertiesValidator.validateMainTableBinding(tableName);
        } catch (IllegalArgumentException exception) {
            return badRequest(exception.getMessage());
        }
        if (referenceBookRepository.existsActiveByTableName(tableName, id)) {
            return conflict("Справочник с таким именем таблицы (tableName) уже существует");
        }
        if (referenceBookRepository.existsActiveByReferenceUrl(referenceUrl, id)) {
            return conflict("Справочник с таким суффиксом URL (referenceUrl) уже существует");
        }
        try {
            int updated = referenceBookRepository.updateMain(
                id, code, name, procedureCode, referenceUrl, tableName, addRecords, editRecords
            );
            if (updated == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Запись не найдена"));
            }
            Map<String, Object> row = referenceBookRepository.findActiveById(id);
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "Основные параметры справочника сохранены",
                "item", row == null ? mapOf("id", id) : mapRowToResponseItem(row)
            ));
        } catch (DataIntegrityViolationException exception) {
            return conflict("Запись с таким code уже существует");
        }
    }

    public ResponseEntity<Map<String, Object>> updateProperties(String idRaw, Map<String, Object> rawBody) {
        String id = normalizeText(idRaw);
        if (id == null || !isUuid(id)) {
            return badRequest("Некорректный идентификатор");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        Map<String, Object> row = referenceBookRepository.findActiveById(id);
        if (row == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Запись не найдена"));
        }
        String tableName = normalizeText(row.get("table_name"));
        if (tableName == null) {
            return badRequest("У записи не задано имя таблицы (tableName)");
        }
        String propertiesJson;
        try {
            Map<String, Object> propsMap = parsePropertiesToMap(body.get("properties"));
            Map<String, Object> validated = referenceBookPropertiesValidator.validatePropertiesOnly(propsMap, tableName);
            propertiesJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(validated);
        } catch (IllegalArgumentException exception) {
            return badRequest(exception.getMessage());
        } catch (IOException exception) {
            return badRequest("properties не удалось сериализовать");
        }
        int updated = referenceBookRepository.updatePropertiesOnly(id, propertiesJson);
        if (updated == 0) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Запись не найдена"));
        }
        Map<String, Object> nextRow = referenceBookRepository.findActiveById(id);
        return ResponseEntity.ok(mapOf(
            "ok", true,
            "message", "Структура справочника (JSON) сохранена",
            "item", nextRow == null ? mapOf("id", id) : mapRowToResponseItem(nextRow)
        ));
    }

    public ResponseEntity<Map<String, Object>> updateRules(String idRaw, Map<String, Object> rawBody) {
        String id = normalizeText(idRaw);
        if (id == null || !isUuid(id)) {
            return badRequest("Некорректный идентификатор");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        Map<String, Object> row = referenceBookRepository.findActiveById(id);
        if (row == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Запись не найдена"));
        }
        String tableName = normalizeText(row.get("table_name"));
        if (tableName == null) {
            return badRequest("У записи не задано имя таблицы (tableName)");
        }
        String rulesJson;
        try {
            rulesJson = referenceBookRulesValidator.validateAndSerializeRules(body.get("rules"), tableName);
        } catch (IllegalArgumentException exception) {
            return badRequest(exception.getMessage());
        } catch (IOException exception) {
            return badRequest("rules не удалось сериализовать");
        }
        int updated = referenceBookRepository.updateRulesOnly(id, rulesJson);
        if (updated == 0) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Запись не найдена"));
        }
        Map<String, Object> nextRow = referenceBookRepository.findActiveById(id);
        return ResponseEntity.ok(mapOf(
            "ok", true,
            "message", "Правила справочника (rules) сохранены",
            "item", nextRow == null ? mapOf("id", id) : mapRowToResponseItem(nextRow)
        ));
    }

    public ResponseEntity<Map<String, Object>> deleteReferenceBook(String idRaw) {
        String id = normalizeText(idRaw);
        if (id == null || !isUuid(id)) {
            return badRequest("Некорректный идентификатор");
        }
        int deleted = referenceBookRepository.deleteById(id);
        if (deleted == 0) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("ok", false, "error", "Запись не найдена"));
        }
        return ResponseEntity.ok(mapOf("ok", true, "message", "Справочник удалён", "id", id));
    }

    private Map<String, Object> mapRowToResponseItem(Map<String, Object> row) {
        LinkedHashMap<String, Object> item = new LinkedHashMap<>();
        item.put("id", row.get("id"));
        item.put("code", row.get("code"));
        item.put("name", row.get("name"));
        item.put("nameEng", row.get("name_eng"));
        item.put("procedureCode", row.get("procedure_code"));
        item.put("referenceUrl", row.get("reference_url"));
        item.put("tableName", row.get("table_name"));
        item.put("addRecords", row.get("add_records"));
        item.put("editRecords", row.get("edit_records"));
        item.put("properties", parsePropertiesFromDb(row.get("properties")));
        item.put("rules", parseRulesFromDb(row.get("rules")));
        item.put("createdAt", row.get("created_at"));
        item.put("updatedAt", row.get("updated_at"));
        return item;
    }

    @SuppressWarnings("unchecked")
    private Object parsePropertiesFromDb(Object raw) {
        if (raw == null) {
            return stripLegacyPropertyKeys(new LinkedHashMap<>());
        }
        /* JDBC может отдать jsonb как Map или PGobject — PGobject только в runtime (jdbc), разбор через reflection. */
        if (raw instanceof Map<?, ?> mapRaw) {
            return stripLegacyPropertyKeys(new LinkedHashMap<>((Map<String, Object>) mapRaw));
        }
        String fromPg = tryParsePostgresJsonObject(raw);
        if (fromPg != null) {
            try {
                Map<String, Object> map =
                    objectMapper.readValue(fromPg, new TypeReference<Map<String, Object>>() {});
                return stripLegacyPropertyKeys(map);
            } catch (Exception exception) {
                return stripLegacyPropertyKeys(new LinkedHashMap<>());
            }
        }
        String text = normalizeText(raw);
        if (text == null) {
            return stripLegacyPropertyKeys(new LinkedHashMap<>());
        }
        try {
            Map<String, Object> map = objectMapper.readValue(text, new TypeReference<Map<String, Object>>() {});
            return stripLegacyPropertyKeys(map);
        } catch (Exception exception) {
            return stripLegacyPropertyKeys(new LinkedHashMap<>());
        }
    }

    /** JSON {@code rules} из jsonb: объект или массив; при отсутствии — {@code null}. */
    private Object parseRulesFromDb(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Map<?, ?> || raw instanceof List<?>) {
            return raw;
        }
        String fromPg = tryParsePostgresJsonObject(raw);
        if (fromPg != null) {
            try {
                return objectMapper.readValue(fromPg, Object.class);
            } catch (Exception exception) {
                return null;
            }
        }
        String text = normalizeText(raw);
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(text, Object.class);
        } catch (Exception exception) {
            return null;
        }
    }

    /** Драйвер PostgreSQL в compile scope недоступен — тип json/jsonb через reflection. */
    private static String tryParsePostgresJsonObject(Object raw) {
        if (raw == null || !"org.postgresql.util.PGobject".equals(raw.getClass().getName())) {
            return null;
        }
        try {
            Object type = raw.getClass().getMethod("getType").invoke(raw);
            Object value = raw.getClass().getMethod("getValue").invoke(raw);
            String t = type != null ? String.valueOf(type) : "";
            if (!"json".equals(t) && !"jsonb".equals(t)) {
                return null;
            }
            if (value == null) {
                return null;
            }
            String json = String.valueOf(value).trim();
            return json.isEmpty() ? null : json;
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }

    private record LinkFieldOrder(String name, int orderPos) {
    }

    @SuppressWarnings("unchecked")
    private List<String> extractOrderedLinkShowNamesFromRequestBody(Map<String, Object> body) {
        Object raw = body.get("fieldLinkShowFields");
        if (raw instanceof List<?> list && !list.isEmpty()) {
            List<LinkFieldOrder> tmp = new ArrayList<>();
            int i = 0;
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                Map<String, Object> row = (Map<String, Object>) m;
                String name = normalizeText(getPropertyFieldValue(row, "fieldLinkShowField"));
                if (name == null || name.isBlank()) {
                    continue;
                }
                Object op = row.get("orderPos");
                int order = op instanceof Number n ? n.intValue() : (i + 1);
                tmp.add(new LinkFieldOrder(name, order));
                i++;
            }
            tmp.sort(Comparator.comparingInt(LinkFieldOrder::orderPos));
            List<String> fromFields = tmp.stream().map(LinkFieldOrder::name).toList();
            if (!fromFields.isEmpty()) {
                return fromFields;
            }
        }
        Object rawLists = body.get("fieldLinkShowLists");
        if (rawLists instanceof List<?> listL && !listL.isEmpty()) {
            List<LinkFieldOrder> tmp = new ArrayList<>();
            int i = 0;
            for (Object o : listL) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                Map<String, Object> row = (Map<String, Object>) m;
                String name = normalizeText(getPropertyFieldValue(row, "fieldLinkShowList"));
                if (name == null || name.isBlank()) {
                    name = normalizeText(row.get("fieldLinkShowList"));
                }
                if (name == null || name.isBlank()) {
                    continue;
                }
                Object op = row.get("orderPos");
                int order = op instanceof Number n ? n.intValue() : (i + 1);
                tmp.add(new LinkFieldOrder(name, order));
                i++;
            }
            tmp.sort(Comparator.comparingInt(LinkFieldOrder::orderPos));
            List<String> fromLists = tmp.stream().map(LinkFieldOrder::name).toList();
            if (!fromLists.isEmpty()) {
                return fromLists;
            }
        }
        String legacy = normalizeText(body.get("fieldLinkShowField"));
        if (legacy != null && !legacy.isBlank()) {
            return List.of(legacy);
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private boolean linkTripleMatchesProperties(
        Map<String, Object> field,
        String linkTable,
        String linkField,
        List<String> requestedShowNames
    ) {
        String lt = normalizeText(getPropertyFieldValue(field, "fieldLinkTable"));
        String lf = normalizeText(getPropertyFieldValue(field, "fieldLinkField"));
        if (lt == null || !linkTable.equalsIgnoreCase(lt)) {
            return false;
        }
        if (lf == null || !linkField.equalsIgnoreCase(lf)) {
            return false;
        }
        List<String> propShow = extractOrderedLinkShowNamesFromFieldMap(field);
        if (!propShow.isEmpty()) {
            if (propShow.size() != requestedShowNames.size()) {
                return false;
            }
            for (int i = 0; i < propShow.size(); i++) {
                if (!propShow.get(i).equalsIgnoreCase(requestedShowNames.get(i))) {
                    return false;
                }
            }
            return true;
        }
        List<String> propList = extractOrderedLinkListNamesFromFieldMap(field);
        if (!propList.isEmpty()) {
            if (propList.size() != requestedShowNames.size()) {
                return false;
            }
            for (int i = 0; i < propList.size(); i++) {
                if (!propList.get(i).equalsIgnoreCase(requestedShowNames.get(i))) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private List<String> extractOrderedLinkShowNamesFromFieldMap(Map<String, Object> field) {
        Object raw = getPropertyFieldValue(field, "fieldLinkShowFields");
        if (raw == null) {
            raw = field.get("fieldLinkShowFields");
        }
        if (raw instanceof List<?> list && !list.isEmpty()) {
            List<LinkFieldOrder> tmp = new ArrayList<>();
            int i = 0;
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                Map<String, Object> row = (Map<String, Object>) m;
                String name = normalizeText(getPropertyFieldValue(row, "fieldLinkShowField"));
                if (name == null || name.isBlank()) {
                    continue;
                }
                Object op = row.get("orderPos");
                int order;
                if (op instanceof Number n) {
                    order = n.intValue();
                } else {
                    try {
                        order = Integer.parseInt(String.valueOf(op).trim());
                    } catch (NumberFormatException e) {
                        order = i + 1;
                    }
                }
                if (order <= 0) {
                    order = i + 1;
                }
                tmp.add(new LinkFieldOrder(name, order));
                i++;
            }
            tmp.sort(Comparator.comparingInt(LinkFieldOrder::orderPos));
            return tmp.stream().map(LinkFieldOrder::name).toList();
        }
        String legacy = normalizeText(getPropertyFieldValue(field, "fieldLinkShowField"));
        if (legacy != null && !legacy.isBlank()) {
            return List.of(legacy);
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private List<String> extractOrderedLinkTooltipNamesFromFieldMap(Map<String, Object> field, List<String> showNames) {
        Object raw = getPropertyFieldValue(field, "fieldLinkShowTooltips");
        if (raw == null) {
            raw = field.get("fieldLinkShowTooltips");
        }
        if (raw instanceof List<?> list && !list.isEmpty()) {
            List<LinkFieldOrder> tmp = new ArrayList<>();
            int i = 0;
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                Map<String, Object> row = (Map<String, Object>) m;
                String name = normalizeText(getPropertyFieldValue(row, "fieldLinkShowTooltip"));
                if (name == null || name.isBlank()) {
                    continue;
                }
                Object op = getPropertyFieldValue(row, "orderPos");
                int order;
                if (op instanceof Number n) {
                    order = n.intValue();
                } else {
                    try {
                        order = Integer.parseInt(String.valueOf(op == null ? "" : op).trim());
                    } catch (NumberFormatException e) {
                        order = i + 1;
                    }
                }
                if (order <= 0) {
                    order = i + 1;
                }
                tmp.add(new LinkFieldOrder(name, order));
                i++;
            }
            tmp.sort(Comparator.comparingInt(LinkFieldOrder::orderPos).thenComparing(LinkFieldOrder::name, String.CASE_INSENSITIVE_ORDER));
            return tmp.stream().map(LinkFieldOrder::name).toList();
        }
        return showNames;
    }

    private List<Map<String, Object>> buildFieldLinkShowFieldRowsForMeta(List<String> orderedNames) {
        List<Map<String, Object>> out = new ArrayList<>();
        int p = 1;
        for (String n : orderedNames) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fieldLinkShowField", n);
            m.put("orderPos", p++);
            out.add(m);
        }
        return out;
    }

    private List<Map<String, Object>> buildFieldLinkTooltipRowsForMeta(List<String> orderedNames) {
        List<Map<String, Object>> out = new ArrayList<>();
        int p = 1;
        for (String n : orderedNames) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fieldLinkShowTooltip", n);
            m.put("orderPos", p++);
            out.add(m);
        }
        return out;
    }

    private List<Map<String, Object>> buildFieldLinkListRowsForMeta(List<String> orderedNames) {
        List<Map<String, Object>> out = new ArrayList<>();
        int p = 1;
        for (String n : orderedNames) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fieldLinkShowList", n);
            m.put("orderPos", p++);
            out.add(m);
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private List<String> extractOrderedLinkListNamesFromFieldMap(Map<String, Object> field) {
        Object raw = getPropertyFieldValue(field, "fieldLinkShowLists");
        if (raw == null) {
            raw = field.get("fieldLinkShowLists");
        }
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            return List.of();
        }
        List<LinkFieldOrder> tmp = new ArrayList<>();
        int i = 0;
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> m)) {
                continue;
            }
            Map<String, Object> row = (Map<String, Object>) m;
            String name = normalizeText(getPropertyFieldValue(row, "fieldLinkShowList"));
            if (name == null || name.isBlank()) {
                name = normalizeText(row.get("fieldLinkShowList"));
            }
            if (name == null || name.isBlank()) {
                i++;
                continue;
            }
            Object op = row.get("orderPos");
            int order;
            if (op instanceof Number n) {
                order = n.intValue();
            } else {
                try {
                    order = Integer.parseInt(String.valueOf(op).trim());
                } catch (NumberFormatException e) {
                    order = i + 1;
                }
            }
            if (order <= 0) {
                order = i + 1;
            }
            tmp.add(new LinkFieldOrder(name, order));
            i++;
        }
        tmp.sort(Comparator.comparingInt(LinkFieldOrder::orderPos));
        return tmp.stream().map(LinkFieldOrder::name).toList();
    }

    private boolean hasNonEmptyTooltipRows(Map<String, Object> field) {
        Object raw = getPropertyFieldValue(field, "fieldLinkShowTooltips");
        if (raw == null) {
            raw = field.get("fieldLinkShowTooltips");
        }
        return raw instanceof List<?> list && !list.isEmpty();
    }

    @SuppressWarnings("unchecked")
    private List<String> extractOrderedLinkShowNamesFromMeta(LinkedHashMap<String, Object> meta) {
        Object raw = meta.get("fieldLinkShowFields");
        if (raw instanceof List<?> list && !list.isEmpty()) {
            List<LinkFieldOrder> tmp = new ArrayList<>();
            int i = 0;
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                Map<String, Object> row = (Map<String, Object>) m;
                String name = normalizeText(row.get("fieldLinkShowField"));
                if (name == null || name.isBlank()) {
                    name = normalizeText(row.get("field_link_show_field"));
                }
                if (name == null || name.isBlank()) {
                    continue;
                }
                Object op = row.get("orderPos");
                int order = op instanceof Number n ? n.intValue() : (i + 1);
                tmp.add(new LinkFieldOrder(name, order));
                i++;
            }
            tmp.sort(Comparator.comparingInt(LinkFieldOrder::orderPos));
            return tmp.stream().map(LinkFieldOrder::name).toList();
        }
        String legacy = normalizeText(meta.get("fieldLinkShowField"));
        if (legacy != null && !legacy.isBlank()) {
            return List.of(legacy);
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private List<String> extractOrderedLinkTooltipNamesFromMeta(LinkedHashMap<String, Object> meta, List<String> showNames) {
        Object raw = meta.get("fieldLinkShowTooltips");
        if (raw instanceof List<?> list && !list.isEmpty()) {
            List<LinkFieldOrder> tmp = new ArrayList<>();
            int i = 0;
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                Map<String, Object> row = (Map<String, Object>) m;
                String name = normalizeText(getPropertyFieldValue(row, "fieldLinkShowTooltip"));
                if (name == null || name.isBlank()) {
                    continue;
                }
                Object op = getPropertyFieldValue(row, "orderPos");
                int order;
                if (op instanceof Number n) {
                    order = n.intValue();
                } else {
                    try {
                        order = Integer.parseInt(String.valueOf(op == null ? "" : op).trim());
                    } catch (NumberFormatException e) {
                        order = i + 1;
                    }
                }
                if (order <= 0) {
                    order = i + 1;
                }
                tmp.add(new LinkFieldOrder(name, order));
                i++;
            }
            tmp.sort(Comparator.comparingInt(LinkFieldOrder::orderPos).thenComparing(LinkFieldOrder::name, String.CASE_INSENSITIVE_ORDER));
            return tmp.stream().map(LinkFieldOrder::name).toList();
        }
        return showNames;
    }

    private static List<String> extractOrderedLinkShowNamesFromMetaStatic(LinkedHashMap<String, Object> meta) {
        Object raw = meta.get("fieldLinkShowFields");
        if (raw instanceof List<?> list && !list.isEmpty()) {
            List<LinkFieldOrder> tmp = new ArrayList<>();
            int i = 0;
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                Map<String, Object> row = (Map<String, Object>) m;
                String name = normalizeTextStatic(row.get("fieldLinkShowField"));
                if (name == null || name.isBlank()) {
                    continue;
                }
                Object op = row.get("orderPos");
                int order = op instanceof Number n ? n.intValue() : (i + 1);
                tmp.add(new LinkFieldOrder(name, order));
                i++;
            }
            tmp.sort(Comparator.comparingInt(LinkFieldOrder::orderPos));
            return tmp.stream().map(LinkFieldOrder::name).toList();
        }
        String legacy = normalizeTextStatic(meta.get("fieldLinkShowField"));
        if (legacy != null && !legacy.isBlank()) {
            return List.of(legacy);
        }
        return List.of();
    }

    /** Значение из объекта поля: camelCase или snake_case (field_name). */
    private Object getPropertyFieldValue(Map<String, Object> field, String camelKey) {
        if (field.containsKey(camelKey)) {
            return field.get(camelKey);
        }
        String snake = camelToSnake(camelKey);
        if (!snake.equals(camelKey) && field.containsKey(snake)) {
            return field.get(snake);
        }
        return null;
    }

    private boolean readFieldBooleanFlexible(Map<String, Object> field, String camelKey, boolean defaultValue) {
        Object raw = getPropertyFieldValue(field, camelKey);
        if (raw == null) {
            return defaultValue;
        }
        if (raw instanceof Boolean booleanValue) {
            return booleanValue;
        }
        String s = String.valueOf(raw).trim().toLowerCase(Locale.ROOT);
        if (s.isEmpty()) {
            return defaultValue;
        }
        return "true".equals(s) || "1".equals(s) || "да".equals(s);
    }

    private Map<String, Object> stripLegacyPropertyKeys(Map<String, Object> map) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<>(map);
        m.remove("tableName");
        m.remove("addRecords");
        m.remove("editRecords");
        m.remove("addRecors");
        m.remove("editRecors");
        return m;
    }

    private Map<String, Object> parsePropertiesOptional(Object raw) throws IllegalArgumentException {
        if (raw == null) {
            LinkedHashMap<String, Object> empty = new LinkedHashMap<>();
            empty.put("fields", List.of());
            empty.put("linkTables", List.of());
            empty.put("synonymKeyFields", List.of());
            return empty;
        }
        return parsePropertiesToMap(raw);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parsePropertiesToMap(Object raw) throws IllegalArgumentException {
        if (raw == null) {
            throw new IllegalArgumentException("properties обязателен");
        }
        if (raw instanceof Map<?, ?> map) {
            return new LinkedHashMap<>((Map<String, Object>) map);
        }
        String text = normalizeText(raw);
        if (text == null) {
            throw new IllegalArgumentException("properties обязателен");
        }
        try {
            Object parsed = objectMapper.readValue(text, new TypeReference<Map<String, Object>>() {});
            if (!(parsed instanceof Map<?, ?>)) {
                throw new IllegalArgumentException("properties должен быть JSON-объектом");
            }
            return new LinkedHashMap<>((Map<String, Object>) parsed);
        } catch (IOException exception) {
            throw new IllegalArgumentException("properties должен быть JSON-объектом");
        }
    }

    private boolean readBooleanFlag(Object raw, boolean defaultValue) {
        if (raw == null) {
            return defaultValue;
        }
        if (raw instanceof Boolean booleanValue) {
            return booleanValue;
        }
        String s = String.valueOf(raw).trim().toLowerCase(Locale.ROOT);
        if (s.isEmpty()) {
            return defaultValue;
        }
        return "true".equals(s) || "1".equals(s) || "да".equals(s);
    }

    private void appendIlikeTokens(
        List<String> where,
        MapSqlParameterSource params,
        String prefix,
        String columnExpr,
        Object rawValue
    ) {
        List<String> tokens = splitSearchTokens(rawValue);
        for (int index = 0; index < tokens.size(); index += 1) {
            String key = prefix + "Tok" + index;
            where.add(columnExpr + " ILIKE :" + key);
            params.addValue(key, "%" + tokens.get(index) + "%");
        }
    }

    private List<String> splitSearchTokens(Object value) {
        String text = normalizeText(value);
        if (text == null) {
            return List.of();
        }
        return java.util.Arrays.stream(text.split("\\s+"))
            .map(String::trim)
            .filter(token -> !token.isEmpty())
            .toList();
    }

    private String buildOrderBy(List<SortRule> sorts) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String baseExpr = SORT_SQL.get(sort.field());
            String sortExpr =
                TEXT_SORT_FIELDS.contains(sort.field()) ? baseExpr + " collate \"C\"" : baseExpr;
            chunks.add(sortExpr + " " + sort.direction() + " nulls last");
        }
        return String.join(", ", chunks);
    }

    private List<Map<String, String>> toSortMapsCamel(List<SortRule> sorts) {
        List<Map<String, String>> out = new ArrayList<>();
        for (SortRule sort : sorts) {
            out.add(mapOfString("field", snakeToCamel(sort.field()), "direction", sort.direction()));
        }
        return out;
    }

    private String snakeToCamel(String value) {
        if (value == null || value.isEmpty() || !value.contains("_")) {
            return value == null ? "" : value;
        }
        StringBuilder result = new StringBuilder();
        boolean uppercaseNext = false;
        for (int i = 0; i < value.length(); i += 1) {
            char ch = value.charAt(i);
            if (ch == '_') {
                uppercaseNext = true;
                continue;
            }
            if (uppercaseNext) {
                result.append(Character.toUpperCase(ch));
                uppercaseNext = false;
            } else {
                result.append(ch);
            }
        }
        return result.toString();
    }

    private SortParseResult parseSorts(Map<String, Object> body) {
        Object sortsRaw = body.get("sorts");
        List<SortRule> sorts = new ArrayList<>();

        if (sortsRaw != null) {
            if (!(sortsRaw instanceof List<?> sortsList)) {
                return new SortParseResult(null, "Параметр sorts должен быть массивом");
            }
            for (Object item : sortsList) {
                if (!(item instanceof Map<?, ?> sortMap)) {
                    return new SortParseResult(null, "Каждый элемент sorts должен быть объектом");
                }
                String field = normalizeSortField(sortMap.get("field"));
                String direction = normalizeSortDirection(sortMap.get("direction"));
                if (!SORT_FIELDS.contains(field)) {
                    return new SortParseResult(null, "Параметр sorts содержит недопустимое поле сортировки");
                }
                if (!ALLOWED_SORT_DIRECTIONS.contains(direction)) {
                    return new SortParseResult(null, "Параметр sorts содержит недопустимое направление сортировки");
                }
                sorts.add(new SortRule(field, direction));
            }
            return new SortParseResult(sorts, null);
        }

        // Нет sorts в теле — считаем «без явной сортировки»; в listPost подставится умолчание (code ASC).
        return new SortParseResult(new ArrayList<>(), null);
    }

    private String normalizeSortField(Object value) {
        return camelToSnake(String.valueOf(value == null ? "" : value).trim());
    }

    private String normalizeSortDirection(Object value) {
        return String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT);
    }

    private String camelToSnake(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < value.length(); i += 1) {
            char ch = value.charAt(i);
            if (Character.isUpperCase(ch)) {
                if (i > 0) {
                    result.append('_');
                }
                result.append(Character.toLowerCase(ch));
            } else {
                result.append(ch);
            }
        }
        return result.toString();
    }

    private boolean isUuid(String value) {
        return value != null
            && value.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
    }

    /**
     * Суффикс URL: {@code схема_таблица} в нижнем регистре (как в UI), например {@code public.product_groups} → {@code public_product_groups}.
     */
    private String deriveReferenceUrlFromTableName(String tableNameRaw) {
        String tableName = normalizeText(tableNameRaw);
        if (tableName == null) {
            return null;
        }
        String tn = tableName.trim();
        if (tn.isEmpty()) {
            return null;
        }
        String schema;
        String table;
        if (!tn.contains(".")) {
            schema = "public";
            table = tn;
        } else {
            int i = tn.lastIndexOf('.');
            schema = tn.substring(0, i).trim();
            table = tn.substring(i + 1).trim();
        }
        if (schema.isEmpty() || table.isEmpty()) {
            return null;
        }
        return schema.toLowerCase(Locale.ROOT) + "_" + table.toLowerCase(Locale.ROOT);
    }

    private String normalizeText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private Map<String, Object> normalizeRequestBody(Map<String, Object> rawBody) {
        return rawBody == null ? new LinkedHashMap<>() : new LinkedHashMap<>(rawBody);
    }

    private ParseResult parsePositiveInteger(Object rawValue, int defaultValue, String fieldName) {
        if (rawValue == null) {
            return new ParseResult(defaultValue, null);
        }
        if (rawValue instanceof Number number) {
            double d = number.doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d) || d != Math.floor(d) || d <= 0) {
                return new ParseResult(null, "Параметр " + fieldName + " должен быть целым числом > 0");
            }
            return new ParseResult((int) d, null);
        }
        String normalized = String.valueOf(rawValue).trim();
        if (normalized.isEmpty()) {
            return new ParseResult(defaultValue, null);
        }
        if (!normalized.matches("^\\d+$")) {
            return new ParseResult(null, "Параметр " + fieldName + " должен быть целым числом > 0");
        }
        int parsed = Integer.parseInt(normalized);
        if (parsed <= 0) {
            return new ParseResult(null, "Параметр " + fieldName + " должен быть целым числом > 0");
        }
        return new ParseResult(parsed, null);
    }

    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("ok", false, "error", message));
    }

    private ResponseEntity<Map<String, Object>> conflict(String message) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("ok", false, "error", message));
    }

    private Map<String, Object> mapOf(Object... values) {
        if (values == null || values.length == 0) {
            return new LinkedHashMap<>();
        }
        if (values.length % 2 != 0) {
            throw new IllegalArgumentException("mapOf requires an even number of arguments");
        }
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            String key = String.valueOf(values[index]);
            result.put(key, values[index + 1]);
        }
        return result;
    }

    private Map<String, String> mapOfString(String key1, String value1, String key2, String value2) {
        LinkedHashMap<String, String> result = new LinkedHashMap<>();
        result.put(key1, value1);
        result.put(key2, value2);
        return result;
    }

    private record ParseResult(Integer value, String error) {
    }

    private record SortRule(String field, String direction) {
    }

    private record SortParseResult(List<SortRule> sorts, String error) {
    }
}
