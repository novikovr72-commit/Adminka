package com.employees.backend.dto;

/**
 * Строка выборки сотрудников по подразделению (для группировки в сервисе).
 */
public record OrganUnitDescendantEmployeeRow(
    String organUnitChildId,
    String employeeOrganId,
    String employeeId,
    String employeeParentId,
    String employeeParentName,
    String employeeFullName,
    String employeePositionId,
    String employeePositionName
) {
}
