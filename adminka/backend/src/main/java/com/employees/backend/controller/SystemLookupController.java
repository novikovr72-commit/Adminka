package com.employees.backend.controller;

import com.employees.backend.service.EmployeeService;
import com.employees.backend.service.OrganizationService;
import com.employees.backend.service.RelationService;
import com.employees.backend.service.SystemLookupService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/admin", "/api"})
public class SystemLookupController {

    private final EmployeeService employeeService;
    private final OrganizationService organizationService;
    private final RelationService relationService;
    private final SystemLookupService systemLookupService;

    public SystemLookupController(
        OrganizationService organizationService,
        RelationService relationService,
        EmployeeService employeeService,
        SystemLookupService systemLookupService
    ) {
        this.organizationService = organizationService;
        this.relationService = relationService;
        this.employeeService = employeeService;
        this.systemLookupService = systemLookupService;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return systemLookupService.health();
    }

    @GetMapping("/db-health")
    public ResponseEntity<Map<String, Object>> dbHealth() {
        return systemLookupService.dbHealth();
    }

    @PostMapping("/dadata/party")
    public ResponseEntity<Map<String, Object>> dadataFindParty(
        @RequestBody(required = false) Map<String, Object> rawBody
    ) {
        return systemLookupService.dadataFindParty(rawBody);
    }

    @GetMapping("/list_organizations")
    public ResponseEntity<Map<String, Object>> listOrganizations(
        @RequestParam(name = "show_short_code", required = false) String showShortCodeSnakeRaw,
        @RequestParam(name = "showShortCode", required = false) String showShortCodeCamelRaw,
        @RequestParam(name = "organ_name", required = false) String organNameSnakeRaw,
        @RequestParam(name = "organName", required = false) String organNameCamelRaw
    ) {
        return organizationService.listOrganizations(showShortCodeSnakeRaw, showShortCodeCamelRaw, organNameSnakeRaw, organNameCamelRaw);
    }

    @GetMapping("/list_organization_unit_types")
    public ResponseEntity<Map<String, Object>> listOrganizationUnitTypes(
        @RequestParam(name = "name", required = false) String nameRaw
    ) {
        return organizationService.listOrganizationUnitTypes(nameRaw);
    }

    @GetMapping("/list_countries")
    public ResponseEntity<Map<String, Object>> listCountries(
        @RequestParam(name = "name", required = false) String nameRaw
    ) {
        return organizationService.listCountries(nameRaw);
    }

    @GetMapping("/list_relations")
    public ResponseEntity<Map<String, Object>> listRelations(
        @RequestParam(name = "relation_name", required = false) String relationNameSnakeRaw,
        @RequestParam(name = "relationName", required = false) String relationNameCamelRaw
    ) {
        return relationService.listRelations(relationNameSnakeRaw, relationNameCamelRaw);
    }

    @GetMapping("/list_product_groups")
    public ResponseEntity<Map<String, Object>> listProductGroups(
        @RequestParam(name = "product_group_name", required = false) String productGroupNameSnakeRaw,
        @RequestParam(name = "productGroupName", required = false) String productGroupNameCamelRaw
    ) {
        return relationService.listProductGroups(productGroupNameSnakeRaw, productGroupNameCamelRaw);
    }

    @GetMapping("/list_positions")
    public ResponseEntity<Map<String, Object>> listPositions(
        @RequestParam(name = "position_name", required = false) String positionNameSnakeRaw,
        @RequestParam(name = "positionName", required = false) String positionNameCamelRaw
    ) {
        return employeeService.listPositions(positionNameSnakeRaw, positionNameCamelRaw);
    }

    @GetMapping("/list_employees")
    public ResponseEntity<Map<String, Object>> listEmployees(
        @RequestParam(name = "departUnitId", required = false) String departUnitId,
        @RequestParam(name = "employeeId", required = false) String employeeId,
        @RequestParam(name = "employeeName", required = false) String employeeName
    ) {
        return employeeService.listEmployees(departUnitId, employeeId, employeeName);
    }
}
