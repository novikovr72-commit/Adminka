# Endpoints by Domain

## Employee (Сотрудники)

- `GET /api/admin/employees`
- `POST /api/admin/employees`
- `POST /api/admin/employees/export`
- `POST /api/admin/employees/import`
- `POST /api/admin/employee`
- `PATCH /api/admin/employee/{employeeId}`
- `DELETE /api/admin/employee/{employeeId}`
- `POST /api/admin/employee-position`
- `PATCH /api/admin/employee-position/{employeeOrganId}`
- `DELETE /api/admin/employee-position/{employeeOrganId}`

## Organization (Организации)

- `GET /api/admin/organizations`
- `POST /api/admin/organizations`
- `POST /api/admin/organizations/export`
- `GET /api/admin/organization/{organUnitId}`
- `PATCH /api/admin/organization/{organUnitId}`
- `DELETE /api/admin/organization/{organUnitId}`
- `POST /api/admin/organization/{organUnitId}/dadata/refresh`

## Relation (Связи)

- `POST /api/admin/relation/{employeeId}`
- `POST /api/admin/relations` (необязательное тело `organUnitId`: при передаче UUID организации выборка только связей с этой организацией)
- `POST /api/admin/relations/export` (то же необязательное поле `organUnitId`)
- `POST /api/admin/relation`
- `PATCH /api/admin/relation/{relationId}`
- `DELETE /api/admin/relation/{relationId}`

## ReportTemplate (Шаблоны отчетов)

- `GET /api/admin/report-templates`
- `POST /api/admin/report-template` (+ aliases)
- `PATCH /api/admin/report-template/{reportTemplateId}`
- `DELETE /api/admin/report-template/{reportTemplateId}`
- `POST /api/admin/report-template/sql/validate`
- `POST /api/admin/report-template/sql/execute-check`
- `POST /api/admin/report-template/sql/results`
- `PATCH /api/admin/report-template/{reportTemplateId}/sql`
- `POST /api/admin/report-template/execute`
- `POST /api/admin/report-template/excel-preview`
- `POST /api/admin/report-template/excel`
- `GET /api/admin/report-template/{reportTemplateId}/template-settings`
- `PATCH /api/admin/report-template/{reportTemplateId}/template-settings`
- `DELETE /api/admin/report-template/{reportTemplateId}/organizations/{organUnitId}`
- `POST /api/admin/report-template/{reportTemplateId}/organizations`
- `DELETE /api/admin/report-template/{reportTemplateId}/access-groups`
- `POST /api/admin/report-template/{reportTemplateId}/access-groups`

## PrintFormTemplate (Печатные формы)

- `POST /api/admin/print-form-template/recognize`
- `POST /api/admin/print-form-template`
- `POST /api/admin/print-form-templates`
- `GET /api/admin/print-form-template/{templateId}`
- `PATCH /api/admin/print-form-template/{templateId}`
- `POST /api/admin/print-form-template/{templateId}/data-preview`
- `POST /api/admin/print-form-template/{templateId}/render-pdf`

## SystemLookup / Health (Справочники и системные ручки)

- `GET /api/admin/health`
- `GET /api/admin/db-health`
- `POST /api/admin/dadata/party`
- `GET /api/admin/list_organizations`
- `GET /api/admin/list_organization_unit_types`
- `GET /api/admin/list_countries`
- `GET /api/admin/list_relations`
- `GET /api/admin/list_product_groups`
- `GET /api/admin/list_positions`
- `GET /api/admin/list_employees`
