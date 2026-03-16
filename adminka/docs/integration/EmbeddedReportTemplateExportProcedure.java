package integration;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Шаблон встраиваемой процедуры экспорта отчета в Excel.
 *
 * Идея:
 * 1) читаем шаблон отчета из report_templates;
 * 2) валидируем вход;
 * 3) подставляем параметры в SQL;
 * 4) выполняем SQL;
 * 5) рендерим Excel по report_info (json-макет);
 * 6) возвращаем бинарник + метрики.
 *
 * ВНИМАНИЕ:
 * - Это встраиваемая заготовка.
 * - Реализация SQL и рендера Excel подключается через интерфейсы (TemplateRepository/SqlRunner/ExcelRenderer).
 * - Для полного 1:1 поведения используйте алгоритмы из ApiController.java (adminka/backend/.../ApiController.java).
 */
public final class EmbeddedReportTemplateExportProcedure {

    public record ExportRequest(
        UUID reportTemplateId,
        UUID reportId,
        LocalDate startReport,
        LocalDate endReport,
        UUID claimOrganizationId,
        List<String> roleNames,
        boolean preview,
        Integer limit
    ) {}

    public record ExportResult(
        byte[] data,
        String fileName,
        String contentType,
        Map<String, String> headers
    ) {}

    public record ReportTemplate(
        UUID id,
        String method,
        Integer numberDays,
        String sqlQuery,
        String outputFileName,
        String outputFileType,
        String reportName,
        Map<String, Object> reportInfo,
        byte[] reportLogo
    ) {}

    public interface TemplateRepository {
        ReportTemplate getActiveTemplate(UUID reportTemplateId);
    }

    public interface SqlRunner {
        List<Map<String, Object>> runQuery(String sql);
        long countRows(String sql);
    }

    public interface ExcelRenderer {
        RenderedExcel render(
            List<Map<String, Object>> rows,
            Map<String, Object> reportInfo,
            List<FieldConfig> visibleFields,
            byte[] reportLogo,
            String reportName,
            LocalDate startReport,
            LocalDate endReport
        );
    }

    public record RenderedExcel(
        byte[] data,
        long totalExecutionMs,
        long queryExecutionMs,
        long templateFillMs
    ) {}

    public record FieldConfig(
        String fieldName,
        String caption,
        Integer orderNumber,
        String dataType,
        String dataFormat,
        String fieldLink,
        boolean autoWidth,
        String widthExcelUnits,
        boolean boldFont,
        boolean autoTransfer,
        String vertAlign,
        String horizAlign
    ) {}

    private final TemplateRepository templateRepository;
    private final SqlRunner sqlRunner;
    private final ExcelRenderer excelRenderer;

    public EmbeddedReportTemplateExportProcedure(
        TemplateRepository templateRepository,
        SqlRunner sqlRunner,
        ExcelRenderer excelRenderer
    ) {
        this.templateRepository = Objects.requireNonNull(templateRepository, "templateRepository");
        this.sqlRunner = Objects.requireNonNull(sqlRunner, "sqlRunner");
        this.excelRenderer = Objects.requireNonNull(excelRenderer, "excelRenderer");
    }

