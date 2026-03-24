package com.employees.backend;

import com.employees.backend.repository.ReportTemplateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ReportTemplateExcelFacade {
    private final ReportTemplateExcelCore reportTemplateExcelCore;

    public ReportTemplateExcelFacade(
        JdbcTemplate jdbcTemplate,
        ReportTemplateRepository reportTemplateRepository,
        ObjectMapper objectMapper,
        @Value("${app.logs-dir:backend/logs}") String logsDir,
        @Value("${app.frontend-base-url:http://localhost:5175}") String frontendBaseUrl,
        @Value("${app.dadata.find-party-url:https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party}") String dadataFindPartyUrl,
        @Value("${app.dadata.api-token:}") String dadataApiToken,
        AppReportTemplateProperties reportTemplateProperties
    ) {
        this.reportTemplateExcelCore = new ReportTemplateExcelCore(
            jdbcTemplate,
            reportTemplateRepository,
            objectMapper,
            logsDir,
            frontendBaseUrl,
            dadataFindPartyUrl,
            dadataApiToken,
            reportTemplateProperties == null ? null : reportTemplateProperties.getExcelMaxRows(),
            reportTemplateProperties == null ? null : reportTemplateProperties.getExcelTimezone()
        );
    }

    public ResponseEntity<?> reportTemplateExcelPreviewDirect(Map<String, Object> rawBody) {
        return reportTemplateExcelCore.reportTemplateExcelPreviewInternal(rawBody);
    }

    public ResponseEntity<?> reportTemplateExcelExportDirect(Map<String, Object> rawBody) {
        return reportTemplateExcelCore.reportTemplateExcelExportInternal(rawBody);
    }
}
