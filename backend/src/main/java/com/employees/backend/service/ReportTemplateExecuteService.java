package com.employees.backend.service;

import com.employees.backend.ReportTemplateExcelFacade;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class ReportTemplateExecuteService {
    private final ReportTemplateExcelFacade excelFacade;

    public ReportTemplateExecuteService(ReportTemplateExcelFacade excelFacade) {
        this.excelFacade = excelFacade;
    }

    public ResponseEntity<?> executeReportTemplate(Map<String, Object> rawBody) {
        Map<String, Object> body = normalizeRequestBody(rawBody);
        boolean preview = toBooleanOrDefault(body.get("preview"), false);
        if (preview && !body.containsKey("limit")) {
            LinkedHashMap<String, Object> previewBody = new LinkedHashMap<>(body);
            previewBody.put("limit", 50);
            return reportTemplateExcelPreviewInternal(previewBody);
        }
        return preview ? reportTemplateExcelPreviewInternal(body) : reportTemplateExcelExportInternal(body);
    }

    public ResponseEntity<?> reportTemplateExcelPreview(Map<String, Object> rawBody) {
        return reportTemplateExcelPreviewInternal(normalizeRequestBody(rawBody));
    }

    public ResponseEntity<?> reportTemplateExcelExport(Map<String, Object> rawBody) {
        return reportTemplateExcelExportInternal(normalizeRequestBody(rawBody));
    }

    private ResponseEntity<?> reportTemplateExcelPreviewInternal(Map<String, Object> rawBody) {
        return excelFacade.reportTemplateExcelPreviewDirect(rawBody);
    }

    private ResponseEntity<?> reportTemplateExcelExportInternal(Map<String, Object> rawBody) {
        return excelFacade.reportTemplateExcelExportDirect(rawBody);
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