    public ExportResult execute(ExportRequest request) {
        validateRequest(request);
        ReportTemplate template = templateRepository.getActiveTemplate(request.reportTemplateId());
        if (template == null) {
            throw new IllegalArgumentException("Шаблон отчета не найден");
        }

        List<String> roleNames = normalizeRoleNames(request.roleNames());
        String method = normalizeText(template.method());
        if ("HAND".equalsIgnoreCase(method) && roleNames.isEmpty()) {
            throw new IllegalArgumentException("Для отчетов с method=HAND параметр roleNames обязателен");
        }

        List<FieldConfig> visibleFields = resolveVisibleFields(template.reportInfo());
        if (visibleFields.isEmpty()) {
            throw new IllegalArgumentException("В report_info должен быть хотя бы один видимый параметр поля");
        }

        String sql = buildExecutionSql(template, request, roleNames);
        String effectiveSql = request.preview()
            ? ("select * from (" + sql + ") report_preview limit " + resolvePreviewLimit(request.limit()))
            : sql;

        long selectedRows = request.preview() ? sqlRunner.countRows(sql) : -1L;
        List<Map<String, Object>> rows = sqlRunner.runQuery(effectiveSql);

        RenderedExcel rendered = excelRenderer.render(
            rows,
            template.reportInfo(),
            visibleFields,
            template.reportLogo(),
            defaultIfBlank(template.reportName(), "Отчет"),
            request.startReport(),
            request.endReport()
        );

        String ext = normalizeExtension(template.outputFileType());
        String fileName = buildFileName(template.outputFileName(), template.reportName(), ext);

        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("X-Execution-Ms", String.valueOf(rendered.totalExecutionMs()));
        headers.put("X-Query-Execution-Ms", String.valueOf(rendered.queryExecutionMs()));
        headers.put("X-Template-Fill-Ms", String.valueOf(rendered.templateFillMs()));
        if (request.preview()) {
            headers.put("X-Preview-Limit", String.valueOf(resolvePreviewLimit(request.limit())));
            headers.put("X-Selected-Rows", String.valueOf(Math.max(0, selectedRows)));
        } else {
            headers.put("X-Selected-Rows", String.valueOf(Math.max(0, rows.size())));
        }

        return new ExportResult(
            rendered.data(),
            fileName,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers
        );
    }

