# Regression Checklist: Architecture Refactor

Цель: быстро проверить, что после разнесения слоев (`controller/service/repository`) и выноса core-логики нет функциональных регрессий.

## 0) Health

- `GET /api/admin/health` -> `200`, `ok=true`.
- `GET /api/admin/db-health` -> `200`, доступ к БД.

## 1) Report Template: main + SQL + Excel

- `POST /api/report-template/create` (или alias) -> создается шаблон.
- `POST /api/report-templates` -> список, фильтры, сортировки.
- `PATCH /api/report-template/{id}/main-settings` -> поля сохраняются.
- `DELETE /api/report-template/{id}` -> удаление работает.

SQL:
- `POST /api/report-template/sql/validate`:
  - корректный `SELECT` -> `ok=true`;
  - невалидный SQL -> `ok=false`, ошибка с позицией.
- `POST /api/report-template/sql/check` -> возвращает `selectedRows`.
- `POST /api/report-template/sql/results` -> пагинация `rows/columns/totalRows`.
- `PATCH /api/report-template/{id}/sql` -> сохранение SQL.

Excel:
- `POST /api/report-template/excel/preview`:
  - отдает файл;
  - есть заголовки `X-Execution-Ms`, `X-Preview-Limit`.
- `POST /api/report-template/excel/export`:
  - отдает файл;
  - есть заголовки `X-Execution-Ms`, `X-Selected-Rows`.
- режим `method=HAND` без `roleNames` -> валидная ошибка.

## 2) Report Template: settings

- `GET /api/report-template/{id}/settings`:
  - корректный `reportInfo`;
  - `reportLogoBase64`/`reportLogoMimeType`.
- `PATCH /api/report-template/{id}/settings`:
  - обновление без логотипа;
  - обновление с логотипом;
  - `clearReportLogo=true`.

## 3) Print Form Template

- `POST /api/print-form-template/recognize` -> детект полей `{field}`.
- `POST /api/print-form-template/create` -> создание.
- `POST /api/print-form-templates` -> листинг.
- `GET /api/print-form-template/{id}` -> получение.
- `PATCH /api/print-form-template/{id}` -> обновление.
- `POST /api/print-form-template/{id}/data-preview` -> preview row.
- `POST /api/print-form-template/{id}/pdf` -> рендер PDF.

## 4) Employee / Relation / Organization / Lookup smoke

- Employee:
  - `POST /api/employees`;
  - CRUD employee-position (`create/update/delete`);
  - import/export.
- Relation:
  - list/create/update/delete;
  - export.
- Organization:
  - list/create/update/delete;
  - export.
- Lookup:
  - relation-type/product-group/position/system списки.

## 5) Build / test

- Backend compile:
  - `cd adminka/backend`
  - `./mvnw -DskipTests compile`
- Tests:
  - `./mvnw test`

Если на машине не установлен JRE/JDK:
- установить OpenJDK;
- повторить compile/test.
