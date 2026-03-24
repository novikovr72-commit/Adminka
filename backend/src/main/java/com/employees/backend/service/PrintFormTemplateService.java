package com.employees.backend.service;

import com.employees.backend.repository.PrintFormTemplateRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;

@Service
public class PrintFormTemplateService {
    private final PrintFormTemplateRepository printFormTemplateRepository;
    private final PrintFormTemplatePdfService printFormTemplatePdfService;
    private final ObjectMapper objectMapper;

    public PrintFormTemplateService(
        PrintFormTemplateRepository printFormTemplateRepository,
        PrintFormTemplatePdfService printFormTemplatePdfService,
        ObjectMapper objectMapper
    ) {
        this.printFormTemplateRepository = printFormTemplateRepository;
        this.printFormTemplatePdfService = printFormTemplatePdfService;
        this.objectMapper = objectMapper;
    }

    public ResponseEntity<Map<String, Object>> recognizePrintFormTemplate(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeBody(rawBody);
        String templatePdfBase64 = normalizeText(body.get("templatePdfBase64"));
        if (templatePdfBase64 == null) {
            return badRequest("Параметр templatePdfBase64 обязателен");
        }
        byte[] templatePdf;
        try {
            templatePdf = Base64.getDecoder().decode(templatePdfBase64);
            if (templatePdf.length == 0) {
                return badRequest("Параметр templatePdfBase64 пустой");
            }
        } catch (Exception exception) {
            return badRequest("Параметр templatePdfBase64 должен быть валидным base64");
        }
        try {
            List<Map<String, Object>> detected = printFormTemplatePdfService.extractPlaceholdersWithCoordinates(templatePdf);
            if (detected.isEmpty()) {
                return badRequest("В PDF не найдены атрибуты вида {fieldName}");
            }
            LinkedHashSet<String> fieldsSet = new LinkedHashSet<>();
            List<Map<String, Object>> preparedFieldMapping = new ArrayList<>();
            for (Map<String, Object> item : detected) {
                String sourceField = normalizeText(item.get("sourceField"));
                if (sourceField == null) {
                    continue;
                }
                fieldsSet.add(sourceField);
                preparedFieldMapping.add(mapOf(
                    "sourceField", sourceField,
                    "page", item.get("page"),
                    "x", item.get("x"),
                    "y", item.get("y"),
                    "fontSize", item.get("fontSize"),
                    "maxWidth", item.get("maxWidth"),
                    "align", "LEFT",
                    "color", "#000000"
                ));
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapOf(
                    "count", preparedFieldMapping.size(),
                    "templateFields", new ArrayList<>(fieldsSet),
                    "fieldMapping", preparedFieldMapping,
                    "detectedPlaceholders", detected
                )
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка распознавания PDF-шаблона");
        }
    }

    public ResponseEntity<Map<String, Object>> createPrintFormTemplate(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeBody(rawBody);
        String name = normalizeText(body.get("name"));
        String code = normalizeText(body.get("code"));
        String description = normalizeText(body.get("description"));
        String dataSql = normalizeText(body.get("dataSql"));
        String templatePdfBase64 = normalizeText(body.get("templatePdfBase64"));
        if (name == null) {
            return badRequest("Параметр name обязателен");
        }
        if (dataSql == null) {
            return badRequest("Параметр dataSql обязателен");
        }
        if (templatePdfBase64 == null) {
            return badRequest("Параметр templatePdfBase64 обязателен");
        }
        String sqlValidationError = validateTemplateDataSql(dataSql);
        if (sqlValidationError != null) {
            return badRequest(sqlValidationError);
        }
        byte[] templatePdf;
        try {
            templatePdf = Base64.getDecoder().decode(templatePdfBase64);
            if (templatePdf.length == 0) {
                return badRequest("Параметр templatePdfBase64 пустой");
            }
        } catch (Exception exception) {
            return badRequest("Параметр templatePdfBase64 должен быть валидным base64");
        }
        List<Map<String, Object>> fieldMapping = parseFieldMapping(body.get("fieldMapping"));
        if (fieldMapping == null) {
            return badRequest("Параметр fieldMapping должен быть JSON-массивом");
        }
        Map<String, Object> overlaySettings = parseJsonObject(body.get("overlaySettings"), mapOf());
        if (overlaySettings == null) {
            return badRequest("Параметр overlaySettings должен быть JSON-объектом");
        }
        String id = UUID.randomUUID().toString();
        try {
            printFormTemplateRepository.updateNamed(
                """
                insert into public.print_form_templates(
                  id,
                  code,
                  name,
                  name_eng,
                  description,
                  template_pdf,
                  data_sql,
                  field_mapping,
                  overlay_settings,
                  deleted
                )
                values (
                  cast(:id as uuid),
                  :code,
                  :name,
                  :nameEng,
                  :description,
                  :templatePdf,
                  :dataSql,
                  cast(:fieldMappingJson as jsonb),
                  cast(:overlaySettingsJson as jsonb),
                  false
                )
                """,
                new CreateTemplateParams(
                    id,
                    code,
                    name,
                    name,
                    description,
                    templatePdf,
                    dataSql,
                    toJson(fieldMapping),
                    toJson(overlaySettings)
                )
            );
            return ResponseEntity.ok(mapOf("ok", true, "item", mapTemplateForResponse(loadTemplateById(id, true))));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка создания шаблона печатной формы");
        }
    }

    public ResponseEntity<Map<String, Object>> listPrintFormTemplates(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeBody(rawBody);
        int limit = parseInt(body.get("limit"), 50, 1, 200);
        int offset = parseInt(body.get("offset"), 1, 1, Integer.MAX_VALUE);
        int sqlOffset = (offset - 1) * limit;
        String search = normalizeText(body.get("search"));
        try {
            List<Map<String, Object>> rows = printFormTemplateRepository.findTemplates(search, limit, sqlOffset);
            Integer totalCount = printFormTemplateRepository.countTemplates(search);
            List<Map<String, Object>> items = rows.stream().map(this::mapTemplateForResponse).toList();
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "items", items,
                "count", items.size(),
                "totalCount", totalCount == null ? 0 : totalCount,
                "limit", limit,
                "offset", offset
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка получения шаблонов печатных форм");
        }
    }

    public ResponseEntity<Map<String, Object>> getPrintFormTemplate(String templateId) {
        String normalizedTemplateId = normalizeText(templateId);
        if (!isUuid(normalizedTemplateId)) {
            return badRequest("Параметр templateId должен быть UUID");
        }
        try {
            Map<String, Object> template = loadTemplateById(normalizedTemplateId, true);
            if (template == null) {
                return badRequest("Шаблон печатной формы не найден");
            }
            return ResponseEntity.ok(mapOf("ok", true, "item", mapTemplateForResponse(template)));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка получения шаблона печатной формы");
        }
    }

    public ResponseEntity<Map<String, Object>> updatePrintFormTemplate(
        String templateId,
        Map<String, Object> rawBody
    ) {
        String normalizedTemplateId = normalizeText(templateId);
        if (!isUuid(normalizedTemplateId)) {
            return badRequest("Параметр templateId должен быть UUID");
        }
        Map<String, Object> existing = loadTemplateById(normalizedTemplateId, true);
        if (existing == null) {
            return badRequest("Шаблон печатной формы не найден");
        }
        Map<String, Object> body = normalizeBody(rawBody);
        String name = body.containsKey("name") ? normalizeText(body.get("name")) : normalizeText(existing.get("name"));
        String code = body.containsKey("code") ? normalizeText(body.get("code")) : normalizeText(existing.get("code"));
        String description = body.containsKey("description")
            ? normalizeText(body.get("description"))
            : normalizeText(existing.get("description"));
        String dataSql = body.containsKey("dataSql") ? normalizeText(body.get("dataSql")) : normalizeText(existing.get("data_sql"));
        if (name == null) {
            return badRequest("Параметр name обязателен");
        }
        if (dataSql == null) {
            return badRequest("Параметр dataSql обязателен");
        }
        String sqlValidationError = validateTemplateDataSql(dataSql);
        if (sqlValidationError != null) {
            return badRequest(sqlValidationError);
        }
        byte[] templatePdf = existing.get("template_pdf") instanceof byte[] data ? data : null;
        if (body.containsKey("templatePdfBase64")) {
            String templatePdfBase64 = normalizeText(body.get("templatePdfBase64"));
            if (templatePdfBase64 == null) {
                return badRequest("Параметр templatePdfBase64 не может быть пустым");
            }
            try {
                templatePdf = Base64.getDecoder().decode(templatePdfBase64);
            } catch (Exception exception) {
                return badRequest("Параметр templatePdfBase64 должен быть валидным base64");
            }
        }
        if (templatePdf == null || templatePdf.length == 0) {
            return badRequest("Шаблон PDF отсутствует");
        }
        List<Map<String, Object>> fieldMapping = body.containsKey("fieldMapping")
            ? parseFieldMapping(body.get("fieldMapping"))
            : parseFieldMapping(existing.get("field_mapping"));
        if (fieldMapping == null) {
            return badRequest("Параметр fieldMapping должен быть JSON-массивом");
        }
        Map<String, Object> overlaySettings = body.containsKey("overlaySettings")
            ? parseJsonObject(body.get("overlaySettings"), null)
            : parseJsonObject(existing.get("overlay_settings"), mapOf());
        if (overlaySettings == null) {
            return badRequest("Параметр overlaySettings должен быть JSON-объектом");
        }
        try {
            int updated = printFormTemplateRepository.updateNamed(
                """
                update public.print_form_templates
                set code = :code,
                    name = :name,
                    name_eng = :nameEng,
                    description = :description,
                    template_pdf = :templatePdf,
                    data_sql = :dataSql,
                    field_mapping = cast(:fieldMappingJson as jsonb),
                    overlay_settings = cast(:overlaySettingsJson as jsonb),
                    updated_at = now()
                where id = cast(:templateId as uuid)
                  and deleted = false
                """,
                new UpdateTemplateParams(
                    normalizedTemplateId,
                    code,
                    name,
                    name,
                    description,
                    templatePdf,
                    dataSql,
                    toJson(fieldMapping),
                    toJson(overlaySettings)
                )
            );
            if (updated == 0) {
                return badRequest("Шаблон печатной формы не найден");
            }
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "item", mapTemplateForResponse(loadTemplateById(normalizedTemplateId, true))
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка сохранения шаблона печатной формы");
        }
    }

    public ResponseEntity<Map<String, Object>> printFormTemplateDataPreview(
        String templateId,
        Map<String, Object> rawBody
    ) {
        String normalizedTemplateId = normalizeText(templateId);
        if (!isUuid(normalizedTemplateId)) {
            return badRequest("Параметр templateId должен быть UUID");
        }
        Map<String, Object> template = loadTemplateById(normalizedTemplateId, false);
        if (template == null) {
            return badRequest("Шаблон печатной формы не найден");
        }
        String dataSql = normalizeText(template.get("data_sql"));
        String sqlValidationError = validateTemplateDataSql(dataSql);
        if (sqlValidationError != null) {
            return badRequest(sqlValidationError);
        }
        Map<String, Object> body = normalizeBody(rawBody);
        Map<String, Object> parameters = parseJsonObject(body.get("parameters"), mapOf());
        if (parameters == null) {
            return badRequest("Параметр parameters должен быть JSON-объектом");
        }
        try {
            List<Map<String, Object>> rows = printFormTemplateRepository.queryForNamedList(
                "select * from (" + dataSql + ") print_form_data_preview limit 1",
                new MapSqlParameterSource(parameters)
            );
            Map<String, Object> row = rows.isEmpty() ? mapOf() : rows.get(0);
            return ResponseEntity.ok(mapOf(
                "ok", true,
                "columns", new ArrayList<>(row.keySet()),
                "row", row
            ));
        } catch (Exception exception) {
            return serverError(exception, "Ошибка предпросмотра данных для шаблона");
        }
    }

    public ResponseEntity<?> renderPrintFormTemplatePdf(
        String templateId,
        Map<String, Object> rawBody
    ) {
        String normalizedTemplateId = normalizeText(templateId);
        if (!isUuid(normalizedTemplateId)) {
            return badRequest("Параметр templateId должен быть UUID");
        }
        Map<String, Object> template = loadTemplateById(normalizedTemplateId, true);
        if (template == null) {
            return badRequest("Шаблон печатной формы не найден");
        }
        byte[] sourcePdf = template.get("template_pdf") instanceof byte[] value ? value : null;
        if (sourcePdf == null || sourcePdf.length == 0) {
            return badRequest("В шаблоне отсутствует PDF");
        }
        String dataSql = normalizeText(template.get("data_sql"));
        String sqlValidationError = validateTemplateDataSql(dataSql);
        if (sqlValidationError != null) {
            return badRequest(sqlValidationError);
        }
        List<Map<String, Object>> fieldMapping = parseFieldMapping(template.get("field_mapping"));
        if (fieldMapping == null) {
            return badRequest("Невалидный field_mapping в шаблоне");
        }
        Map<String, Object> rawOverlaySettings = parseJsonObject(template.get("overlay_settings"), mapOf());
        if (rawOverlaySettings == null) {
            rawOverlaySettings = mapOf();
        }
        Map<String, Object> body = normalizeBody(rawBody);
        Map<String, Object> parameters = parseJsonObject(body.get("parameters"), mapOf());
        if (parameters == null) {
            return badRequest("Параметр parameters должен быть JSON-объектом");
        }
        Map<String, Object> overrideOverlay = parseJsonObject(body.get("overlay"), mapOf());
        if (overrideOverlay == null) {
            return badRequest("Параметр overlay должен быть JSON-объектом");
        }
        String overlayText = normalizeText(body.get("overlayText"));
        try {
            List<Map<String, Object>> rows = printFormTemplateRepository.queryForNamedList(
                "select * from (" + dataSql + ") print_form_data_source limit 1",
                new MapSqlParameterSource(parameters)
            );
            if (rows.isEmpty()) {
                return badRequest("По заданным параметрам не найдены данные для заполнения шаблона");
            }
            Map<String, Object> row = rows.get(0);
            byte[] rendered = printFormTemplatePdfService.renderPdf(
                sourcePdf,
                row,
                fieldMapping,
                rawOverlaySettings,
                overrideOverlay,
                overlayText
            );
            String fileName = printFormTemplatePdfService.createPdfFileName(normalizeText(template.get("name")));
            return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    ContentDisposition.attachment().filename(fileName).build().toString()
                )
                .body(rendered);
        } catch (Exception exception) {
            return serverError(exception, "Ошибка формирования PDF по шаблону");
        }
    }