    private void validateRequest(ExportRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Тело запроса отсутствует");
        }
        if (request.reportTemplateId() == null) {
            throw new IllegalArgumentException("Параметр reportTemplateId обязателен");
        }
        if (request.claimOrganizationId() != null) {
            UUID.fromString(request.claimOrganizationId().toString());
        }
        if (request.reportId() != null) {
            UUID.fromString(request.reportId().toString());
        }
    }

    private String buildExecutionSql(ReportTemplate template, ExportRequest request, List<String> roleNames) {
        String sql = normalizeSingleSql(template.sqlQuery());
        sql = replaceNamed(sql, "startReport", toSqlDateOrNull(request.startReport()));
        sql = replaceNamed(sql, "endReport", toSqlDateOrNull(request.endReport()));
        sql = replaceNamed(sql, "claimOrganizationId", toSqlUuidOrNull(request.claimOrganizationId()));
        sql = replaceNamed(sql, "numberDays", String.valueOf(template.numberDays() == null ? 0 : template.numberDays()));
        UUID reportId = request.reportId() == null ? request.reportTemplateId() : request.reportId();
        sql = replaceNamed(sql, "reportId", toSqlUuidOrNull(reportId));
        sql = replaceRoleNames(sql, roleNames);
        return sql;
    }

    private String replaceRoleNames(String sql, List<String> roleNames) {
        String firstRole = roleNames.isEmpty() ? null : roleNames.get(0);
        String roleArray = toSqlTextArrayLiteral(roleNames);
        String out = sql.replaceAll(
            "(?i)array\\s*\\[\\s*:roleNames\\s*\\](\\s*::\\s*[a-zA-Z0-9_\\[\\]]+)?",
            roleArray
        );
        return replaceNamed(out, "roleNames", firstRole == null ? "NULL" : "'" + escapeSql(firstRole) + "'");
    }

    private String replaceNamed(String sql, String paramName, String replacement) {
        return sql.replaceAll("(?i)(?<!:):" + paramName + "\\b", replacement);
    }

    private String toSqlDateOrNull(LocalDate value) {
        return value == null ? "NULL" : "'" + value + "'";
    }

    private String toSqlUuidOrNull(UUID value) {
        return value == null ? "NULL" : "'" + value + "'";
    }

    private String toSqlTextArrayLiteral(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "ARRAY[]::text[]";
        }
        List<String> normalized = new ArrayList<>();
        for (String value : values) {
            String text = normalizeText(value);
            if (text != null) {
                normalized.add("'" + escapeSql(text) + "'");
            }
        }
        if (normalized.isEmpty()) {
            return "ARRAY[]::text[]";
        }
        return "ARRAY[" + String.join(", ", normalized) + "]::text[]";
    }

    private String normalizeSingleSql(String sql) {
        String text = defaultIfBlank(sql, "");
        while (text.endsWith(";")) {
            text = text.substring(0, text.length() - 1).trim();
        }
        return text;
    }

    private List<String> normalizeRoleNames(List<String> roleNames) {
        List<String> out = new ArrayList<>();
        if (roleNames == null) {
            return out;
        }
        for (String value : roleNames) {
            String text = normalizeText(value);
            if (text != null) {
                out.add(text);
            }
        }
        return out;
    }

    private List<FieldConfig> resolveVisibleFields(Map<String, Object> reportInfo) {
        // В рабочем проекте вставьте 1:1 логику из ApiController.resolveVisibleReportFields(...)
        // Здесь намеренно оставлено минимальное поведение-шаблон:
        List<FieldConfig> out = new ArrayList<>();
        Object fieldsRaw = reportInfo == null ? null : reportInfo.get("fields");
        if (!(fieldsRaw instanceof List<?> fields)) {
            return out;
        }
        int sourceIndex = 0;
        for (Object fieldRaw : fields) {
            if (!(fieldRaw instanceof Map<?, ?> map)) {
                sourceIndex += 1;
                continue;
            }
            String fieldName = normalizeText(map.get("fieldName"));
            if (fieldName == null) {
                sourceIndex += 1;
                continue;
            }
            boolean visible = toBooleanOrDefault(map.get("reportVisible"), true);
            if (!visible) {
                sourceIndex += 1;
                continue;
            }
            Integer orderNumber = toPositiveInt(map.get("fieldOrderNumber"));
            out.add(new FieldConfig(
                fieldName,
                defaultIfBlank(normalizeText(map.get("fieldCaption")), fieldName),
                orderNumber == null ? sourceIndex + 1 : orderNumber,
                normalizeText(map.get("fieldDataType")),
                normalizeText(map.get("fieldDataFormat")),
                normalizeText(map.get("fieldLink")),
                toBooleanOrDefault(map.get("fieldAutoWidth"), true),
                normalizeText(map.get("filedWidth")),
                toBooleanOrDefault(map.get("fieldBoldFont"), false),
                toBooleanOrDefault(map.get("fieldAutoTransfer"), false),
                normalizeText(map.get("fieldVertAlign")),
                normalizeText(map.get("fieldHorizAlign"))
            ));
            sourceIndex += 1;
        }
        out.sort((a, b) -> Integer.compare(
            a.orderNumber() == null ? Integer.MAX_VALUE : a.orderNumber(),
            b.orderNumber() == null ? Integer.MAX_VALUE : b.orderNumber()
        ));
        return out;
    }

    private int resolvePreviewLimit(Integer limit) {
        int value = limit == null ? 50 : limit;
        if (value < 1) {
            return 1;
        }
        return Math.min(value, 500);
    }

    private String normalizeExtension(String outputFileType) {
        String text = defaultIfBlank(outputFileType, "xlsx").toLowerCase(Locale.ROOT);
        String normalized = text.replaceAll("[^a-z0-9]+", "");
        return normalized.isBlank() ? "xlsx" : normalized;
    }

    private String buildFileName(String outputFileName, String reportName, String ext) {
        String base = defaultIfBlank(outputFileName, defaultIfBlank(reportName, "report")).trim();
        if (base.endsWith("." + ext)) {
            return base;
        }
        return base + "." + ext;
    }

    private String normalizeText(Object value) {
        String text = value == null ? null : String.valueOf(value).trim();
        return (text == null || text.isBlank()) ? null : text;
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String escapeSql(String value) {
        return value.replace("'", "''");
    }

    private boolean toBooleanOrDefault(Object value, boolean fallback) {
        if (value == null) {
            return fallback;
        }
        String text = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        if (text.isEmpty()) {
            return fallback;
        }
        if (List.of("true", "1", "yes", "y", "да").contains(text)) {
            return true;
        }
        if (List.of("false", "0", "no", "n", "нет").contains(text)) {
            return false;
        }
        return fallback;
    }

    private Integer toPositiveInt(Object value) {
        if (value == null) {
            return null;
        }
        try {
            int parsed = Integer.parseInt(String.valueOf(value).trim());
            return parsed > 0 ? parsed : null;
        } catch (Exception ignored) {
            return null;
        }
    }
}
