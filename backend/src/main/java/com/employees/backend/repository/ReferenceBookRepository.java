package com.employees.backend.repository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ReferenceBookRepository {

    /** Алиас основной таблицы в запросах данных справочника с WHERE (корреляция EXISTS по связям). */
    public static final String REFERENCE_BOOK_DATA_TABLE_ALIAS = "_rb";

    private static final Pattern FIELD_LINK_PLACEHOLDER = Pattern.compile("\\[([a-zA-Z_][a-zA-Z0-9_]*)\\]");

    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public ReferenceBookRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate) {
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    public record ColumnDbType(String udtName, String dataType) {
    }

    /**
     * Имя без точки — таблица в схеме public; с точкой — schema.table (например public.product_groups).
     */
    public boolean existsTableInPublicSchema(String tableName) {
        if (tableName == null || tableName.isBlank()) {
            return false;
        }
        SchemaTable st = parseSchemaQualifiedTable(tableName.trim());
        Boolean exists = namedParameterJdbcTemplate.queryForObject(
            """
            select exists (
              select 1
              from information_schema.tables t
              where t.table_schema = lower(:schema)
                and t.table_name = lower(:table)
            )
            """,
            new MapSqlParameterSource()
                .addValue("schema", st.schema())
                .addValue("table", st.table()),
            Boolean.class
        );
        return Boolean.TRUE.equals(exists);
    }

    public Optional<ColumnDbType> findColumnInPublicTable(String tableName, String columnName) {
        if (tableName == null
            || columnName == null
            || tableName.isBlank()
            || columnName.isBlank()) {
            return Optional.empty();
        }
        SchemaTable st = parseSchemaQualifiedTable(tableName.trim());
        List<Map<String, Object>> rows = namedParameterJdbcTemplate.queryForList(
            """
            select c.udt_name::text as udt_name, c.data_type::text as data_type
            from information_schema.columns c
            where c.table_schema = lower(:schema)
              and c.table_name = lower(:table)
              and c.column_name = lower(:columnName)
            limit 1
            """,
            new MapSqlParameterSource()
                .addValue("schema", st.schema())
                .addValue("table", st.table())
                .addValue("columnName", columnName.trim())
        );
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Object> row = rows.get(0);
        String udt = row.get("udt_name") == null ? "" : String.valueOf(row.get("udt_name"));
        String dt = row.get("data_type") == null ? "" : String.valueOf(row.get("data_type"));
        return Optional.of(new ColumnDbType(udt, dt));
    }

    /**
     * Есть ли у столбца в БД IDENTITY / SERIAL / DEFAULT (генерация на стороне PostgreSQL).
     */
    public boolean columnHasIdentityOrDefaultInDb(String qualifiedTableName, String columnNameLower) {
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || columnNameLower == null
            || columnNameLower.isBlank()) {
            return false;
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        List<Map<String, Object>> rows = namedParameterJdbcTemplate.queryForList(
            """
            select c.is_identity::text as is_identity,
                   c.column_default::text as column_default
            from information_schema.columns c
            where c.table_schema = lower(:schema)
              and c.table_name = lower(:table)
              and c.column_name = lower(:column)
            limit 1
            """,
            new MapSqlParameterSource()
                .addValue("schema", st.schema())
                .addValue("table", st.table())
                .addValue("column", columnNameLower.trim().toLowerCase(Locale.ROOT))
        );
        if (rows.isEmpty()) {
            return false;
        }
        Map<String, Object> row = rows.get(0);
        String ident = row.get("is_identity") == null ? "" : String.valueOf(row.get("is_identity")).trim();
        if ("YES".equalsIgnoreCase(ident)) {
            return true;
        }
        String def = row.get("column_default") == null ? null : String.valueOf(row.get("column_default")).trim();
        return def != null && !def.isEmpty();
    }

    /**
     * Следующее целое значение PK (max+1) под блокировкой транзакции; вызывать в той же транзакции, что и {@link #insertRow}.
     */
    public long allocateNextIntegerPrimaryKey(String qualifiedTableName, String idColumnLower) {
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || idColumnLower == null
            || idColumnLower.isBlank()) {
            throw new IllegalArgumentException("Таблица и столбец PK обязательны");
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String idCol = quoteIdentifier(idColumnLower.trim());
        String lockToken = st.schema() + "." + st.table();
        namedParameterJdbcTemplate.getJdbcTemplate().update(
            "select pg_advisory_xact_lock((hashtext(?))::bigint)",
            lockToken
        );
        Long next = namedParameterJdbcTemplate.getJdbcTemplate().queryForObject(
            "select coalesce(max(" + idCol + "), 0) + 1 from " + from,
            Long.class
        );
        return next == null ? 1L : next;
    }

    /** Чтобы в SQL не сравнивались uuid и varchar (ошибка operator does not exist). */
    private static Object jdbcParamForPgColumn(Object value, Optional<ColumnDbType> colType) {
        if (value == null || colType.isEmpty()) {
            return value;
        }
        String udt = colType.get().udtName();
        if (udt == null || udt.isBlank()) {
            return value;
        }
        if ("uuid".equalsIgnoreCase(udt.trim())) {
            if (value instanceof UUID) {
                return value;
            }
            String s = String.valueOf(value).trim();
            if (s.isEmpty()) {
                return null;
            }
            try {
                return UUID.fromString(s);
            } catch (IllegalArgumentException e) {
                return value;
            }
        }
        return value;
    }

    private static SchemaTable parseSchemaQualifiedTable(String normalized) {
        if (!normalized.contains(".")) {
            return new SchemaTable("public", normalized);
        }
        int i = normalized.lastIndexOf('.');
        return new SchemaTable(
                normalized.substring(0, i).trim(),
                normalized.substring(i + 1).trim());
    }

    private record SchemaTable(String schema, String table) {
    }

    /**
     * Все базовые таблицы (не представления), кроме системных схем; полное имя {@code schema.table}, по схеме и имени.
     */
    public List<String> listAllBaseTablesQualifiedNames() {
        return namedParameterJdbcTemplate.queryForList(
            """
            select table_schema || '.' || table_name as full_name
            from information_schema.tables
            where table_type = 'BASE TABLE'
              and table_schema not in ('pg_catalog', 'information_schema')
            order by lower(table_schema), lower(table_name)
            """,
            new MapSqlParameterSource(),
            String.class
        );
    }

    /** Имена столбцов таблицы (порядок ordinal_position). */
    public List<String> listColumnNamesForTable(String tableName) {
        if (tableName == null || tableName.isBlank()) {
            return List.of();
        }
        SchemaTable st = parseSchemaQualifiedTable(tableName.trim());
        return namedParameterJdbcTemplate.queryForList(
            """
            select c.column_name::text
            from information_schema.columns c
            where c.table_schema = lower(:schema)
              and c.table_name = lower(:table)
            order by c.ordinal_position
            """,
            new MapSqlParameterSource()
                .addValue("schema", st.schema())
                .addValue("table", st.table()),
            String.class
        );
    }

    public int countActive(String whereSql, MapSqlParameterSource params) {
        Integer value = namedParameterJdbcTemplate.queryForObject(
            """
            select count(*)::int
            from public.reference_books rb
            """ + whereSql,
            params,
            Integer.class
        );
        return value == null ? 0 : value;
    }

    public List<Map<String, Object>> listPage(String whereSql, String orderBySql, MapSqlParameterSource params) {
        // Явная склейка: фрагменты с """ рядом с "order by" давали неверный SQL (ошибка около "by").
        String sql =
            """
            select
              rb.id::text as id,
              rb.code as code,
              rb.name as name,
              rb.name_eng as name_eng,
              rb.procedure_code as procedure_code,
              rb.reference_url as reference_url,
              rb.table_name as table_name,
              rb.add_records as add_records,
              rb.edit_records as edit_records,
              rb.properties::text as properties,
              rb.rules as rules,
              rb.created_at as created_at,
              rb.updated_at as updated_at
            from public.reference_books rb
            """
            + whereSql
            + "\norder by "
            + orderBySql
            + "\nlimit :limit offset :offset";
        return namedParameterJdbcTemplate.queryForList(sql, params);
    }

    /**
     * Активная запись по {@code reference_url} (без учёта регистра и пробелов по краям).
     */
    public Map<String, Object> findActiveByReferenceUrl(String referenceUrl) {
        if (referenceUrl == null || referenceUrl.isBlank()) {
            return null;
        }
        String ru = referenceUrl.trim();
        List<Map<String, Object>> rows = namedParameterJdbcTemplate.queryForList(
            """
            select
              rb.id::text as id,
              rb.code as code,
              rb.name as name,
              rb.name_eng as name_eng,
              rb.procedure_code as procedure_code,
              rb.reference_url as reference_url,
              rb.table_name as table_name,
              rb.add_records as add_records,
              rb.edit_records as edit_records,
              rb.properties::text as properties,
              rb.rules as rules,
              rb.created_at as created_at,
              rb.updated_at as updated_at
            from public.reference_books rb
            where rb.deleted = false
              and lower(trim(rb.reference_url)) = lower(trim(:ru))
            limit 1
            """,
            new MapSqlParameterSource("ru", ru)
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Есть ли другая активная запись с тем же {@code reference_url}.
     */
    public boolean existsActiveByReferenceUrl(String referenceUrl, String excludeId) {
        if (referenceUrl == null || referenceUrl.isBlank()) {
            return false;
        }
        String ru = referenceUrl.trim();
        MapSqlParameterSource params = new MapSqlParameterSource().addValue("ru", ru);
        String excludeClause = "";
        if (excludeId != null && !excludeId.isBlank()) {
            excludeClause = " and id <> cast(:excludeId as uuid)";
            params.addValue("excludeId", excludeId.trim());
        }
        Integer count = namedParameterJdbcTemplate.queryForObject(
            """
            select count(*)::int
            from public.reference_books
            where deleted = false
              and lower(trim(reference_url)) = lower(trim(:ru))
            """
                + excludeClause,
            params,
            Integer.class
        );
        return count != null && count > 0;
    }

    public Map<String, Object> findActiveById(String id) {
        List<Map<String, Object>> rows = namedParameterJdbcTemplate.queryForList(
            """
            select
              rb.id::text as id,
              rb.code as code,
              rb.name as name,
              rb.name_eng as name_eng,
              rb.procedure_code as procedure_code,
              rb.reference_url as reference_url,
              rb.table_name as table_name,
              rb.add_records as add_records,
              rb.edit_records as edit_records,
              rb.properties::text as properties,
              rb.rules as rules,
              rb.created_at as created_at,
              rb.updated_at as updated_at
            from public.reference_books rb
            where rb.id = cast(:id as uuid)
              and rb.deleted = false
            """,
            new MapSqlParameterSource("id", id)
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Другая не удалённая запись с тем же целевым {@code table_name} (сравнение после trim, без учёта регистра).
     */
    public boolean existsActiveByTableName(String tableName, String excludeId) {
        if (tableName == null || tableName.isBlank()) {
            return false;
        }
        String tn = tableName.trim();
        MapSqlParameterSource params = new MapSqlParameterSource().addValue("tn", tn);
        String excludeClause = "";
        if (excludeId != null && !excludeId.isBlank()) {
            excludeClause = " and id <> cast(:excludeId as uuid)";
            params.addValue("excludeId", excludeId.trim());
        }
        Integer count = namedParameterJdbcTemplate.queryForObject(
            """
            select count(*)::int
            from public.reference_books
            where deleted = false
              and lower(trim(table_name)) = lower(trim(:tn))
            """
                + excludeClause,
            params,
            Integer.class
        );
        return count != null && count > 0;
    }

    public String insert(
        String code,
        String name,
        String procedureCode,
        String referenceUrl,
        String tableName,
        boolean addRecords,
        boolean editRecords,
        String propertiesJson,
        String rulesJson
    ) {
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("code", code)
            .addValue("name", name)
            .addValue("procedureCode", procedureCode)
            .addValue("referenceUrl", referenceUrl)
            .addValue("tableName", tableName)
            .addValue("addRecords", addRecords)
            .addValue("editRecords", editRecords)
            .addValue("propertiesJson", propertiesJson)
            .addValue("rulesJson", rulesJson);
        return namedParameterJdbcTemplate.queryForObject(
            """
            insert into public.reference_books (
              code, name, procedure_code, reference_url,
              table_name, add_records, edit_records, properties, rules
            )
            values (
              :code,
              :name,
              :procedureCode,
              :referenceUrl,
              :tableName,
              :addRecords,
              :editRecords,
              cast(:propertiesJson as json),
              cast(:rulesJson as jsonb)
            )
            returning id::text
            """,
            params,
            String.class
        );
    }

    public int updateMain(
        String id,
        String code,
        String name,
        String procedureCode,
        String referenceUrl,
        String tableName,
        boolean addRecords,
        boolean editRecords
    ) {
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("id", id)
            .addValue("code", code)
            .addValue("name", name)
            .addValue("procedureCode", procedureCode)
            .addValue("referenceUrl", referenceUrl)
            .addValue("tableName", tableName)
            .addValue("addRecords", addRecords)
            .addValue("editRecords", editRecords);
        return namedParameterJdbcTemplate.update(
            """
            update public.reference_books
            set code = :code,
                name = :name,
                procedure_code = :procedureCode,
                reference_url = :referenceUrl,
                table_name = :tableName,
                add_records = :addRecords,
                edit_records = :editRecords,
                updated_at = current_timestamp
            where id = cast(:id as uuid)
              and deleted = false
            """,
            params
        );
    }

    public int updatePropertiesOnly(String id, String propertiesJson) {
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("id", id)
            .addValue("propertiesJson", propertiesJson);
        return namedParameterJdbcTemplate.update(
            """
            update public.reference_books
            set properties = cast(:propertiesJson as json),
                updated_at = current_timestamp
            where id = cast(:id as uuid)
              and deleted = false
            """,
            params
        );
    }

    public int updateRulesOnly(String id, String rulesJson) {
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("id", id)
            .addValue("rulesJson", rulesJson);
        return namedParameterJdbcTemplate.update(
            """
            update public.reference_books
            set rules = cast(:rulesJson as jsonb),
                updated_at = current_timestamp
            where id = cast(:id as uuid)
              and deleted = false
            """,
            params
        );
    }

    public int deleteById(String id) {
        return namedParameterJdbcTemplate.update(
            """
            delete from public.reference_books
            where id = cast(:id as uuid)
            """,
            new MapSqlParameterSource("id", id)
        );
    }

    /** Количество строк в пользовательской таблице (только после проверки имени таблицы). */
    public long countAllRowsInTable(String qualifiedTableName) {
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        Long n = namedParameterJdbcTemplate.queryForObject(
            "select count(*)::bigint from " + from,
            new MapSqlParameterSource(),
            Long.class
        );
        return n == null ? 0L : n;
    }

    /**
     * Страница строк; {@code columnNames} — whitelist имён столбцов (уже проверены).
     * {@code orderByClause} — выражение после ORDER BY (только из доверенного построителя в сервисе).
     * Ключи в строках — в нижнем регистре, как в PostgreSQL.
     */
    public List<Map<String, Object>> selectPageFromTable(
        String qualifiedTableName,
        List<String> columnNames,
        String orderByClause,
        int limit,
        int sqlOffset
    ) {
        if (columnNames == null || columnNames.isEmpty()) {
            return List.of();
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        StringBuilder select = new StringBuilder("select ");
        for (int i = 0; i < columnNames.size(); i++) {
            if (i > 0) {
                select.append(", ");
            }
            select.append(quoteIdentifier(columnNames.get(i)));
        }
        String orderBy =
            orderByClause == null || orderByClause.isBlank()
                ? quoteIdentifier(columnNames.get(0)) + " asc nulls last"
                : orderByClause.trim();
        String sql = select + " from " + from + " order by " + orderBy + " limit :limit offset :offset";
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("limit", limit)
            .addValue("offset", sqlOffset);
        return namedParameterJdbcTemplate.queryForList(sql, params);
    }

    /** Количество строк с условием (whitelist имён столбцов только из сервиса). */
    public long countRowsFromTableWhere(String qualifiedTableName, String whereSql, MapSqlParameterSource params) {
        if (qualifiedTableName == null || qualifiedTableName.isBlank() || whereSql == null || whereSql.isBlank()) {
            return 0L;
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String sql =
            "select count(*)::bigint from "
                + from
                + " "
                + quoteIdentifier(REFERENCE_BOOK_DATA_TABLE_ALIAS)
                + " where "
                + whereSql.trim();
        Long n = namedParameterJdbcTemplate.queryForObject(sql, params, Long.class);
        return n == null ? 0L : n;
    }

    /**
     * Страница строк с WHERE; {@code params} не должен содержать limit/offset — они добавляются здесь.
     */
    public List<Map<String, Object>> selectPageFromTableWhere(
        String qualifiedTableName,
        List<String> columnNames,
        String whereSql,
        String orderByClause,
        int limit,
        int sqlOffset,
        MapSqlParameterSource filterParams
    ) {
        if (columnNames == null || columnNames.isEmpty()) {
            return List.of();
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String t = quoteIdentifier(REFERENCE_BOOK_DATA_TABLE_ALIAS);
        StringBuilder select = new StringBuilder("select ");
        for (int i = 0; i < columnNames.size(); i++) {
            if (i > 0) {
                select.append(", ");
            }
            select.append(t).append(".").append(quoteIdentifier(columnNames.get(i)));
        }
        String orderBy =
            orderByClause == null || orderByClause.isBlank()
                ? t + "." + quoteIdentifier(columnNames.get(0)) + " asc nulls last"
                : orderByClause.trim();
        MapSqlParameterSource params = copyParams(filterParams);
        params.addValue("limit", limit);
        params.addValue("offset", sqlOffset);
        String sql =
            select
                + " from "
                + from
                + " "
                + t
                + " where "
                + whereSql.trim()
                + " order by "
                + orderBy
                + " limit :limit offset :offset";
        return namedParameterJdbcTemplate.queryForList(sql, params);
    }

    private static MapSqlParameterSource copyParams(MapSqlParameterSource source) {
        if (source == null) {
            return new MapSqlParameterSource();
        }
        MapSqlParameterSource copy = new MapSqlParameterSource();
        for (String name : source.getParameterNames()) {
            copy.addValue(name, source.getValue(name));
        }
        return copy;
    }

    /** Подпись ячейки и отдельная строка для тултипа (основное + вспомогательное в скобках). */
    public record LinkComposedMaps(Map<String, Object> displayByKey, Map<String, Object> tooltipByKey) {
    }

    /**
     * Значения из связанной таблицы по ключу {@code linkFieldColumn}: склейка полей отображения и тултипа.
     * {@code tooltipFieldColumns} — пустой список означает «как для отображения».
     * Поля тултипа могут быть в любом числе (независимо от полей показа); склейка — {@link #composeLinkedAuxFormat(List)}.
     */
    public LinkComposedMaps mapLinkFieldToComposedValues(
        String qualifiedTableName,
        String linkFieldColumn,
        List<String> showFieldColumns,
        List<String> tooltipFieldColumns,
        Collection<?> distinctKeyValues
    ) {
        Map<String, Object> emptyDisp = Map.of();
        Map<String, Object> emptyTip = Map.of();
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || linkFieldColumn == null
            || linkFieldColumn.isBlank()
            || showFieldColumns == null
            || showFieldColumns.isEmpty()
            || distinctKeyValues == null
            || distinctKeyValues.isEmpty()) {
            return new LinkComposedMaps(emptyDisp, emptyTip);
        }
        List<String> showCols = showFieldColumns.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).toList();
        if (showCols.isEmpty()) {
            return new LinkComposedMaps(emptyDisp, emptyTip);
        }
        List<String> tipCols;
        if (tooltipFieldColumns == null || tooltipFieldColumns.isEmpty()) {
            tipCols = showCols;
        } else {
            List<String> tipFiltered =
                tooltipFieldColumns.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).toList();
            tipCols = tipFiltered.isEmpty() ? showCols : tipFiltered;
        }
        List<Object> keys = new ArrayList<>();
        for (Object o : distinctKeyValues) {
            if (o != null) {
                keys.add(o);
            }
        }
        if (keys.isEmpty()) {
            return new LinkComposedMaps(emptyDisp, emptyTip);
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String lf = quoteIdentifier(linkFieldColumn.trim());
        StringBuilder sql = new StringBuilder("select ").append(lf).append(" as link_key");
        for (int i = 0; i < showCols.size(); i++) {
            sql.append(", ").append(quoteIdentifier(showCols.get(i))).append(" as disp_").append(i);
        }
        for (int i = 0; i < tipCols.size(); i++) {
            sql.append(", ").append(quoteIdentifier(tipCols.get(i))).append(" as tip_").append(i);
        }
        sql.append(" from ").append(from).append(" where ").append(lf).append(" in (:keys)");
        List<Map<String, Object>> rows =
            namedParameterJdbcTemplate.queryForList(sql.toString(), new MapSqlParameterSource("keys", keys));
        Map<String, Object> displayByKey = new LinkedHashMap<>();
        Map<String, Object> tooltipByKey = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object k = row.get("link_key");
            if (k == null) {
                k = row.get("LINK_KEY");
            }
            if (k == null) {
                continue;
            }
            String keyStr = String.valueOf(k);
            List<Object> dispParts = new ArrayList<>();
            for (int i = 0; i < showCols.size(); i++) {
                String alias = "disp_" + i;
                Object v = row.get(alias);
                if (v == null) {
                    v = row.get(alias.toUpperCase());
                }
                dispParts.add(v);
            }
            List<Object> tipParts = new ArrayList<>();
            for (int i = 0; i < tipCols.size(); i++) {
                String alias = "tip_" + i;
                Object v = row.get(alias);
                if (v == null) {
                    v = row.get(alias.toUpperCase());
                }
                tipParts.add(v);
            }
            displayByKey.putIfAbsent(keyStr, composeLinkedAuxFormat(dispParts));
            tooltipByKey.putIfAbsent(keyStr, composeLinkedTooltipFormat(tipParts));
        }
        return new LinkComposedMaps(displayByKey, tooltipByKey);
    }

    /**
     * Тултип связи: значение первого столбца (в списке по orderPos) + в скобках остальные через запятую.
     * Не удаляет хвостовые пустые сегменты — иначе при пустом последнем поле пропадают все «хвостовые» подписи.
     */
    private static String composeLinkedTooltipFormat(List<Object> parts) {
        if (parts == null || parts.isEmpty()) {
            return "";
        }
        List<String> cleaned = new ArrayList<>(parts.size());
        for (Object p : parts) {
            cleaned.add(p == null ? "" : String.valueOf(p).trim());
        }
        if (cleaned.stream().allMatch(String::isBlank)) {
            return "";
        }
        String first = cleaned.get(0);
        if (cleaned.size() == 1) {
            return first;
        }
        StringBuilder rest = new StringBuilder();
        for (int i = 1; i < cleaned.size(); i++) {
            if (i > 1) {
                rest.append(", ");
            }
            rest.append(cleaned.get(i));
        }
        return first + " (" + rest + ")";
    }

    private static String composeLinkedAuxFormat(List<Object> parts) {
        if (parts == null || parts.isEmpty()) {
            return "";
        }
        List<String> cleaned = new ArrayList<>();
        for (Object p : parts) {
            if (p == null) {
                cleaned.add("");
            } else {
                cleaned.add(String.valueOf(p).trim());
            }
        }
        while (cleaned.size() > 1 && cleaned.get(cleaned.size() - 1).isEmpty()) {
            cleaned.remove(cleaned.size() - 1);
        }
        if (cleaned.isEmpty() || cleaned.stream().allMatch(String::isBlank)) {
            return "";
        }
        String first = cleaned.get(0);
        if (cleaned.size() == 1) {
            return first;
        }
        StringBuilder rest = new StringBuilder();
        for (int i = 1; i < cleaned.size(); i++) {
            if (i > 1) {
                rest.append(", ");
            }
            rest.append(cleaned.get(i));
        }
        return first + " (" + rest + ")";
    }

    /**
     * SQL-выражение (PostgreSQL) для строки отображения связи, как в {@link #composeLinkedAuxFormat(List)} — для ilike в фильтрах/поиске.
     *
     * @param tableAlias непустой — префикс столбцов (например {@code lt} в EXISTS по связанной таблице).
     */
    public static String buildPostgresLinkDisplayExpression(List<String> showColNames, String tableAlias) {
        if (showColNames == null || showColNames.isEmpty()) {
            return "''";
        }
        String p =
            tableAlias == null || tableAlias.isBlank()
                ? ""
                : quoteIdentifier(tableAlias.trim()) + ".";
        if (showColNames.size() == 1) {
            return "trim(cast(" + p + quoteIdentifier(showColNames.get(0)) + " as text))";
        }
        String first = "trim(cast(" + p + quoteIdentifier(showColNames.get(0)) + " as text))";
        StringBuilder rest = new StringBuilder();
        for (int i = 1; i < showColNames.size(); i++) {
            if (i > 1) {
                rest.append(" || ', ' || ");
            }
            rest.append("trim(cast(").append(p).append(quoteIdentifier(showColNames.get(i))).append(" as text))");
        }
        return "(" + first + " || ' (' || " + rest + " || ')')";
    }

    /** Без алиаса таблицы (основной запрос по одной таблице без префикса). */
    public static String buildPostgresLinkDisplayExpression(List<String> showColNames) {
        return buildPostgresLinkDisplayExpression(showColNames, null);
    }

    private static String quoteQualifiedTable(SchemaTable st) {
        return quoteIdentifier(st.schema()) + "." + quoteIdentifier(st.table());
    }

    private static String quoteIdentifier(String ident) {
        if (ident == null || ident.isBlank()) {
            throw new IllegalArgumentException("Пустой идентификатор");
        }
        String t = ident.trim();
        if (!t.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")) {
            throw new IllegalArgumentException("Недопустимый идентификатор: " + ident);
        }
        return "\"" + t.replace("\"", "\"\"") + "\"";
    }

    /**
     * Проверка фрагмента для {@code WHERE (...)}: синтаксис PostgreSQL и существование столбцов в таблице связи.
     * Плейсхолдеры {@code [имя_поля]} — столбцы таблицы справочника; при проверке заменяются на типизированный NULL.
     *
     * @param referenceTableName таблица справочника (колонка table_name); нужна, если во фрагменте есть {@code [...]}
     */
    public void validateFieldLinkWhereFragment(String qualifiedLinkTableName, String whereFragment, String referenceTableName) {
        if (whereFragment == null || whereFragment.isBlank()) {
            return;
        }
        String f = whereFragment.trim();
        validateFieldLinkWhereFragmentSafety(f);
        String forParse = substituteFieldLinkPlaceholdersForValidation(f, referenceTableName);
        SchemaTable st = parseSchemaQualifiedTable(qualifiedLinkTableName.trim());
        String from = quoteQualifiedTable(st);
        String sql = "SELECT 1 FROM " + from + " WHERE (" + forParse + ") LIMIT 0";
        try {
            namedParameterJdbcTemplate.queryForList(sql, new MapSqlParameterSource());
        } catch (DataAccessException e) {
            String msg = e.getMostSpecificCause() != null ? e.getMostSpecificCause().getMessage() : e.getMessage();
            throw new IllegalArgumentException("fieldLinkFiltr: " + (msg == null ? "ошибка SQL" : msg));
        }
    }

    /**
     * Подстановка значений полей текущей строки справочника в {@code fieldLinkFiltr}; именованные параметры {@code rbflt_0…}.
     */
    public String expandFieldLinkFiltrPlaceholdersForExecution(
        String fragment,
        String referenceTableName,
        Map<String, Object> referenceRowValues,
        MapSqlParameterSource params
    ) {
        if (fragment == null || fragment.isBlank()) {
            return "";
        }
        String f = fragment.trim();
        if (referenceTableName == null || referenceTableName.isBlank()) {
            if (FIELD_LINK_PLACEHOLDER.matcher(f).find()) {
                throw new IllegalArgumentException(
                    "fieldLinkFiltr: плейсхолдеры [имя_поля] требуют привязки справочника к таблице (table_name)"
                );
            }
            return f;
        }
        Matcher m = FIELD_LINK_PLACEHOLDER.matcher(f);
        if (!m.find()) {
            return f;
        }
        m.reset();
        Map<String, Object> vals = referenceRowValues != null ? referenceRowValues : Map.of();
        StringBuffer sb = new StringBuffer();
        int idx = 0;
        while (m.find()) {
            String colName = m.group(1);
            Optional<ColumnDbType> refCol = findColumnInPublicTable(referenceTableName, colName);
            if (refCol.isEmpty()) {
                throw new IllegalArgumentException(
                    "fieldLinkFiltr: в таблице справочника \""
                        + referenceTableName
                        + "\" нет столбца \""
                        + colName
                        + "\""
                );
            }
            Object raw = lookupReferenceRowValueCaseInsensitive(vals, colName);
            Object bound = jdbcParamForPgColumn(raw, refCol);
            String pname = "rbflt_" + idx;
            params.addValue(pname, bound);
            idx++;
            m.appendReplacement(sb, Matcher.quoteReplacement(":" + pname));
        }
        m.appendTail(sb);
        validateFieldLinkWhereFragmentSafety(sb.toString());
        return sb.toString();
    }

    private static Object lookupReferenceRowValueCaseInsensitive(Map<String, Object> vals, String columnName) {
        if (vals.containsKey(columnName)) {
            return vals.get(columnName);
        }
        String low = columnName.toLowerCase(Locale.ROOT);
        for (Map.Entry<String, Object> e : vals.entrySet()) {
            if (e.getKey() != null && e.getKey().toLowerCase(Locale.ROOT).equals(low)) {
                return e.getValue();
            }
        }
        return null;
    }

    private String substituteFieldLinkPlaceholdersForValidation(String fragment, String referenceTableName) {
        Matcher m = FIELD_LINK_PLACEHOLDER.matcher(fragment);
        if (!m.find()) {
            return fragment;
        }
        m.reset(); /* после find() курсор не в начале */
        if (referenceTableName == null || referenceTableName.isBlank()) {
            throw new IllegalArgumentException(
                "fieldLinkFiltr: укажите таблицу справочника (table_name), чтобы использовать плейсхолдеры [имя_поля]"
            );
        }
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String colName = m.group(1);
            Optional<ColumnDbType> refCol = findColumnInPublicTable(referenceTableName, colName);
            if (refCol.isEmpty()) {
                throw new IllegalArgumentException(
                    "fieldLinkFiltr: в таблице справочника \""
                        + referenceTableName
                        + "\" нет столбца \""
                        + colName
                        + "\""
                );
            }
            String lit = postgresTypedNullLiteralForLinkColumn(refCol.get());
            m.appendReplacement(sb, Matcher.quoteReplacement(lit));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String postgresTypedNullLiteralForLinkColumn(ColumnDbType colType) {
        if (colType == null || colType.udtName() == null || colType.udtName().isBlank()) {
            return "NULL";
        }
        String u = colType.udtName().trim().toLowerCase(Locale.ROOT);
        return switch (u) {
            case "uuid" -> "cast(NULL as uuid)";
            case "int2" -> "cast(NULL as smallint)";
            case "int4" -> "cast(NULL as integer)";
            case "int8" -> "cast(NULL as bigint)";
            case "float4" -> "cast(NULL as real)";
            case "float8" -> "cast(NULL as double precision)";
            case "numeric" -> "cast(NULL as numeric)";
            case "bool" -> "cast(NULL as boolean)";
            case "date" -> "cast(NULL as date)";
            case "timestamp" -> "cast(NULL as timestamp without time zone)";
            case "timestamptz" -> "cast(NULL as timestamptz)";
            default -> "cast(NULL as text)";
        };
    }

    private static void validateFieldLinkWhereFragmentSafety(String f) {
        if (f.contains(";")) {
            throw new IllegalArgumentException("fieldLinkFiltr: недопустим символ «;»");
        }
        if (f.contains("--") || f.contains("/*") || f.contains("*/")) {
            throw new IllegalArgumentException("fieldLinkFiltr: недопустимы комментарии SQL");
        }
        String lower = f.toLowerCase(Locale.ROOT);
        String[] banned = {
            "drop ", "delete ", "insert ", "update ", "truncate ", "alter ", "create ",
            "grant ", "revoke ", "execute ", "call ", "copy ", "into ", "set ", "reset "
        };
        for (String b : banned) {
            if (lower.contains(b)) {
                throw new IllegalArgumentException("fieldLinkFiltr: недопустимая конструкция");
            }
        }
    }

    /** Для проверки уникальности при вставке (значение не null). */
    public long countRowsWhereColumnEquals(String qualifiedTableName, String columnName, Object value) {
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || columnName == null
            || columnName.isBlank()) {
            return 0;
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String col = quoteIdentifier(columnName.trim());
        String sql = "select count(*)::bigint from " + from + " where " + col + " = :v";
        Object vBound = jdbcParamForPgColumn(value, findColumnInPublicTable(qualifiedTableName, columnName.trim()));
        Long n = namedParameterJdbcTemplate.queryForObject(
            sql,
            new MapSqlParameterSource("v", vBound),
            Long.class
        );
        return n == null ? 0L : n;
    }

    /** Существует ли строка в связанной таблице с таким значением поля связи. */
    public boolean existsLinkFieldValue(String qualifiedTableName, String linkFieldColumn, Object value) {
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || linkFieldColumn == null
            || linkFieldColumn.isBlank()
            || value == null) {
            return false;
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String lf = quoteIdentifier(linkFieldColumn.trim());
        String sql = "select exists(select 1 from " + from + " where " + lf + " = :v limit 1)";
        Object vBound = jdbcParamForPgColumn(value, findColumnInPublicTable(qualifiedTableName, linkFieldColumn.trim()));
        Boolean ok = namedParameterJdbcTemplate.queryForObject(
            sql,
            new MapSqlParameterSource("v", vBound),
            Boolean.class
        );
        return Boolean.TRUE.equals(ok);
    }

    /**
     * Пары (поле связи, поля отображения) из связанной таблицы; в результате {@code show_value} — склейка по
     * {@link #composeLinkedAuxFormat(List)}. Порядок — по первому полю показа, затем остальным, затем ключу связи.
     */
    public List<Map<String, Object>> listLinkFieldOptionsOrdered(
        String qualifiedTableName,
        String linkFieldColumn,
        List<String> showFieldColumns,
        int limit,
        int offset,
        String search,
        boolean applySearchFilter,
        String extraWhereFragment,
        MapSqlParameterSource baseParams
    ) {
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || linkFieldColumn == null
            || linkFieldColumn.isBlank()
            || showFieldColumns == null
            || showFieldColumns.isEmpty()) {
            return List.of();
        }
        List<String> showCols = showFieldColumns.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).toList();
        if (showCols.isEmpty()) {
            return List.of();
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safeOffset = Math.max(0, offset);
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String lf = quoteIdentifier(linkFieldColumn.trim());
        MapSqlParameterSource params =
            baseParams != null ? baseParams : new MapSqlParameterSource();
        StringBuilder inner = new StringBuilder();
        inner.append("select distinct ").append(lf).append(" as link_value");
        for (int i = 0; i < showCols.size(); i++) {
            inner.append(", ").append(quoteIdentifier(showCols.get(i))).append(" as disp_").append(i);
        }
        inner.append(" from ").append(from);
        List<String> whereParts = new ArrayList<>();
        String extra = extraWhereFragment == null ? null : extraWhereFragment.trim();
        if (extra != null && !extra.isEmpty()) {
            whereParts.add("(" + extra + ")");
        }
        String trimmedSearch = search == null ? null : search.trim();
        if (applySearchFilter && trimmedSearch != null && !trimmedSearch.isEmpty()) {
            String esc = escapeSqlLikePattern(trimmedSearch);
            params.addValue("search", "%" + esc + "%");
            StringBuilder sb = new StringBuilder("(");
            sb.append("cast(").append(lf).append(" as text) ilike :search escape '\\'");
            for (String col : showCols) {
                String qc = quoteIdentifier(col);
                sb.append(" or cast(").append(qc).append(" as text) ilike :search escape '\\'");
            }
            sb.append(" or ").append(buildPostgresLinkDisplayExpression(showCols)).append(" ilike :search escape '\\'");
            sb.append(")");
            whereParts.add(sb.toString());
        }
        if (!whereParts.isEmpty()) {
            inner.append(" where ");
            inner.append(String.join(" and ", whereParts));
        }
        StringBuilder orderBy = new StringBuilder();
        for (int i = 0; i < showCols.size(); i++) {
            if (i > 0) {
                orderBy.append(", ");
            }
            orderBy.append("disp_").append(i).append(" asc nulls last");
        }
        orderBy.append(", link_value asc nulls last");
        String sql =
            "select * from ("
                + inner
                + ") sub order by "
                + orderBy
                + " limit "
                + safeLimit
                + " offset "
                + safeOffset;
        List<Map<String, Object>> rawRows = namedParameterJdbcTemplate.queryForList(sql, params);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : rawRows) {
            Object lv = row.get("link_value");
            if (lv == null) {
                lv = row.get("LINK_VALUE");
            }
            List<Object> dispParts = new ArrayList<>();
            for (int i = 0; i < showCols.size(); i++) {
                String alias = "disp_" + i;
                Object v = row.get(alias);
                if (v == null) {
                    v = row.get(alias.toUpperCase());
                }
                dispParts.add(v);
            }
            String composed = composeLinkedAuxFormat(dispParts);
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("link_value", lv);
            one.put("show_value", composed);
            out.add(one);
        }
        return out;
    }

    private static String escapeSqlLikePattern(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /** Вставка строки: ключи {@code columnNameToValue} — имена столбцов в нижнем регистре (как в {@link #listColumnNamesForTable}). */
    public int insertRow(String qualifiedTableName, LinkedHashMap<String, Object> columnNameToValue) {
        if (qualifiedTableName == null || qualifiedTableName.isBlank() || columnNameToValue == null || columnNameToValue.isEmpty()) {
            throw new IllegalArgumentException("Нет данных для вставки");
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        List<Map.Entry<String, Object>> entries = new ArrayList<>(columnNameToValue.entrySet());
        StringBuilder cols = new StringBuilder();
        StringBuilder vals = new StringBuilder();
        MapSqlParameterSource params = new MapSqlParameterSource();
        for (int i = 0; i < entries.size(); i++) {
            Map.Entry<String, Object> e = entries.get(i);
            if (i > 0) {
                cols.append(", ");
                vals.append(", ");
            }
            cols.append(quoteIdentifier(e.getKey()));
            String pname = "p" + i;
            vals.append(":").append(pname);
            params.addValue(pname, e.getValue());
        }
        String sql = "insert into " + from + " (" + cols + ") values (" + vals + ")";
        return namedParameterJdbcTemplate.update(sql, params);
    }

    /** Обновление строки по первичному ключу; ключи в {@code columnLowerToValue} — имена столбцов в нижнем регистре. */
    public int updateRowByPk(
        String qualifiedTableName,
        String pkColumnLower,
        Object pkValue,
        LinkedHashMap<String, Object> columnLowerToValue
    ) {
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || pkColumnLower == null
            || pkColumnLower.isBlank()
            || pkValue == null
            || columnLowerToValue == null
            || columnLowerToValue.isEmpty()) {
            throw new IllegalArgumentException("Нет данных для обновления");
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String pkQuoted = quoteIdentifier(pkColumnLower.trim());
        List<Map.Entry<String, Object>> entries = new ArrayList<>(columnLowerToValue.entrySet());
        StringBuilder setClause = new StringBuilder();
        MapSqlParameterSource params = new MapSqlParameterSource();
        Object pkBound = jdbcParamForPgColumn(pkValue, findColumnInPublicTable(qualifiedTableName, pkColumnLower));
        params.addValue("pk", pkBound);
        for (int i = 0; i < entries.size(); i++) {
            Map.Entry<String, Object> e = entries.get(i);
            if (i > 0) {
                setClause.append(", ");
            }
            setClause.append(quoteIdentifier(e.getKey())).append(" = :p").append(i);
            Object setVal = jdbcParamForPgColumn(e.getValue(), findColumnInPublicTable(qualifiedTableName, e.getKey()));
            params.addValue("p" + i, setVal);
        }
        String sql = "update " + from + " set " + setClause + " where " + pkQuoted + " = :pk";
        return namedParameterJdbcTemplate.update(sql, params);
    }

    /** Для проверки уникальности при обновлении (исключая текущую строку). */
    public long countRowsWhereColumnEqualsExcludingPk(
        String qualifiedTableName,
        String columnName,
        Object value,
        String pkColumn,
        Object pkValue
    ) {
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || columnName == null
            || columnName.isBlank()
            || pkColumn == null
            || pkColumn.isBlank()
            || pkValue == null) {
            return 0;
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String col = quoteIdentifier(columnName.trim());
        String pkQ = quoteIdentifier(pkColumn.trim());
        String sql =
            "select count(*)::bigint from " + from + " where " + col + " = :v and " + pkQ + " <> :pk";
        MapSqlParameterSource params = new MapSqlParameterSource();
        params.addValue("v", jdbcParamForPgColumn(value, findColumnInPublicTable(qualifiedTableName, columnName.trim())));
        params.addValue("pk", jdbcParamForPgColumn(pkValue, findColumnInPublicTable(qualifiedTableName, pkColumn.trim())));
        Long n = namedParameterJdbcTemplate.queryForObject(sql, params, Long.class);
        return n == null ? 0L : n;
    }

    /**
     * Сколько строк с тем же набором значений по столбцам (сравнение через {@code IS NOT DISTINCT FROM} для NULL).
     */
    public long countRowsWhereColumnsTupleEquals(
        String qualifiedTableName,
        List<String> columnNamesLowerInOrder,
        List<Object> values
    ) {
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || columnNamesLowerInOrder == null
            || columnNamesLowerInOrder.isEmpty()
            || values == null
            || values.size() != columnNamesLowerInOrder.size()) {
            return 0;
        }
        for (String c : columnNamesLowerInOrder) {
            if (c == null || c.isBlank()) {
                return 0;
            }
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        StringBuilder where = new StringBuilder();
        MapSqlParameterSource params = new MapSqlParameterSource();
        for (int i = 0; i < columnNamesLowerInOrder.size(); i++) {
            String col = columnNamesLowerInOrder.get(i);
            if (i > 0) {
                where.append(" and ");
            }
            where.append(quoteIdentifier(col.trim())).append(" is not distinct from :v").append(i);
            Object v = values.get(i);
            params.addValue("v" + i, jdbcParamForPgColumn(v, findColumnInPublicTable(qualifiedTableName, col.trim())));
        }
        String sql = "select count(*)::bigint from " + from + " where " + where;
        Long n = namedParameterJdbcTemplate.queryForObject(sql, params, Long.class);
        return n == null ? 0L : n;
    }

    /** Как {@link #countRowsWhereColumnsTupleEquals}, но исключая строку с данным PK (для обновления). */
    public long countRowsWhereColumnsTupleEqualsExcludingPk(
        String qualifiedTableName,
        List<String> columnNamesLowerInOrder,
        List<Object> values,
        String pkColumn,
        Object pkValue
    ) {
        if (qualifiedTableName == null
            || qualifiedTableName.isBlank()
            || columnNamesLowerInOrder == null
            || columnNamesLowerInOrder.isEmpty()
            || values == null
            || values.size() != columnNamesLowerInOrder.size()
            || pkColumn == null
            || pkColumn.isBlank()
            || pkValue == null) {
            return 0;
        }
        for (String c : columnNamesLowerInOrder) {
            if (c == null || c.isBlank()) {
                return 0;
            }
        }
        SchemaTable st = parseSchemaQualifiedTable(qualifiedTableName.trim());
        String from = quoteQualifiedTable(st);
        String pkQ = quoteIdentifier(pkColumn.trim());
        StringBuilder where = new StringBuilder();
        MapSqlParameterSource params = new MapSqlParameterSource();
        for (int i = 0; i < columnNamesLowerInOrder.size(); i++) {
            String col = columnNamesLowerInOrder.get(i);
            if (i > 0) {
                where.append(" and ");
            }
            where.append(quoteIdentifier(col.trim())).append(" is not distinct from :v").append(i);
            Object v = values.get(i);
            params.addValue("v" + i, jdbcParamForPgColumn(v, findColumnInPublicTable(qualifiedTableName, col.trim())));
        }
        where.append(" and ").append(pkQ).append(" <> :pk");
        params.addValue("pk", jdbcParamForPgColumn(pkValue, findColumnInPublicTable(qualifiedTableName, pkColumn.trim())));
        String sql = "select count(*)::bigint from " + from + " where " + where;
        Long n = namedParameterJdbcTemplate.queryForObject(sql, params, Long.class);
        return n == null ? 0L : n;
    }
}