    private Map<String, Object> loadTemplateById(String templateId, boolean withPdf) {
        return printFormTemplateRepository.findTemplateById(templateId, withPdf);
    }

    private Map<String, Object> mapTemplateForResponse(Map<String, Object> row) {
        if (row == null) {
            return mapOf();
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.get("id"));
        result.put("code", row.get("code"));
        result.put("name", row.get("name"));
        result.put("nameEng", row.get("name_eng"));
        result.put("description", row.get("description"));
        result.put("dataSql", row.get("data_sql"));
        result.put("fieldMapping", parseFieldMapping(row.get("field_mapping")));
        result.put("overlaySettings", parseJsonObject(row.get("overlay_settings"), mapOf()));
        result.put("createdAt", row.get("created_at"));
        result.put("updatedAt", row.get("updated_at"));
        byte[] pdf = row.get("template_pdf") instanceof byte[] value ? value : null;
        if (pdf != null) {
            result.put("templatePdfBase64", Base64.getEncoder().encodeToString(pdf));
        }
        return result;
    }

    private String validateTemplateDataSql(String dataSql) {
        String normalized = normalizeText(dataSql);
        if (normalized == null) {
            return "Параметр dataSql обязателен";
        }
        String compact = normalized.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        if (!compact.startsWith("select ")) {
            return "Параметр dataSql должен начинаться с SELECT";
        }
        if (compact.contains(";")) {
            return "Параметр dataSql не должен содержать ';'";
        }
        if (
            compact.contains(" insert ") ||
            compact.contains(" update ") ||
            compact.contains(" delete ") ||
            compact.contains(" drop ") ||
            compact.contains(" alter ") ||
            compact.contains(" create ") ||
            compact.contains(" truncate ")
        ) {
            return "Параметр dataSql содержит недопустимую SQL-операцию";
        }
        return null;
    }

