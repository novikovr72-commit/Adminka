package com.employees.backend.controller;

import com.employees.backend.service.EmployeeService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/admin", "/api"})
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(
        EmployeeService employeeService
    ) {
        this.employeeService = employeeService;
    }

    @GetMapping("/employees")
    public ResponseEntity<Map<String, Object>> employeesGet() {
        return employeeService.employeesGet();
    }

    @PostMapping("/employees")
    public ResponseEntity<Map<String, Object>> employeesPost(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return employeeService.employeesPost(rawBody);
    }

    @PostMapping("/employees/export")
    public ResponseEntity<?> employeesExport(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return employeeService.employeesExport(rawBody);
    }

    @PostMapping("/employees/import")
    public ResponseEntity<Map<String, Object>> employeesImport(
        @RequestPart("file") MultipartFile file,
        @RequestParam(name = "delete_missing", required = false) String deleteMissingSnakeRaw,
        @RequestParam(name = "deleteMissing", required = false) String deleteMissingCamelRaw,
        HttpServletRequest request
    ) {
        return employeeService.employeesImport(file, deleteMissingSnakeRaw, deleteMissingCamelRaw, request);
    }

    @PatchMapping("/employee/{employeeId}")
    public ResponseEntity<Map<String, Object>> employeeUpdate(
        @PathVariable("employeeId") String employeeIdRaw,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return employeeService.employeeUpdate(employeeIdRaw, rawBody);
    }

    @PostMapping("/employee")
    public ResponseEntity<Map<String, Object>> employeeCreate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return employeeService.employeeCreate(rawBody);
    }

    @DeleteMapping("/employee/{employeeId}")
    public ResponseEntity<Map<String, Object>> employeeDelete(
        @PathVariable("employeeId") String employeeIdRaw
    ) {
        return employeeService.employeeDelete(employeeIdRaw);
    }

    @DeleteMapping("/employee-position/{employeeOrganId}")
    public ResponseEntity<Map<String, Object>> employeePositionDelete(
        @PathVariable("employeeOrganId") String employeeOrganId
    ) {
        return employeeService.employeePositionDelete(employeeOrganId);
    }

    @PostMapping("/employee-position")
    public ResponseEntity<Map<String, Object>> employeePositionCreate(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return employeeService.employeePositionCreate(rawBody);
    }

    @PatchMapping("/employee-position/{employeeOrganId}")
    public ResponseEntity<Map<String, Object>> employeePositionUpdate(
        @PathVariable("employeeOrganId") String employeeOrganIdRaw,
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return employeeService.employeePositionUpdate(employeeOrganIdRaw, rawBody);
    }
}
