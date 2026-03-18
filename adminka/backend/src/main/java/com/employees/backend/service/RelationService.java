package com.employees.backend.service;

import com.employees.backend.repository.RelationRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;

@Service
public class RelationService {
    private static final Set<String> ALLOWED_SORT_DIRECTIONS = Set.of("ASC", "DESC");
    private static final Set<String> RELATION_SORT_FIELDS = Set.of(
        "employee_name", "organ_name", "relation_name", "sales_organ_name", "product_group_name", "default_flag"
    );
    private static final Set<String> RELATION_TEXT_SORT_FIELDS = Set.of(
        "employee_name", "organ_name", "relation_name", "sales_organ_name", "product_group_name"
    );
    private static final Map<String, String> RELATION_SORT_SQL = Map.of(
        "employee_name", "coalesce(e.full_name, '')",
        "organ_name", "coalesce(ou.sh_name, '')",
        "relation_name", "coalesce(rt.name, '')",
        "sales_organ_name", "coalesce(sou.sh_name, '')",
        "product_group_name", "coalesce(pg.name, '')",
        "default_flag", "r.default_flag"
    );
    private static final Map<String, ColumnMeta> RELATION_EXPORT_COLUMNS = Map.ofEntries(
        Map.entry("employee_name", new ColumnMeta("ФИО сотрудника", "coalesce(e.full_name, '')")),
        Map.entry("organ_name", new ColumnMeta("Организация", "coalesce(ou.sh_name, '')")),
        Map.entry("relation_name", new ColumnMeta("Тип отношения", "coalesce(rt.name, '')")),
        Map.entry("default_flag", new ColumnMeta(
            "Основное отношение",
            "case when r.default_flag = true then 'ДА' else 'НЕТ' end"
        )),
        Map.entry("sales_organ_name", new ColumnMeta("Сбытовая организация", "coalesce(sou.sh_name, '')")),
        Map.entry("product_group_name", new ColumnMeta("Группа продуктов", "coalesce(pg.name, '')"))
    );
    private static final List<String> RELATION_EXPORT_DEFAULT_ORDER = List.of(
        "employee_name", "organ_name", "relation_name", "default_flag", "sales_organ_name", "product_group_name"
    );
    private static final Map<String, String> RELATION_FILTER_TITLES = Map.ofEntries(
        Map.entry("employee_name", "ФИО сотрудника"),
        Map.entry("organ_name", "Организация"),
        Map.entry("relation_name", "Тип отношения"),
        Map.entry("default_flag", "Основное отношение"),
        Map.entry("sales_organ_name", "Сбытовая организация"),
        Map.entry("product_group_name", "Группа продуктов")
    );
    private static final Map<String, String> RELATION_SORT_TITLES = Map.ofEntries(
        Map.entry("employee_name", "ФИО сотрудника"),
        Map.entry("organ_name", "Организация"),
        Map.entry("relation_name", "Тип отношения"),
        Map.entry("default_flag", "Основное отношение"),
        Map.entry("sales_organ_name", "Сбытовая организация"),
        Map.entry("product_group_name", "Группа продуктов")
    );

    private final RelationRepository relationRepository;

    public RelationService(RelationRepository relationRepository) {
        this.relationRepository = relationRepository;
    }

    public RelationRepository repository() {
        return relationRepository;
    }

