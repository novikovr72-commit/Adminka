package com.employees.backend.dto;

/**
 * Сотрудник в подразделении (вложение в ответ потомков организации).
 */
public record OrganUnitDescendantEmployeeItem(
    String employeeOrganId,
    String employeeId,
    String employeeParentId,
    String employeeParentName,
    String employeeFullName,
    String employeePositionId,
    String employeePositionName
) {
}
