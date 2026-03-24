package com.employees.backend.controller;

import com.employees.backend.service.RelationService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/admin", "/api"})
public class RelationController {

    private final RelationService relationService;

    public RelationController(
        RelationService relationService
    ) {
        this.relationService = relationService;
    }

    @PostMapping("/relation/{employeeId}")
    public ResponseEntity<Map<String, Object>> relationsPost(
        @PathVariable("employeeId") String employeeId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return relationService.relationsPost(employeeId, rawBody);
    }

    @PostMapping("/relations")
    public ResponseEntity<Map<String, Object>> relationsPagePost(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return relationService.relationsPostAll(rawBody);
    }

    @PostMapping("/relations/export")
    public ResponseEntity<?> relationsExport(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return relationService.relationsExport(rawBody);
    }

    @PostMapping("/relation")
    public ResponseEntity<Map<String, Object>> relationCreate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return relationService.relationCreate(rawBody);
    }

    @PatchMapping("/relation/{relationId}")
    public ResponseEntity<Map<String, Object>> relationUpdate(
        @PathVariable("relationId") String relationId,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return relationService.relationUpdate(relationId, rawBody);
    }

    @DeleteMapping("/relation/{relationId}")
    public ResponseEntity<Map<String, Object>> relationDelete(
        @PathVariable("relationId") String relationId
    ) {
        return relationService.relationDelete(relationId);
    }
}
