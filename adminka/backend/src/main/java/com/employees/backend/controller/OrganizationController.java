package com.employees.backend.controller;

import com.employees.backend.service.OrganizationService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/admin", "/api"})
public class OrganizationController {

    private final OrganizationService organizationService;

    public OrganizationController(
        OrganizationService organizationService
    ) {
        this.organizationService = organizationService;
    }

    @PostMapping("/organization/{organUnitId}/dadata/refresh")
    public ResponseEntity<Map<String, Object>> refreshOrganizationDadata(
        @PathVariable("organUnitId") String organUnitIdRaw
    ) {
        return organizationService.refreshOrganizationDadata(organUnitIdRaw);
    }

    @GetMapping("/organizations")
    public ResponseEntity<Map<String, Object>> organizationsGet() {
        return organizationService.organizationsGet();
    }

    @GetMapping("/organization/{organUnitId}")
    public ResponseEntity<Map<String, Object>> organizationDetails(
        @PathVariable("organUnitId") String organUnitIdRaw
    ) {
        return organizationService.organizationDetails(organUnitIdRaw);
    }

    @PatchMapping("/organization/{organUnitId}")
    public ResponseEntity<Map<String, Object>> updateOrganization(
        @PathVariable("organUnitId") String organUnitIdRaw,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return organizationService.organizationUpdate(organUnitIdRaw, rawBody);
    }

    @PostMapping("/organizations")
    public ResponseEntity<Map<String, Object>> organizationsPost(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return organizationService.organizationsPost(rawBody);
    }

    @PostMapping("/organizations/export")
    public ResponseEntity<?> organizationsExport(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return organizationService.organizationsExport(rawBody);
    }

    @DeleteMapping("/organization/{organUnitId}")
    public ResponseEntity<Map<String, Object>> organizationDelete(
        @PathVariable("organUnitId") String organUnitId
    ) {
        return organizationService.deleteOrganization(organUnitId);
    }
}