    private List<Map<String, Object>> parseFieldMapping(Object value) {
        try {
            JsonNode node = readJson(value);
            if (node == null) {
                return List.of();
            }
            if (!node.isArray()) {
                return null;
            }
            return objectMapper.convertValue(node, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception exception) {
            return null;
        }
    }

    private Map<String, Object> parseJsonObject(Object value, Map<String, Object> defaultValue) {
        try {
            JsonNode node = readJson(value);
            if (node == null || node.isNull()) {
                return defaultValue;
            }
            if (!node.isObject()) {
                return null;
            }
            return objectMapper.convertValue(node, new TypeReference<Map<String, Object>>() {});
        } catch (Exception exception) {
            return null;
        }
    }

    private JsonNode readJson(Object value) throws Exception {
        if (value == null) {
            return null;
        }
        if (value instanceof JsonNode node) {
            return node;
        }
        if (value instanceof String text) {
            String normalized = text.trim();
            if (normalized.isEmpty()) {
                return null;
            }
            return objectMapper.readTree(normalized);
        }
        return objectMapper.valueToTree(value);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new RuntimeException("Ошибка сериализации JSON", exception);
        }
    }

    private int parseInt(Object value, int defaultValue, int min, int max) {
        if (value == null) {
            return defaultValue;
        }
        try {
            int parsed = Integer.parseInt(String.valueOf(value).trim());
            if (parsed < min) {
                return min;
            }
            return Math.min(parsed, max);
        } catch (Exception ignored) {
            return defaultValue;
        }
    }

