package com.employees.backend.dto;

/**
 * Строка иерархии подразделений под выбранной организацией (ответ API).
 */
public record OrganUnitDescendantRow(
    String organUnitChildId,
    String organUnitName,
    String organUnitShort,
    String organUnitCode,
    String organUnitHierarchy,
    String kcehNumber
) {
}
