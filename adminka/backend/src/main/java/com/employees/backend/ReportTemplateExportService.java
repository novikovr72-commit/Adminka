package com.employees.backend;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class ReportTemplateExportService {

    public ResponseEntity<?> executeReportTemplate(
        Map<String, Object> rawBody,
        Function<Map<String, Object>, ResponseEntity<?>> previewHandler,
        Function<Map<String, Object>, ResponseEntity<?>> exportHandler
    ) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        boolean preview = toBooleanOrDefault(body.get("preview"), false);
        if (preview && !body.containsKey("limit")) {
            LinkedHashMap<String, Object> previewBody = new LinkedHashMap<>(body);
            previewBody.put("limit", 50);
            return previewHandler.apply(previewBody);
        }
        return preview ? previewHandler.apply(body) : exportHandler.apply(body);
    }

    public ResponseEntity<?> reportTemplateExcelPreview(
        Map<String, Object> rawBody,
        Function<Map<String, Object>, ResponseEntity<?>> previewHandler
    ) {
        return previewHandler.apply(normalizeRequestBody(rawBody));
    }

    public ResponseEntity<?> reportTemplateExcelExport(
        Map<String, Object> rawBody,
        Function<Map<String, Object>, ResponseEntity<?>> exportHandler
    ) {
        return exportHandler.apply(normalizeRequestBody(rawBody));
    }

    private Map<String, Object> normalizeRequestBody(Map<String, Object> rawBody) {
        return rawBody == null ? new LinkedHashMap<>() : new LinkedHashMap<>(rawBody);
    }

    private boolean toBooleanOrDefault(Object value, boolean defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Boolean boolValue) {
            return boolValue;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        String text = String.valueOf(value).trim().toLowerCase();
        if (text.isEmpty()) {
            return defaultValue;
        }
        if (text.equals("true") || text.equals("1") || text.equals("yes") || text.equals("y") || text.equals("да")) {
            return true;
        }
        if (text.equals("false") || text.equals("0") || text.equals("no") || text.equals("n") || text.equals("нет")) {
            return false;
        }
        return defaultValue;
    }
}
