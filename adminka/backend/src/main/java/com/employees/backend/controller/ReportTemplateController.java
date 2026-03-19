package com.employees.backend.controller;

import com.employees.backend.service.ReportTemplateExecuteService;
import com.employees.backend.service.ReportTemplateSqlService;
import com.employees.backend.service.ReportTemplateService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/admin", "/api"})
public class ReportTemplateController {

    private final ReportTemplateService reportTemplateService;
    private final ReportTemplateSqlService reportTemplateSqlService;
    private final ReportTemplateExecuteService reportTemplateExecuteService;

    public ReportTemplateController(
        ReportTemplateService reportTemplateService,
        ReportTemplateSqlService reportTemplateSqlService,
        ReportTemplateExecuteService reportTemplateExecuteService
    ) {
        this.reportTemplateService = reportTemplateService;
        this.reportTemplateSqlService = reportTemplateSqlService;
        this.reportTemplateExecuteService = reportTemplateExecuteService;
    }

    @GetMapping("/report-templates")
    public ResponseEntity<Map<String, Object>> reportTemplatesGet() {
        return reportTemplateService.reportTemplatesGet();
    }

    @PostMapping("/report-template")
    public ResponseEntity<Map<String, Object>> createReportTemplate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.createReportTemplate(rawBody);
    }

    @PostMapping("/report-templates/create")
    public ResponseEntity<Map<String, Object>> createReportTemplateAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.createReportTemplate(rawBody);
    }

    @PostMapping("/report-templates")
    public ResponseEntity<Map<String, Object>> reportTemplatesPost(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.reportTemplatesPost(rawBody);
    }

    @PatchMapping("/report-template/{reportTemplateId}")
    public ResponseEntity<Map<String, Object>> updateReportTemplateMainSettings(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.updateMainSettings(reportTemplateId, rawBody);
    }

    @PatchMapping("/report-templates/{reportTemplateId}")
    public ResponseEntity<Map<String, Object>> updateReportTemplateMainSettingsAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.updateMainSettings(reportTemplateId, rawBody);
    }

    @DeleteMapping("/report-template/{reportTemplateId}")
    public ResponseEntity<Map<String, Object>> deleteReportTemplate(
        @PathVariable("reportTemplateId") String reportTemplateId
    ) {
        return reportTemplateService.deleteTemplate(reportTemplateId);
    }

    @DeleteMapping("/report-templates/{reportTemplateId}")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateAlias(
        @PathVariable("reportTemplateId") String reportTemplateId
    ) {
        return reportTemplateService.deleteTemplate(reportTemplateId);
    }

    @PostMapping("/report-template/sql/validate")
    public ResponseEntity<Map<String, Object>> validateReportTemplateSql(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateSqlService.validateReportTemplateSql(rawBody);
    }

    @PostMapping("/report-templates/sql/validate")
    public ResponseEntity<Map<String, Object>> validateReportTemplatesSqlAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateSqlService.validateReportTemplateSql(rawBody);
    }

    @DeleteMapping("/report-template/{reportTemplateId}/organizations/{organUnitId}")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateOrganization(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @PathVariable("organUnitId") String organUnitId
    ) {
        return reportTemplateService.deleteReportTemplateOrganization(reportTemplateId, organUnitId);
    }

    @DeleteMapping("/report-templates/{reportTemplateId}/organizations/{organUnitId}")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateOrganizationAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @PathVariable("organUnitId") String organUnitId
    ) {
        return reportTemplateService.deleteReportTemplateOrganization(reportTemplateId, organUnitId);
    }

    @DeleteMapping("/report-template/{reportTemplateId}/access-groups")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateAccessGroup(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestParam("codeAccess") String codeAccess
    ) {
        return reportTemplateService.deleteReportTemplateAccessGroup(reportTemplateId, codeAccess);
    }

    @DeleteMapping("/report-templates/{reportTemplateId}/access-groups")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateAccessGroupAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestParam("codeAccess") String codeAccess
    ) {
        return reportTemplateService.deleteReportTemplateAccessGroup(reportTemplateId, codeAccess);
    }

    @PostMapping("/report-template/{reportTemplateId}/organizations")
    public ResponseEntity<Map<String, Object>> addReportTemplateOrganization(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.addReportTemplateOrganization(reportTemplateId, rawBody);
    }

    @PostMapping("/report-templates/{reportTemplateId}/organizations")
    public ResponseEntity<Map<String, Object>> addReportTemplateOrganizationAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.addReportTemplateOrganization(reportTemplateId, rawBody);
    }

    @PostMapping("/report-template/{reportTemplateId}/access-groups")
    public ResponseEntity<Map<String, Object>> addReportTemplateAccessGroup(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.addReportTemplateAccessGroup(reportTemplateId, rawBody);
    }

    @PostMapping("/report-templates/{reportTemplateId}/access-groups")
    public ResponseEntity<Map<String, Object>> addReportTemplateAccessGroupAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.addReportTemplateAccessGroup(reportTemplateId, rawBody);
    }

    @DeleteMapping("/report-template/{reportTemplateId}/recipients")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateRecipient(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestParam("email") String email
    ) {
        return reportTemplateService.deleteReportTemplateRecipient(reportTemplateId, email);
    }

    @DeleteMapping("/report-templates/{reportTemplateId}/recipients")
    public ResponseEntity<Map<String, Object>> deleteReportTemplateRecipientAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestParam("email") String email
    ) {
        return reportTemplateService.deleteReportTemplateRecipient(reportTemplateId, email);
    }

    @PostMapping("/report-template/{reportTemplateId}/recipients")
    public ResponseEntity<Map<String, Object>> addReportTemplateRecipient(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.addReportTemplateRecipient(reportTemplateId, rawBody);
    }

    @PostMapping("/report-templates/{reportTemplateId}/recipients")
    public ResponseEntity<Map<String, Object>> addReportTemplateRecipientAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.addReportTemplateRecipient(reportTemplateId, rawBody);
    }

    @PostMapping("/report-template/sql/execute-check")
    public ResponseEntity<Map<String, Object>> executeCheckReportTemplateSql(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateSqlService.executeCheckReportTemplateSql(rawBody);
    }

    @PostMapping("/report-templates/sql/execute-check")
    public ResponseEntity<Map<String, Object>> executeCheckReportTemplatesSqlAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateSqlService.executeCheckReportTemplateSql(rawBody);
    }

    @PostMapping("/report-template/sql/results")
    public ResponseEntity<Map<String, Object>> reportTemplateSqlResults(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateSqlService.reportTemplateSqlResults(rawBody);
    }

    @PostMapping("/report-templates/sql/results")
    public ResponseEntity<Map<String, Object>> reportTemplatesSqlResultsAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateSqlService.reportTemplateSqlResults(rawBody);
    }

    @PostMapping("/report-template/execute")
    public ResponseEntity<?> executeReportTemplate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateExecuteService.executeReportTemplate(rawBody);
    }

    @PostMapping("/report-templates/execute")
    public ResponseEntity<?> executeReportTemplateAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateExecuteService.executeReportTemplate(rawBody);
    }

    @PostMapping("/report-template/excel-preview")
    public ResponseEntity<?> reportTemplateExcelPreview(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateExecuteService.reportTemplateExcelPreview(rawBody);
    }

    @PostMapping("/report-templates/excel-preview")
    public ResponseEntity<?> reportTemplatesExcelPreviewAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateExecuteService.reportTemplateExcelPreview(rawBody);
    }

    @PostMapping("/report-template/excel")
    public ResponseEntity<?> reportTemplateExcelExport(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateExecuteService.reportTemplateExcelExport(rawBody);
    }

    @PostMapping("/report-templates/excel")
    public ResponseEntity<?> reportTemplatesExcelExportAlias(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateExecuteService.reportTemplateExcelExport(rawBody);
    }

    @PatchMapping("/report-template/{reportTemplateId}/sql")
    public ResponseEntity<Map<String, Object>> updateReportTemplateSql(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateSqlService.updateReportTemplateSql(reportTemplateId, rawBody);
    }

    @PatchMapping("/report-templates/{reportTemplateId}/sql")
    public ResponseEntity<Map<String, Object>> updateReportTemplatesSqlAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateSqlService.updateReportTemplateSql(reportTemplateId, rawBody);
    }

    @GetMapping("/report-template/{reportTemplateId}/template-settings")
    public ResponseEntity<Map<String, Object>> reportTemplateSettingsGet(
        @PathVariable("reportTemplateId") String reportTemplateId
    ) {
        return reportTemplateService.reportTemplateSettingsGet(reportTemplateId);
    }

    @GetMapping("/report-templates/{reportTemplateId}/template-settings")
    public ResponseEntity<Map<String, Object>> reportTemplatesSettingsGetAlias(
        @PathVariable("reportTemplateId") String reportTemplateId
    ) {
        return reportTemplateService.reportTemplateSettingsGet(reportTemplateId);
    }

    @PatchMapping("/report-template/{reportTemplateId}/template-settings")
    public ResponseEntity<Map<String, Object>> updateReportTemplateSettings(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.updateReportTemplateSettings(reportTemplateId, rawBody);
    }

    @PatchMapping("/report-templates/{reportTemplateId}/template-settings")
    public ResponseEntity<Map<String, Object>> updateReportTemplatesSettingsAlias(
        @PathVariable("reportTemplateId") String reportTemplateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return reportTemplateService.updateReportTemplateSettings(reportTemplateId, rawBody);
    }
}