    public ResponseEntity<Map<String, Object>> listRelations(
        String relationNameSnakeRaw,
        String relationNameCamelRaw
    ) {
        String relationName = normalizeText(firstDefined(relationNameSnakeRaw, relationNameCamelRaw));
        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("deleted = false");
        if (relationName != null) {
            for (String token : splitSearchTokens(relationName)) {
                where.add("name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String sql = """
            select
              id::text as id,
              name
            from party.relation_type
            where %s
            order by name collate "C"
            """.formatted(String.join(" and ", where));

        try {
            List<Map<String, Object>> items = relationRepository.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> listProductGroups(
        String productGroupNameSnakeRaw,
        String productGroupNameCamelRaw
    ) {
        String productGroupName = normalizeText(firstDefined(productGroupNameSnakeRaw, productGroupNameCamelRaw));
        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("deleted = false");
        if (productGroupName != null) {
            for (String token : splitSearchTokens(productGroupName)) {
                where.add("name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String sql = """
            select
              id::text as id,
              name
            from nsi.product_groups
            where %s
            order by name collate "C"
            """.formatted(String.join(" and ", where));

        try {
            List<Map<String, Object>> items = relationRepository.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> relationsPost(
        String employeeId,
        Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        String normalizedEmployeeId = normalizeText(employeeId);
        if (normalizedEmployeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        if (!isUuid(normalizedEmployeeId)) {
            return badRequest("Параметр employeeId должен быть UUID");
        }

        SortParseResult sortsResult = parseSorts(body, RELATION_SORT_FIELDS, "organName");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("organ_name", "ASC"))
            : sortsResult.sorts();

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("r.deleted = false");
        where.add("r.employee_id = ?::uuid");
        params.add(normalizedEmployeeId);

        for (Map.Entry<String, String> filter : List.of(
            Map.entry("organName", "organ_name"),
            Map.entry("relationName", "relation_name"),
            Map.entry("salesOrganName", "sales_organ_name"),
            Map.entry("productGroupName", "product_group_name")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value == null) {
                continue;
            }
            for (String token : splitSearchTokens(value)) {
                switch (filter.getValue()) {
                    case "organ_name" -> where.add("ou.sh_name ILIKE ?");
                    case "relation_name" -> where.add("rt.name ILIKE ?");
                    case "sales_organ_name" -> where.add("sou.sh_name ILIKE ?");
                    case "product_group_name" -> where.add("pg.name ILIKE ?");
                    default -> {
                    }
                }
                params.add("%" + token + "%");
            }
        }

        String defaultFlagRaw = normalizeText(body.get("defaultFlag"));
        if (defaultFlagRaw != null) {
            String normalized = defaultFlagRaw.toUpperCase(Locale.ROOT);
            if (!"ВСЕ".equals(normalized)) {
                if ("ДА".equals(normalized) || "TRUE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(true);
                } else if ("НЕТ".equals(normalized) || "FALSE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(false);
                } else {
                    return badRequest("Параметр defaultFlag должен быть ДА, НЕТ или Все");
                }
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildRelationOrderBy(sorts);
        String sql = """
            select
              r.id::text as "relationId",
              ou.sh_name as "organName",
              ou.sap_id as "organSapId",
              ou.inn as "organInn",
              ou.kpp as "organKpp",
              ou.ogrn as "organOgrn",
              ao.full_address as "organFullAddress",
              r.organ_unit_id::text as "organUnitId",
              rt.name as "relationName",
              r.relation_type_id::text as "relationTypeId",
              sou.sh_name as "salesOrganName",
              r.sales_organization_id::text as "salesOrganUnitId",
              pg.name as "productGroupName",
              r.product_groups_id::text as "productGroupId",
              r.default_flag as "defaultFlag"
            from party.relation r
            join party.organ_unit ou on ou.id = r.organ_unit_id and ou.deleted = false
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = ou.id
              order by a.id
              limit 1
            ) ao on true
            left join party.relation_type rt on rt.id = r.relation_type_id and rt.deleted = false
            left join party.organ_unit sou on sou.id = r.sales_organization_id and sou.deleted = false
            left join nsi.product_groups pg on pg.id = r.product_groups_id and pg.deleted = false
            %s
            order by %s
            """.formatted(whereSql, orderBy);

        try {
            List<Map<String, Object>> items = relationRepository.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size(),
                "totalCount", items.size(),
                "sorts", toSortMaps(sorts)
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> relationsPostAll(
        Map<String, Object> rawBody
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        SortParseResult sortsResult = parseSorts(body, RELATION_SORT_FIELDS, "organ_name");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("organ_name", "ASC"))
            : sortsResult.sorts();

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("r.deleted = false");

        String organName = normalizeText(body.get("organName"));
        String relationName = normalizeText(body.get("relationName"));
        String salesOrganName = normalizeText(body.get("salesOrganName"));
        String productGroupName = normalizeText(body.get("productGroupName"));
        String employeeName = normalizeText(body.get("employeeName"));

        if (organName != null) {
            for (String token : splitSearchTokens(organName)) {
                where.add("ou.sh_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (relationName != null) {
            for (String token : splitSearchTokens(relationName)) {
                where.add("rt.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (salesOrganName != null) {
            for (String token : splitSearchTokens(salesOrganName)) {
                where.add("sou.sh_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (productGroupName != null) {
            for (String token : splitSearchTokens(productGroupName)) {
                where.add("pg.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (employeeName != null) {
            for (String token : splitSearchTokens(employeeName)) {
                where.add("e.full_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String defaultFlagRaw = normalizeText(body.get("defaultFlag"));
        if (defaultFlagRaw != null) {
            String normalized = defaultFlagRaw.toUpperCase(Locale.ROOT);
            if (!"ВСЕ".equals(normalized)) {
                if ("ДА".equals(normalized) || "TRUE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(true);
                } else if ("НЕТ".equals(normalized) || "FALSE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(false);
                } else {
                    return badRequest("Параметр defaultFlag должен быть ДА, НЕТ или Все");
                }
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildRelationOrderBy(sorts);
        String sql = """
            with latest_address as (
              select distinct on (a.organ_unit_id)
                a.organ_unit_id,
                a.full_address
              from party.address a
              where a.deleted = false
              order by a.organ_unit_id, a.updated_at desc nulls last, a.created_at desc nulls last, a.id
            )
            select
              r.id::text as "relationId",
              e.id::text as "employeeId",
              e.full_name as "employeeName",
              ou.sh_name as "organName",
              ou.sap_id as "organSapId",
              ou.inn as "organInn",
              ou.kpp as "organKpp",
              ou.ogrn as "organOgrn",
              addr.full_address as "organFullAddress",
              r.organ_unit_id::text as "organUnitId",
              rt.name as "relationName",
              r.relation_type_id::text as "relationTypeId",
              sou.sh_name as "salesOrganName",
              r.sales_organization_id::text as "salesOrganUnitId",
              pg.name as "productGroupName",
              r.product_groups_id::text as "productGroupId",
              r.default_flag as "defaultFlag"
            from party.relation r
            join party.employee e on e.id = r.employee_id and e.deleted = false
            join party.organ_unit ou on ou.id = r.organ_unit_id and ou.deleted = false
            left join latest_address addr on addr.organ_unit_id = ou.id
            left join party.relation_type rt on rt.id = r.relation_type_id and rt.deleted = false
            left join party.organ_unit sou on sou.id = r.sales_organization_id and sou.deleted = false
            left join nsi.product_groups pg on pg.id = r.product_groups_id and pg.deleted = false
            %s
            order by %s
            """.formatted(whereSql, orderBy);

        try {
            List<Map<String, Object>> items = relationRepository.queryForList(sql, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size(),
                "totalCount", items.size(),
                "sorts", toSortMapsCamel(sorts)
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> relationCreate(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        String employeeId = normalizeText(body.get("employeeId"));
        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        String organUnitId = normalizeText(body.get("organUnitId"));
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        String relationTypeId = normalizeText(body.get("relationTypeId"));
        if (relationTypeId == null) {
            return badRequest("Параметр relationTypeId обязателен");
        }
        String salesOrganizationId = normalizeText(body.get("salesOrganizationId"));
        String productGroupsId = normalizeText(body.get("productGroupsId"));
        if (!isUuid(employeeId)) {
            return badRequest("Параметр employeeId должен быть UUID");
        }
        if (!isUuid(organUnitId)) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        if (!isUuid(relationTypeId)) {
            return badRequest("Параметр relationTypeId должен быть UUID");
        }
        if (salesOrganizationId != null && !isUuid(salesOrganizationId)) {
            return badRequest("Параметр salesOrganizationId должен быть UUID");
        }
        if (productGroupsId != null && !isUuid(productGroupsId)) {
            return badRequest("Параметр productGroupsId должен быть UUID");
        }

        boolean defaultFlag;
        Object defaultFlagRaw = body.get("defaultFlag");
        if (defaultFlagRaw instanceof Boolean flag) {
            defaultFlag = flag;
        } else {
            defaultFlag = "TRUE".equalsIgnoreCase(String.valueOf(defaultFlagRaw));
        }

        try {
            Integer duplicateCount = relationRepository.queryForObject(
                """
                select count(*)::int
                from party.relation r
                where r.deleted = false
                  and r.employee_id = ?::uuid
                  and r.organ_unit_id = ?::uuid
                  and r.relation_type_id = ?::uuid
                  and r.sales_organization_id is not distinct from ?::uuid
                  and r.product_groups_id is not distinct from ?::uuid
                """,
                Integer.class,
                employeeId,
                organUnitId,
                relationTypeId,
                salesOrganizationId,
                productGroupsId
            );
            if (duplicateCount != null && duplicateCount > 0) {
                return badRequest("Связь с указанным сочетанием уже существует");
            }

            String relationId = relationRepository.queryForObject(
                """
                insert into party.relation (
                  employee_id,
                  organ_unit_id,
                  relation_type_id,
                  sales_organization_id,
                  default_flag,
                  product_groups_id
                )
                values (?::uuid, ?::uuid, ?::uuid, ?::uuid, ?, ?::uuid)
                returning id::text
                """,
                String.class,
                employeeId,
                organUnitId,
                relationTypeId,
                salesOrganizationId,
                defaultFlag,
                productGroupsId
            );

            Map<String, Object> item = loadRelationItem(relationId);

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> relationUpdate(
        String relationId,
        Map<String, Object> rawBody
    ) {
        String normalizedRelationId = normalizeText(relationId);
        if (normalizedRelationId == null) {
            return badRequest("Параметр relationId обязателен");
        }
        if (!isUuid(normalizedRelationId)) {
            return badRequest("Параметр relationId должен быть UUID");
        }

        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        String employeeId = normalizeText(body.get("employeeId"));
        if (employeeId == null) {
            return badRequest("Параметр employeeId обязателен");
        }
        String organUnitId = normalizeText(body.get("organUnitId"));
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        String relationTypeId = normalizeText(body.get("relationTypeId"));
        if (relationTypeId == null) {
            return badRequest("Параметр relationTypeId обязателен");
        }
        String salesOrganizationId = normalizeText(body.get("salesOrganizationId"));
        String productGroupsId = normalizeText(body.get("productGroupsId"));
        if (!isUuid(employeeId)) {
            return badRequest("Параметр employeeId должен быть UUID");
        }
        if (!isUuid(organUnitId)) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        if (!isUuid(relationTypeId)) {
            return badRequest("Параметр relationTypeId должен быть UUID");
        }
        if (salesOrganizationId != null && !isUuid(salesOrganizationId)) {
            return badRequest("Параметр salesOrganizationId должен быть UUID");
        }
        if (productGroupsId != null && !isUuid(productGroupsId)) {
            return badRequest("Параметр productGroupsId должен быть UUID");
        }

        boolean defaultFlag;
        Object defaultFlagRaw = body.get("defaultFlag");
        if (defaultFlagRaw instanceof Boolean flag) {
            defaultFlag = flag;
        } else {
            defaultFlag = "TRUE".equalsIgnoreCase(String.valueOf(defaultFlagRaw));
        }

        try {
            Integer duplicateCount = relationRepository.queryForObject(
                """
                select count(*)::int
                from party.relation r
                where r.deleted = false
                  and r.employee_id = ?::uuid
                  and r.organ_unit_id = ?::uuid
                  and r.relation_type_id = ?::uuid
                  and r.sales_organization_id is not distinct from ?::uuid
                  and r.product_groups_id is not distinct from ?::uuid
                  and r.id <> ?::uuid
                """,
                Integer.class,
                employeeId,
                organUnitId,
                relationTypeId,
                salesOrganizationId,
                productGroupsId,
                normalizedRelationId
            );
            if (duplicateCount != null && duplicateCount > 0) {
                return badRequest("Связь с указанным сочетанием уже существует");
            }

            int updatedCount = relationRepository.update(
                """
                update party.relation
                set
                  employee_id = ?::uuid,
                  organ_unit_id = ?::uuid,
                  relation_type_id = ?::uuid,
                  sales_organization_id = ?::uuid,
                  default_flag = ?,
                  product_groups_id = ?::uuid
                where id = ?::uuid
                """,
                employeeId,
                organUnitId,
                relationTypeId,
                salesOrganizationId,
                defaultFlag,
                productGroupsId,
                normalizedRelationId
            );
            if (updatedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Связь не найдена"
                ));
            }

            Map<String, Object> item = loadRelationItem(normalizedRelationId);
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", item
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> relationDelete(String relationId) {
        String normalizedRelationId = normalizeText(relationId);
        if (normalizedRelationId == null) {
            return badRequest("Параметр relationId обязателен");
        }
        if (!isUuid(normalizedRelationId)) {
            return badRequest("Параметр relationId должен быть UUID");
        }

        try {
            int deletedCount = relationRepository.update(
                "delete from party.relation where id = ?::uuid",
                normalizedRelationId
            );
            if (deletedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Связь не найдена"
                ));
            }

            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deleted_count", deletedCount
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка удаления");
        }
    }

    public ResponseEntity<?> relationsExport(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts", "columns"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        ColumnsParseResult columnsResult = normalizeExportColumns(
            body.get("columns"),
            RELATION_EXPORT_COLUMNS,
            RELATION_EXPORT_DEFAULT_ORDER
        );
        if (columnsResult.error() != null) {
            return badRequest(columnsResult.error());
        }

        SortParseResult sortsResult = parseSorts(body, RELATION_SORT_FIELDS, "employee_name");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("employee_name", "ASC"))
            : sortsResult.sorts();

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("r.deleted = false");
        where.add("e.deleted = false");

        String organName = normalizeText(body.get("organName"));
        String relationName = normalizeText(body.get("relationName"));
        String salesOrganName = normalizeText(body.get("salesOrganName"));
        String productGroupName = normalizeText(body.get("productGroupName"));
        String employeeName = normalizeText(body.get("employeeName"));

        if (organName != null) {
            for (String token : splitSearchTokens(organName)) {
                where.add("ou.sh_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (relationName != null) {
            for (String token : splitSearchTokens(relationName)) {
                where.add("rt.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (salesOrganName != null) {
            for (String token : splitSearchTokens(salesOrganName)) {
                where.add("sou.sh_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (productGroupName != null) {
            for (String token : splitSearchTokens(productGroupName)) {
                where.add("pg.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        if (employeeName != null) {
            for (String token : splitSearchTokens(employeeName)) {
                where.add("e.full_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String defaultFlagRaw = normalizeText(body.get("defaultFlag"));
        if (defaultFlagRaw != null) {
            String normalized = defaultFlagRaw.toUpperCase(Locale.ROOT);
            if (!"ВСЕ".equals(normalized)) {
                if ("ДА".equals(normalized) || "TRUE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(true);
                } else if ("НЕТ".equals(normalized) || "FALSE".equals(normalized)) {
                    where.add("r.default_flag = ?");
                    params.add(false);
                } else {
                    return badRequest("Параметр defaultFlag должен быть ДА, НЕТ или Все");
                }
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildRelationOrderBy(sorts);
        String selectSql = buildSelectSql(columnsResult.columns());
        String sql = """
            select
              %s
            from party.relation r
            join party.employee e on e.id = r.employee_id
            join party.organ_unit ou on ou.id = r.organ_unit_id and ou.deleted = false
            left join party.relation_type rt on rt.id = r.relation_type_id and rt.deleted = false
            left join party.organ_unit sou on sou.id = r.sales_organization_id and sou.deleted = false
            left join nsi.product_groups pg on pg.id = r.product_groups_id and pg.deleted = false
            %s
            order by %s
            """.formatted(selectSql, whereSql, orderBy);

        try {
            LinkedHashMap<String, String> reportFilters = collectRelationReportFilters(body, sorts);
            List<Map<String, Object>> rows = relationRepository.queryForList(sql, params.toArray());
            byte[] excel = buildExcelFromRowsWithFilters(
                "Relations",
                columnsResult.columns(),
                rows,
                reportFilters
            );
            String fileName = createExportFileName("relations-export");
            return excelResponse(excel, fileName);
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка выгрузки");
        }
    }

    private Map<String, Object> loadRelationItem(String relationId) {
        return relationRepository.queryForMap(
            """
            select
              r.id::text as "relationId",
              ou.sh_name as "organName",
              ou.sap_id as "organSapId",
              ou.inn as "organInn",
              ou.kpp as "organKpp",
              ou.ogrn as "organOgrn",
              ao.full_address as "organFullAddress",
              r.organ_unit_id::text as "organUnitId",
              rt.name as "relationName",
              r.relation_type_id::text as "relationTypeId",
              sou.sh_name as "salesOrganName",
              r.sales_organization_id::text as "salesOrganUnitId",
              pg.name as "productGroupName",
              r.product_groups_id::text as "productGroupId",
              r.default_flag as "defaultFlag"
            from party.relation r
            join party.organ_unit ou on ou.id = r.organ_unit_id and ou.deleted = false
            left join lateral (
              select a.full_address
              from party.address a
              where a.organ_unit_id = ou.id
              order by a.id
              limit 1
            ) ao on true
            left join party.relation_type rt on rt.id = r.relation_type_id and rt.deleted = false
            left join party.organ_unit sou on sou.id = r.sales_organization_id and sou.deleted = false
            left join nsi.product_groups pg on pg.id = r.product_groups_id and pg.deleted = false
            where r.id = ?::uuid
            limit 1
            """,
            relationId
        );
    }

    private String firstDefined(String primary, String fallback) {
        if (primary != null) {
            return primary;
        }
        return fallback;
    }

    private Map<String, Object> normalizeRequestBody(Map<String, Object> rawBody) {
        Map<String, Object> body = rawBody == null ? Map.of() : rawBody;
        if (body.isEmpty()) {
            return body;
        }
        LinkedHashMap<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : body.entrySet()) {
            String key = entry.getKey();
            Object value = normalizeRequestValue(entry.getValue());
            normalized.put(key, value);
        }
        return normalized;
    }

    private Object normalizeRequestValue(Object value) {
        if (value instanceof Map<?, ?> mapValue) {
            LinkedHashMap<String, Object> normalized = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : mapValue.entrySet()) {
                String key = String.valueOf(entry.getKey());
                Object nestedValue = normalizeRequestValue(entry.getValue());
                normalized.put(key, nestedValue);
            }
            return normalized;
        }
        if (value instanceof List<?> listValue) {
            List<Object> normalized = new ArrayList<>(listValue.size());
            for (Object listItem : listValue) {
                normalized.add(normalizeRequestValue(listItem));
            }
            return normalized;
        }
        return value;
    }

    private String normalizeText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private List<String> splitSearchTokens(Object value) {
        String text = normalizeText(value);
        if (text == null) {
            return List.of();
        }
        return Arrays.stream(text.split("\\s+"))
            .map(String::trim)
            .filter(token -> !token.isEmpty())
            .toList();
    }

    private String hasArrayValue(Map<String, Object> body, Set<String> allowedArrayKeys) {
        for (Map.Entry<String, Object> entry : body.entrySet()) {
            if (entry.getValue() instanceof List<?> && !allowedArrayKeys.contains(entry.getKey())) {
                return entry.getKey();
            }
        }
        return null;
    }

    private SortParseResult parseSorts(Map<String, Object> body, Set<String> allowedFields, String defaultField) {
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
                if (!allowedFields.contains(field)) {
                    return new SortParseResult(null, "Параметр sorts содержит недопустимое поле сортировки");
                }
                if (!ALLOWED_SORT_DIRECTIONS.contains(direction)) {
                    return new SortParseResult(null, "Параметр sorts содержит недопустимое направление сортировки");
                }
                sorts.add(new SortRule(field, direction));
            }
            return new SortParseResult(sorts, null);
        }

        String sortDirection = normalizeSortDirection(body.getOrDefault("sortDirection", "ASC"));
        if (!ALLOWED_SORT_DIRECTIONS.contains(sortDirection)) {
            return new SortParseResult(null, "Параметр sortDirection должен быть ASC или DESC");
        }
        String sortField = normalizeSortField(body.getOrDefault("sortField", defaultField));
        if (!allowedFields.contains(sortField)) {
            return new SortParseResult(null, "Параметр sortField содержит недопустимое поле сортировки");
        }
        sorts.add(new SortRule(sortField, sortDirection));
        return new SortParseResult(sorts, null);
    }

    private String normalizeSortField(Object value) {
        return camelToSnake(String.valueOf(value == null ? "" : value).trim());
    }

    private String normalizeSortDirection(Object value) {
        return String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT);
    }

    private String buildRelationOrderBy(List<SortRule> sorts) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String baseExpr = RELATION_SORT_SQL.get(sort.field());
            String sortExpr = RELATION_TEXT_SORT_FIELDS.contains(sort.field()) ? baseExpr + " collate \"C\"" : baseExpr;
            chunks.add(sortExpr + " " + sort.direction() + " nulls last");
        }
        return String.join(", ", chunks);
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
        return value != null && value.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
    }

    private List<Map<String, String>> toSortMaps(List<SortRule> sorts) {
        List<Map<String, String>> out = new ArrayList<>();
        for (SortRule sort : sorts) {
            out.add(mapOfString("field", sort.field(), "direction", sort.direction()));
        }
        return out;
    }

    private List<Map<String, String>> toSortMapsCamel(List<SortRule> sorts) {
        List<Map<String, String>> out = new ArrayList<>();
        for (SortRule sort : sorts) {
            out.add(mapOfString("field", snakeToCamel(sort.field()), "direction", sort.direction()));
        }
        return out;
    }

    private ColumnsParseResult normalizeExportColumns(Object rawColumns, Map<String, ColumnMeta> registry, List<String> defaultOrder) {
        if (rawColumns == null) {
            List<ExportColumn> defaults = new ArrayList<>();
            for (String key : defaultOrder) {
                ColumnMeta meta = registry.get(key);
                defaults.add(new ExportColumn(key, meta.title(), meta.sql()));
            }
            return new ColumnsParseResult(defaults, null);
        }
        if (!(rawColumns instanceof List<?> list)) {
            return new ColumnsParseResult(null, "Параметр columns должен быть массивом");
        }

        List<ExportColumn> result = new ArrayList<>();
        Set<String> seen = new java.util.LinkedHashSet<>();
        for (Object item : list) {
            String key;
            String titleOverride = null;
            if (item instanceof Map<?, ?> mapItem) {
                key = normalizeSortField(mapItem.get("key"));
                titleOverride = normalizeText(mapItem.get("title"));
            } else {
                key = normalizeSortField(item);
            }
            if (key.isEmpty()) {
                continue;
            }
            ColumnMeta meta = registry.get(key);
            if (meta == null) {
                return new ColumnsParseResult(null, "Параметр columns содержит недопустимую колонку: " + key);
            }
            if (seen.add(key)) {
                result.add(new ExportColumn(
                    key,
                    titleOverride == null ? meta.title() : titleOverride,
                    meta.sql()
                ));
            }
        }
        if (result.isEmpty()) {
            return new ColumnsParseResult(null, "Параметр columns не должен быть пустым");
        }
        return new ColumnsParseResult(result, null);
    }

    private String buildSelectSql(List<ExportColumn> columns) {
        List<String> parts = new ArrayList<>();
        for (int i = 0; i < columns.size(); i += 1) {
            parts.add(columns.get(i).sql() + " as c" + i);
        }
        return String.join(",\n  ", parts);
    }

    private LinkedHashMap<String, String> collectRelationReportFilters(Map<String, Object> body, List<SortRule> sorts) {
        LinkedHashMap<String, String> filters = new LinkedHashMap<>();
        for (Map.Entry<String, String> filter : List.of(
            Map.entry("employeeName", "employee_name"),
            Map.entry("organName", "organ_name"),
            Map.entry("relationName", "relation_name"),
            Map.entry("salesOrganName", "sales_organ_name"),
            Map.entry("productGroupName", "product_group_name")
        )) {
            String value = normalizeText(body.get(filter.getKey()));
            if (value != null) {
                filters.put(
                    RELATION_FILTER_TITLES.getOrDefault(filter.getValue(), filter.getValue()),
                    value
                );
            }
        }

        String defaultFlag = normalizeText(body.get("defaultFlag"));
        if (defaultFlag != null) {
            filters.put(RELATION_FILTER_TITLES.getOrDefault("default_flag", "default_flag"), defaultFlag);
        }

        filters.put("Сортировка", formatSortRules(sorts, RELATION_SORT_TITLES));
        return filters;
    }

    private String formatSortRules(List<SortRule> sorts, Map<String, String> titles) {
        if (sorts == null || sorts.isEmpty()) {
            return "не задана";
        }
        List<String> parts = new ArrayList<>();
        for (SortRule sort : sorts) {
            String fieldTitle = titles.getOrDefault(sort.field(), sort.field());
            String direction = "ASC".equals(sort.direction()) ? "по возрастанию" : "по убыванию";
            parts.add(fieldTitle + " (" + direction + ")");
        }
        return String.join(", ", parts);
    }

    private byte[] buildExcelFromRowsWithFilters(
        String sheetName,
        List<ExportColumn> columns,
        List<Map<String, Object>> rows,
        LinkedHashMap<String, String> reportFilters
    ) throws IOException {
        SXSSFWorkbook workbook = new SXSSFWorkbook(1000);
        workbook.setCompressTempFiles(false);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet(sheetName);
            int rowIndex = 0;
            int columnsCount = columns.size();

            Row filtersTitleRow = sheet.createRow(rowIndex++);
            filtersTitleRow.createCell(0).setCellValue("Параметры отчета");
            if (reportFilters.isEmpty()) {
                Row row = sheet.createRow(rowIndex++);
                row.createCell(0).setCellValue("Фильтры: не заданы");
            } else {
                for (Map.Entry<String, String> entry : reportFilters.entrySet()) {
                    Row row = sheet.createRow(rowIndex++);
                    row.createCell(0).setCellValue(entry.getKey());
                    row.createCell(1).setCellValue(entry.getValue());
                }
            }

            rowIndex += 1;
            int tableHeaderRowIndex = rowIndex;
            Row headerRow = sheet.createRow(rowIndex++);
            int[] maxLengths = new int[columnsCount];
            for (int index = 0; index < columnsCount; index += 1) {
                String header = columns.get(index).title();
                headerRow.createCell(index).setCellValue(header);
                maxLengths[index] = Math.max(10, Math.min(80, header.length() + 2));
            }

            for (Map<String, Object> rowData : rows) {
                Row row = sheet.createRow(rowIndex++);
                for (int columnIndex = 0; columnIndex < columnsCount; columnIndex += 1) {
                    Object value = rowData.get("c" + columnIndex);
                    String text = value == null ? "" : String.valueOf(value);
                    row.createCell(columnIndex).setCellValue(text);
                    int normalizedLength = Math.max(10, Math.min(60, text.length() + 2));
                    if (normalizedLength > maxLengths[columnIndex]) {
                        maxLengths[columnIndex] = normalizedLength;
                    }
                }
            }

            for (int index = 0; index < maxLengths.length; index += 1) {
                sheet.setColumnWidth(index, Math.min(255 * 256, maxLengths[index] * 256));
            }
            int lastDataRowIndex = Math.max(tableHeaderRowIndex, rowIndex - 1);
            if (columnsCount > 0) {
                sheet.setAutoFilter(new CellRangeAddress(
                    tableHeaderRowIndex,
                    lastDataRowIndex,
                    0,
                    columnsCount - 1
                ));
            }
            sheet.createFreezePane(0, tableHeaderRowIndex + 1);
            workbook.write(out);
            return out.toByteArray();
        } finally {
            workbook.dispose();
            workbook.close();
        }
    }

    private String createExportFileName(String prefix) {
        return prefix + "-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + ".xlsx";
    }

    private ResponseEntity<byte[]> excelResponse(byte[] data, String fileName) {
        String encoded = UriUtils.encode(fileName, StandardCharsets.UTF_8);
        String disposition = "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''" + encoded;
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(data);
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

    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("ok", false, "error", message));
    }

    private ResponseEntity<Map<String, Object>> serverError(Exception exception, String fallbackMessage) {
        String message = exception == null || exception.getMessage() == null ? fallbackMessage : exception.getMessage();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf("ok", false, "error", message));
    }

    private Map<String, Object> mapOf(Object... values) {
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) {
            result.put(String.valueOf(values[i]), values[i + 1]);
        }
        return result;
    }

    private Map<String, String> mapOfString(String key1, String value1, String key2, String value2) {
        LinkedHashMap<String, String> result = new LinkedHashMap<>();
        result.put(key1, value1);
        result.put(key2, value2);
        return result;
    }

    private record SortRule(String field, String direction) {
    }

    private record SortParseResult(List<SortRule> sorts, String error) {
    }

    private record ColumnMeta(String title, String sql) {
    }

    private record ExportColumn(String key, String title, String sql) {
    }

    private record ColumnsParseResult(List<ExportColumn> columns, String error) {
    }
}
