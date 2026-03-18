package com.employees.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.employees.backend.repository.ReportTemplateRepository;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class ReportTemplateService {
    private static final Set<String> ALLOWED_SORT_DIRECTIONS = Set.of("ASC", "DESC");
    private static final Set<String> REPORT_TEMPLATE_SORT_FIELDS = Set.of(
        "code_report", "name", "output_file_name", "output_file_type", "version", "status", "method"
    );
    private static final Set<String> REPORT_TEMPLATE_TEXT_SORT_FIELDS = Set.of(
        "code_report", "name", "output_file_name", "output_file_type", "version", "status", "method"
    );
    private static final Map<String, String> REPORT_TEMPLATE_SORT_SQL = Map.of(
        "code_report", "rt.code_report",
        "name", "rt.name",
        "output_file_name", "rt.output_file_name",
        "output_file_type", "rt.output_file_type",
        "version", "rt.version",
        "status", "rt.status",
        "method", "rt.method"
    );

    private final ReportTemplateRepository reportTemplateRepository;
    private final ObjectMapper objectMapper;

    public ReportTemplateService(
        ReportTemplateRepository reportTemplateRepository,
        ObjectMapper objectMapper
    ) {
        this.reportTemplateRepository = reportTemplateRepository;
        this.objectMapper = objectMapper;
    }

    public ReportTemplateRepository repository() {
        return reportTemplateRepository;
    }

    public ResponseEntity<Map<String, Object>> reportTemplatesGet() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(mapOf("ok", false, "error", "Используйте POST /api/report-templates с JSON body"));
    }

    public ResponseEntity<Map<String, Object>> reportTemplatesPost(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String arrayParamError = hasArrayValue(body, Set.of("sorts"));
        if (arrayParamError != null) {
            return badRequest("Параметр " + arrayParamError + " должен содержать одно значение");
        }

        ParseResult limitParsed = parsePositiveInteger(body.get("limit"), 50, "limit");
        if (limitParsed.error() != null) {
            return badRequest(limitParsed.error());
        }
        ParseResult offsetParsed = parsePositiveInteger(body.get("offset"), 1, "offset");
        if (offsetParsed.error() != null) {
            return badRequest(offsetParsed.error());
        }

        SortParseResult sortsResult = parseSorts(body, REPORT_TEMPLATE_SORT_FIELDS, "code_report");
        if (sortsResult.error() != null) {
            return badRequest(sortsResult.error());
        }
        List<SortRule> sorts = sortsResult.sorts().isEmpty()
            ? List.of(new SortRule("code_report", "ASC"))
            : sortsResult.sorts();

        int limit = limitParsed.value();
        int offset = offsetParsed.value();
        int sqlOffset = (offset - 1) * limit;

        List<Object> params = new ArrayList<>();
        List<String> where = new ArrayList<>();
        where.add("rt.deleted = false");

        String codeReport = normalizeText(body.get("codeReport"));
        if (codeReport != null) {
            for (String token : splitSearchTokens(codeReport)) {
                where.add("rt.code_report ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String name = normalizeText(body.get("name"));
        if (name != null) {
            for (String token : splitSearchTokens(name)) {
                where.add("rt.name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String outputFileName = normalizeText(body.get("outputFileName"));
        if (outputFileName != null) {
            for (String token : splitSearchTokens(outputFileName)) {
                where.add("rt.output_file_name ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String outputFileType = normalizeText(body.get("outputFileType"));
        if (outputFileType != null) {
            for (String token : splitSearchTokens(outputFileType)) {
                where.add("rt.output_file_type ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String version = normalizeText(body.get("version"));
        if (version != null) {
            for (String token : splitSearchTokens(version)) {
                where.add("rt.version::text ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String status = normalizeText(body.get("status"));
        if (status != null) {
            for (String token : splitSearchTokens(status)) {
                where.add("rt.status ILIKE ?");
                params.add("%" + token + "%");
            }
        }
        String method = normalizeText(body.get("method"));
        if (method != null) {
            for (String token : splitSearchTokens(method)) {
                where.add("rt.method ILIKE ?");
                params.add("%" + token + "%");
            }
        }

        String whereSql = "where " + String.join(" and ", where);
        String orderBy = buildReportTemplateOrderBy(sorts);

        String dataSql = """
            select
              rt.id::text as report_template_id,
              rt.code_report as code_report,
              rt.name as name,
              rt.output_file_name as output_file_name,
              rt.output_file_type as output_file_type,
              rt.version as version,
              rt.status as status,
              rt.method as method,
              rt.number_days as number_days,
              rt.sql_query as sql_query,
              rt.report_info as report_info,
              coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'organUnitId', organization_item.organ_unit_id,
                    'organUnitName', organization_item.organ_unit_name
                  )
                  order by organization_item.organ_unit_name, organization_item.organ_unit_id
                )
                from (
                  select distinct
                    rto.claim_organization_id::text as organ_unit_id,
                    coalesce(ou.sh_name, '') as organ_unit_name
                  from public.report_template_organizations rto
                  left join party.organ_unit ou
                    on ou.id = rto.claim_organization_id
                  where rto.report_template_id = rt.id
                ) organization_item
              ), '[]'::jsonb)::text as organizations,
              coalesce((
                select jsonb_agg(
                  jsonb_build_object('codeAccess', access_item.code_access)
                  order by access_item.code_access
                )
                from (
                  select distinct
                    rag.code_access as code_access
                  from public.report_access_group rag
                  where rag.report_template_id = rt.id
                    and rag.code_access is not null
                ) access_item
              ), '[]'::jsonb)::text as access_groups
            from public.report_templates rt
            %s
            order by %s
            limit ?
            offset ?
            """.formatted(whereSql, orderBy);
        String countSql = """
            select count(*)::int
            from public.report_templates rt
            %s
            """.formatted(whereSql);

        try {
            List<Object> pagedParams = new ArrayList<>(params);
            pagedParams.add(limit);
            pagedParams.add(sqlOffset);
            List<Map<String, Object>> rawItems = reportTemplateRepository.queryForList(dataSql, pagedParams.toArray());
            List<Map<String, Object>> items = new ArrayList<>(rawItems.size());
            for (Map<String, Object> item : rawItems) {
                LinkedHashMap<String, Object> mapped = new LinkedHashMap<>();
                mapped.put("reportTemplateId", item.get("report_template_id"));
                mapped.put("codeReport", item.get("code_report"));
                mapped.put("name", item.get("name"));
                mapped.put("outputFileName", item.get("output_file_name"));
                mapped.put("outputFileType", item.get("output_file_type"));
                mapped.put("version", item.get("version"));
                mapped.put("status", item.get("status"));
                mapped.put("method", item.get("method"));
                mapped.put("numberDays", item.get("number_days"));
                mapped.put("sqlQuery", item.get("sql_query"));
                mapped.put("reportInfo", item.get("report_info"));
                mapped.put("organizations", parseJsonArrayOfObjects(item.get("organizations")));
                mapped.put("accessGroups", parseJsonArrayOfObjects(item.get("access_groups")));
                items.add(mapped);
            }
            Integer totalCount = reportTemplateRepository.queryForObject(countSql, Integer.class, params.toArray());
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size(),
                "totalCount", totalCount == null ? 0 : totalCount,
                "limit", limit,
                "offset", offset,
                "sorts", toSortMapsCamel(sorts)
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка запроса");
        }
    }

    public ResponseEntity<Map<String, Object>> createReportTemplate(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String codeReport = normalizeText(body.get("codeReport"));
        String name = normalizeText(body.get("name"));
        String outputFileName = normalizeText(body.get("outputFileName"));
        String outputFileType = normalizeText(body.get("outputFileType"));
        String version = normalizeText(body.get("version"));
        String status = normalizeText(body.get("status"));
        String method = normalizeText(body.get("method"));

        if (codeReport == null) {
            return badRequest("Параметр codeReport обязателен");
        }
        if (name == null) {
            return badRequest("Параметр name обязателен");
        }
        if (outputFileName == null) {
            return badRequest("Параметр outputFileName обязателен");
        }

        String normalizedOutputFileType = outputFileType == null ? "XLSX" : outputFileType.toUpperCase(Locale.ROOT);
        if (!"XLSX".equals(normalizedOutputFileType)) {
            return badRequest("Параметр outputFileType должен быть XLSX");
        }

        String normalizedMethod = method == null ? "AUTO" : method.toUpperCase(Locale.ROOT);
        if (!Set.of("AUTO", "HAND").contains(normalizedMethod)) {
            return badRequest("Параметр method должен быть AUTO или HAND");
        }

        String normalizedStatus = status == null ? "ACTIVE" : status.toUpperCase(Locale.ROOT);
        if (!Set.of("ACTIVE", "INACTIVE").contains(normalizedStatus)) {
            return badRequest("Параметр status должен быть ACTIVE или INACTIVE");
        }

        Integer numberDays = null;
        if (body.containsKey("numberDays")) {
            String normalizedNumberDaysText = normalizeText(body.get("numberDays"));
            if (normalizedNumberDaysText != null) {
                if (!normalizedNumberDaysText.matches("^\\d+$")) {
                    return badRequest("Параметр numberDays должен быть целым неотрицательным числом");
                }
                try {
                    numberDays = Integer.valueOf(normalizedNumberDaysText);
                } catch (Exception exception) {
                    return badRequest("Параметр numberDays должен быть целым неотрицательным числом");
                }
            }
        }

        String reportTemplateId = UUID.randomUUID().toString();
        try {
            reportTemplateRepository.insertTemplate(
                reportTemplateId,
                codeReport,
                name,
                outputFileName,
                normalizedOutputFileType,
                version,
                normalizedStatus,
                normalizedMethod,
                numberDays
            );
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "reportTemplateId", reportTemplateId,
                    "codeReport", codeReport,
                    "name", name,
                    "outputFileName", outputFileName,
                    "outputFileType", normalizedOutputFileType,
                    "version", version,
                    "status", normalizedStatus,
                    "method", normalizedMethod,
                    "numberDays", numberDays,
                    "sqlQuery", "",
                    "reportInfo", Map.of(),
                    "organizations", List.of(),
                    "accessGroups", List.of()
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка создания отчета");
        }
    }

    public ResponseEntity<Map<String, Object>> updateMainSettings(String reportTemplateId, Map<String, Object> rawBody) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(normalizedReportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String codeReport = normalizeText(body.get("codeReport"));
        String name = normalizeText(body.get("name"));
        String outputFileName = normalizeText(body.get("outputFileName"));
        String outputFileType = normalizeText(body.get("outputFileType"));
        String version = normalizeText(body.get("version"));
        String status = normalizeText(body.get("status"));
        String method = normalizeText(body.get("method"));
        Integer numberDays = null;
        if (body.containsKey("numberDays")) {
            Object numberDaysRaw = body.get("numberDays");
            String normalizedNumberDaysText = normalizeText(numberDaysRaw);
            if (normalizedNumberDaysText != null) {
                if (!normalizedNumberDaysText.matches("^\\d+$")) {
                    return badRequest("Параметр numberDays должен быть целым неотрицательным числом");
                }
                try {
                    numberDays = Integer.valueOf(normalizedNumberDaysText);
                } catch (Exception exception) {
                    return badRequest("Параметр numberDays должен быть целым неотрицательным числом");
                }
            }
        }
        try {
            int updated = reportTemplateRepository.updateMainSettings(
                normalizedReportTemplateId,
                codeReport,
                name,
                outputFileName,
                outputFileType,
                version,
                status,
                method,
                numberDays
            );
            if (updated == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "reportTemplateId", normalizedReportTemplateId,
                    "codeReport", codeReport,
                    "name", name,
                    "outputFileName", outputFileName,
                    "outputFileType", outputFileType,
                    "version", version,
                    "status", status,
                    "method", method,
                    "numberDays", numberDays
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка сохранения основных настроек отчета");
        }
    }

    public ResponseEntity<Map<String, Object>> deleteTemplate(String reportTemplateId) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(normalizedReportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        try {
            int templateExists = reportTemplateRepository.countActiveTemplateById(normalizedReportTemplateId);
            if (templateExists == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            int deletedAccessGroups = reportTemplateRepository.deleteAccessGroupsByTemplateId(normalizedReportTemplateId);
            int deletedOrganizations = reportTemplateRepository.deleteOrganizationsByTemplateId(normalizedReportTemplateId);
            int deletedTemplates = reportTemplateRepository.deleteTemplateById(normalizedReportTemplateId);
            if (deletedTemplates == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deletedReportTemplateId", normalizedReportTemplateId,
                "deletedAccessGroups", deletedAccessGroups,
                "deletedOrganizations", deletedOrganizations,
                "deletedTemplates", deletedTemplates
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка удаления отчета");
        }
    }

    public ResponseEntity<Map<String, Object>> deleteReportTemplateOrganization(
        String reportTemplateId,
        String organUnitId
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(normalizedReportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        String normalizedOrganUnitId = normalizeText(organUnitId);
        if (normalizedOrganUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!isUuid(normalizedOrganUnitId)) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        try {
            int deletedCount = reportTemplateRepository.deleteOrganizationLink(
                normalizedReportTemplateId,
                normalizedOrganUnitId
            );
            if (deletedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Связь отчета с организацией не найдена"
                ));
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deletedCount", deletedCount
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка удаления");
        }
    }

    public ResponseEntity<Map<String, Object>> deleteReportTemplateAccessGroup(
        String reportTemplateId,
        String codeAccess
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(normalizedReportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        String normalizedCodeAccess = normalizeText(codeAccess);
        if (normalizedCodeAccess == null) {
            return badRequest("Параметр codeAccess обязателен");
        }
        try {
            int deletedCount = reportTemplateRepository.deleteAccessGroupLink(
                normalizedReportTemplateId,
                normalizedCodeAccess
            );
            if (deletedCount == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                    "ok", false,
                    "error", "Группа доступа отчета не найдена"
                ));
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "deletedCount", deletedCount
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка удаления");
        }
    }

    public ResponseEntity<Map<String, Object>> addReportTemplateOrganization(
        String reportTemplateId,
        Map<String, Object> rawBody
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(normalizedReportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String organUnitId = normalizeText(body.get("organUnitId"));
        if (organUnitId == null) {
            return badRequest("Параметр organUnitId обязателен");
        }
        if (!isUuid(organUnitId)) {
            return badRequest("Параметр organUnitId должен быть UUID");
        }
        try {
            int templateExists = reportTemplateRepository.countActiveTemplateById(normalizedReportTemplateId);
            if (templateExists == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            List<Map<String, Object>> organizations = reportTemplateRepository.findOrganizationInfoById(organUnitId);
            if (organizations.isEmpty()) {
                return badRequest("Организация не найдена");
            }
            Map<String, Object> organization = organizations.get(0);
            int insertedCount = reportTemplateRepository.insertOrganizationLinkIfAbsent(
                normalizedReportTemplateId,
                organUnitId
            );
            if (insertedCount == 0) {
                return badRequest("Связь Отчет-Организация уже существует");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "organUnitId", organization.get("organ_unit_id"),
                    "organUnitName", organization.get("organ_unit_name")
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка добавления");
        }
    }

    public ResponseEntity<Map<String, Object>> addReportTemplateAccessGroup(
        String reportTemplateId,
        Map<String, Object> rawBody
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(normalizedReportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        String codeAccess = normalizeText(body.get("codeAccess"));
        if (codeAccess == null) {
            return badRequest("Параметр codeAccess обязателен");
        }
        if (!codeAccess.matches("^GRP(0[1-9]|10)$")) {
            return badRequest("Параметр codeAccess должен быть в диапазоне GRP01-GRP10");
        }
        try {
            int templateExists = reportTemplateRepository.countActiveTemplateById(normalizedReportTemplateId);
            if (templateExists == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            int insertedCount = reportTemplateRepository.insertAccessGroupLinkIfAbsent(
                normalizedReportTemplateId,
                codeAccess
            );
            if (insertedCount == 0) {
                return badRequest("Связь Отчет-Группа доступа уже существует");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "codeAccess", codeAccess
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Внутренняя ошибка добавления");
        }
    }

    public ResponseEntity<Map<String, Object>> reportTemplateSettingsGet(String reportTemplateId) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(normalizedReportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        try {
            List<Map<String, Object>> templates = reportTemplateRepository.findTemplateSettingsById(normalizedReportTemplateId);
            if (templates.isEmpty()) {
                return badRequest("Шаблон отчета не найден");
            }
            Map<String, Object> template = templates.get(0);
            String reportInfoText = normalizeText(template.get("report_info"));
            Object reportInfo = null;
            if (reportInfoText != null) {
                reportInfo = objectMapper.readValue(reportInfoText, new TypeReference<Map<String, Object>>() {});
            }
            String reportInfoJson = normalizeText(template.get("report_info_pretty"));
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "reportTemplateId", template.get("report_template_id"),
                    "name", template.get("name"),
                    "reportInfo", reportInfo,
                    "reportInfoJson", reportInfoJson,
                    "reportLogoBase64", template.get("report_logo_base64"),
                    "reportLogoMimeType", template.get("report_logo_mime_type")
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка получения настроек шаблона отчета");
        }
    }

    public ResponseEntity<Map<String, Object>> updateReportTemplateSettings(
        String reportTemplateId,
        Map<String, Object> rawBody
    ) {
        String normalizedReportTemplateId = normalizeText(reportTemplateId);
        if (normalizedReportTemplateId == null) {
            return badRequest("Параметр reportTemplateId обязателен");
        }
        if (!isUuid(normalizedReportTemplateId)) {
            return badRequest("Параметр reportTemplateId должен быть UUID");
        }
        Map<String, Object> body = normalizeRequestBody(rawBody);
        Object reportInfoRaw = body.get("reportInfo");
        Map<String, Object> reportInfoMap;
        try {
            reportInfoMap = normalizeReportInfoForSave(reportInfoRaw);
        } catch (IllegalArgumentException exception) {
            return badRequest("Параметр reportInfo должен быть объектом JSON");
        } catch (IOException exception) {
            return badRequest("Параметр reportInfo должен быть корректным JSON-объектом");
        }
        Map<String, Object> sanitizedReportInfo = sanitizeReportInfoBeforeSave(reportInfoMap);
        String reportInfoJson;
        try {
            reportInfoJson = objectMapper.writeValueAsString(sanitizedReportInfo);
        } catch (Exception exception) {
            return badRequest("Параметр reportInfo должен быть корректным JSON-объектом");
        }

        String reportLogoBase64 = normalizeText(body.get("reportLogoBase64"));
        boolean clearReportLogo = Boolean.TRUE.equals(body.get("clearReportLogo"))
            || "true".equalsIgnoreCase(String.valueOf(body.get("clearReportLogo")));
        boolean shouldUpdateLogo = clearReportLogo || body.containsKey("reportLogoBase64");
        byte[] reportLogoBytes = null;
        if (!clearReportLogo && reportLogoBase64 != null) {
            try {
                reportLogoBytes = decodeBase64Lenient(reportLogoBase64);
            } catch (IllegalArgumentException exception) {
                return badRequest("Параметр reportLogoBase64 должен быть корректной base64-строкой");
            }
        }

        try {
            int updated = shouldUpdateLogo
                ? reportTemplateRepository.updateTemplateSettingsWithLogo(
                    normalizedReportTemplateId,
                    reportInfoJson,
                    reportLogoBytes
                )
                : reportTemplateRepository.updateTemplateSettingsWithoutLogo(
                    normalizedReportTemplateId,
                    reportInfoJson
                );
            if (updated == 0) {
                return badRequest("Шаблон отчета не найден");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "message", "Настройки шаблона отчета сохранены",
                "item", mapOf(
                    "reportTemplateId", normalizedReportTemplateId,
                    "reportInfo", sanitizedReportInfo,
                    "reportInfoJson", objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(sanitizedReportInfo),
                    "reportLogoBase64", shouldUpdateLogo ? reportLogoBase64 : null
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка сохранения настроек шаблона отчета");
        }
    }

    private boolean isUuid(String value) {
        return value != null && value.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
    }

    private String hasArrayValue(Map<String, Object> body, Set<String> allowedArrayKeys) {
        for (Map.Entry<String, Object> entry : body.entrySet()) {
            if (entry.getValue() instanceof List<?> && !allowedArrayKeys.contains(entry.getKey())) {
                return entry.getKey();
            }
        }
        return null;
    }

    private ParseResult parsePositiveInteger(Object rawValue, int defaultValue, String fieldName) {
        if (rawValue == null) {
            return new ParseResult(defaultValue, null);
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

    private String buildReportTemplateOrderBy(List<SortRule> sorts) {
        List<String> chunks = new ArrayList<>();
        for (SortRule sort : sorts) {
            String baseExpr = REPORT_TEMPLATE_SORT_SQL.get(sort.field());
            String sortExpr =
                REPORT_TEMPLATE_TEXT_SORT_FIELDS.contains(sort.field()) ? baseExpr + " collate \"C\"" : baseExpr;
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

    private List<Map<String, Object>> parseJsonArrayOfObjects(Object rawJson) {
        String jsonText = normalizeText(rawJson);
        if (jsonText == null) {
            return List.of();
        }
        try {
            List<Map<String, Object>> parsed = objectMapper.readValue(
                jsonText,
                new TypeReference<List<Map<String, Object>>>() {}
            );
            if (parsed == null) {
                return List.of();
            }
            return parsed;
        } catch (Exception exception) {
            return List.of();
        }
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

    private Map<String, Object> sanitizeReportInfoBeforeSave(Map<?, ?> reportInfoMap) {
        LinkedHashMap<String, Object> sanitized = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : reportInfoMap.entrySet()) {
            String key = String.valueOf(entry.getKey());
            if ("fields".equals(key) && entry.getValue() instanceof Collection<?> fieldsCollection) {
                List<Map<String, Object>> filteredFields = new ArrayList<>();
                for (Object fieldRaw : fieldsCollection) {
                    if (!(fieldRaw instanceof Map<?, ?> fieldMap)) {
                        continue;
                    }
                    boolean reportVisible = toBooleanOrDefault(fieldMap.get("reportVisible"), true);
                    Integer normalizedOrderNumber = normalizePositiveOrderNumber(
                        fieldMap.containsKey("fieldOrderNumber")
                            ? fieldMap.get("fieldOrderNumber")
                            : fieldMap.get("fielOrderNumber")
                    );
                    if (reportVisible && normalizedOrderNumber == null) {
                        continue;
                    }
                    LinkedHashMap<String, Object> normalizedField = new LinkedHashMap<>();
                    for (Map.Entry<?, ?> fieldEntry : fieldMap.entrySet()) {
                        normalizedField.put(String.valueOf(fieldEntry.getKey()), fieldEntry.getValue());
                    }
                    normalizedField.remove("fielOrderNumber");
                    normalizedField.put("reportVisible", reportVisible);
                    normalizedField.put("fieldOrderNumber", reportVisible ? normalizedOrderNumber : "");
                    filteredFields.add(normalizedField);
                }
                sanitized.put(key, filteredFields);
                continue;
            }
            sanitized.put(key, entry.getValue());
        }
        return sanitized;
    }

    private Map<String, Object> normalizeReportInfoForSave(Object reportInfoRaw) throws IOException {
        if (reportInfoRaw == null) {
            return new LinkedHashMap<>();
        }
        if (reportInfoRaw instanceof Map<?, ?> reportInfoMap) {
            LinkedHashMap<String, Object> normalized = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : reportInfoMap.entrySet()) {
                normalized.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return normalized;
        }
        String reportInfoText = normalizeText(reportInfoRaw);
        if (reportInfoText == null) {
            return new LinkedHashMap<>();
        }
        Object parsed = objectMapper.readValue(reportInfoText, Object.class);
        if (!(parsed instanceof Map<?, ?> parsedMap)) {
            throw new IllegalArgumentException("reportInfo is not an object");
        }
        LinkedHashMap<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : parsedMap.entrySet()) {
            normalized.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return normalized;
    }

    private boolean toBooleanOrDefault(Object rawValue, boolean fallbackValue) {
        if (rawValue instanceof Boolean booleanValue) {
            return booleanValue;
        }
        String normalized = normalizeText(rawValue);
        if (normalized == null) {
            return fallbackValue;
        }
        if ("true".equalsIgnoreCase(normalized) || "да".equalsIgnoreCase(normalized)) {
            return true;
        }
        if ("false".equalsIgnoreCase(normalized) || "нет".equalsIgnoreCase(normalized)) {
            return false;
        }
        return fallbackValue;
    }

    private Integer normalizePositiveOrderNumber(Object rawValue) {
        String normalized = normalizeText(rawValue);
        if (normalized == null || !normalized.matches("^\\d+$")) {
            return null;
        }
        try {
            int parsed = Integer.parseInt(normalized);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private byte[] decodeBase64Lenient(String base64Value) {
        String normalized = normalizeText(base64Value);
        if (normalized == null) {
            throw new IllegalArgumentException("empty base64");
        }
        String compact = normalized.replaceAll("\\s+", "");
        if (compact.isEmpty()) {
            throw new IllegalArgumentException("empty base64");
        }
        try {
            return Base64.getDecoder().decode(compact);
        } catch (IllegalArgumentException exception) {
            return Base64.getUrlDecoder().decode(compact);
        }
    }

    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("ok", false, "error", message));
    }

    private ResponseEntity<Map<String, Object>> serverError(Exception exception, String message) {
        String details = exception == null ? null : normalizeText(exception.getMessage());
        if (details == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(mapOf("ok", false, "error", message));
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(mapOf("ok", false, "error", message, "details", details));
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
