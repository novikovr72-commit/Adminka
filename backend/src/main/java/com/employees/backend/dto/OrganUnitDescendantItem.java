package com.employees.backend.dto;

import java.util.List;

/**
 * Подразделение в дереве потомков с сотрудниками.
 */
public record OrganUnitDescendantItem(
    String organUnitChildId,
    String organUnitName,
    String organUnitShort,
    String organUnitCode,
    String organUnitHierarchy,
    String kcehNumber,
    List<OrganUnitDescendantEmployeeItem> employees
) {
}