    private String normalizeText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private boolean isUuid(String value) {
        if (value == null) {
            return false;
        }
        return value.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
    }

    private Map<String, Object> normalizeBody(Map<String, Object> rawBody) {
        return rawBody == null ? new LinkedHashMap<>() : new LinkedHashMap<>(rawBody);
    }

    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.badRequest().body(mapOf("ok", false, "error", message));
    }

    private ResponseEntity<Map<String, Object>> serverError(Exception exception, String message) {
        String details = normalizeText(exception.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf(
            "ok", false,
            "error", message,
            "details", details
        ));
    }

    private Map<String, Object> mapOf(Object... values) {
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        if (values == null) {
            return result;
        }
        for (int i = 0; i + 1 < values.length; i += 2) {
            result.put(String.valueOf(values[i]), values[i + 1]);
        }
        return result;
    }

    private record CreateTemplateParams(
        String id,
        String code,
        String name,
        String nameEng,
        String description,
        byte[] templatePdf,
        String dataSql,
        String fieldMappingJson,
        String overlaySettingsJson
    ) {
    }

    private record UpdateTemplateParams(
        String templateId,
        String code,
        String name,
        String nameEng,
        String description,
        byte[] templatePdf,
        String dataSql,
        String fieldMappingJson,
        String overlaySettingsJson
    ) {
    }

}
