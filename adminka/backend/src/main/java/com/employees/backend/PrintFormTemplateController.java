package com.employees.backend;

import com.employees.backend.service.PrintFormTemplateService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class PrintFormTemplateController {

    private final PrintFormTemplateService printFormTemplateService;

    public PrintFormTemplateController(
        PrintFormTemplateService printFormTemplateService
    ) {
        this.printFormTemplateService = printFormTemplateService;
    }

    @PostMapping("/print-form-template/recognize")
    public ResponseEntity<Map<String, Object>> recognizePrintFormTemplate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return printFormTemplateService.recognizePrintFormTemplate(rawBody);
    }

    @PostMapping("/print-form-template")
    public ResponseEntity<Map<String, Object>> createPrintFormTemplate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return printFormTemplateService.createPrintFormTemplate(rawBody);
    }

    @PostMapping("/print-form-templates")
    public ResponseEntity<Map<String, Object>> listPrintFormTemplates(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return printFormTemplateService.listPrintFormTemplates(rawBody);
    }

    @GetMapping("/print-form-template/{templateId}")
    public ResponseEntity<Map<String, Object>> getPrintFormTemplate(
        @PathVariable("templateId") String templateId
    ) {
        return printFormTemplateService.getPrintFormTemplate(templateId);
    }

    @PatchMapping("/print-form-template/{templateId}")
    public ResponseEntity<Map<String, Object>> updatePrintFormTemplate(
        @PathVariable("templateId") String templateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return printFormTemplateService.updatePrintFormTemplate(templateId, rawBody);
    }

    @PostMapping("/print-form-template/{templateId}/data-preview")
    public ResponseEntity<Map<String, Object>> previewPrintFormTemplateData(
        @PathVariable("templateId") String templateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return printFormTemplateService.printFormTemplateDataPreview(templateId, rawBody);
    }

    @PostMapping("/print-form-template/{templateId}/render-pdf")
    public ResponseEntity<?> renderPrintFormTemplatePdf(
        @PathVariable("templateId") String templateId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return printFormTemplateService.renderPrintFormTemplatePdf(templateId, rawBody);
    }
}
