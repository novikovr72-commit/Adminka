# Инструкция по интеграции вызова Excel-отчета через `adminka`

## 1. Назначение

Этот документ описывает, как backend другого модуля вызывает процедуру формирования отчета в Excel через API модуля `adminka`.

Процедура включает:
- выполнение SQL отчета;
- подстановку входных параметров;
- применение макета из `report_info`;
- генерацию файла `xlsx`;
- возврат файла и метрик выполнения.

---

## 2. Endpoint для интеграции

Основной единый endpoint:

- `POST /api/admin/report-template/execute`

Alias (совместимость):

- `POST /api/admin/report-templates/execute`

---

## 3. Контракт запроса

## 3.1 Body

```json
{
  "reportTemplateId": "uuid",
  "reportId": "uuid",
  "startReport": "YYYY-MM-DD",
  "endReport": "YYYY-MM-DD",
  "claimOrganizationId": "uuid",
  "roleNames": ["role1", "role2"],
  "preview": false,
  "limit": 50
}
```

## 3.2 Правила параметров

- `reportTemplateId` — обязательный UUID выбранного отчета из `report_templates`.
- `reportId` — UUID отчета (обычно совпадает с `reportTemplateId`).
- `startReport`, `endReport` — опционально:
  - если оба пустые, отчет формируется за весь период.
- `claimOrganizationId` — опционально, UUID.
- `roleNames`:
  - для `method = HAND` обязательно передавать;
  - для `AUTO` можно передать пустой массив.
- `preview`:
  - `true` -> preview-режим;
  - `false` или отсутствует -> полный отчет.
- `limit` — используется в preview (по умолчанию 50, максимум 500).
- `numberDays` извне **не передается**: backend берет значение из `report_templates.number_days`.

## 3.3 Источник параметров

- `startReport`, `endReport`, `claimOrganizationId` — из формы пользователя.
- `reportTemplateId`, `reportId` — из выбранного отчета.
- `roleNames` — из JWT (Keycloak), поля ролей:
  - `realm_access.roles`
  - `resource_access.<client>.roles`

---

## 4. Ответ и метрики

Успешный ответ:
- `200 OK`
- бинарный контент `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- имя файла в `Content-Disposition`.

Метрики в headers:
- `X-Execution-Ms`
- `X-Execution-Time`
- `X-Selected-Rows`
- `X-Query-Execution-Ms`
- `X-Template-Fill-Ms`
- `X-Query-Execution-Ns`
- `X-Template-Fill-Ns`
- `X-Preview-Limit` (preview)

Ошибки:
- `400` — ошибка параметров/валидации/SQL;
- `401/403` — проблемы авторизации/доступа;
- `500` — внутренняя ошибка.

---

## 5. Пошаговая интеграция в другом backend-модуле

1. Получить `reportTemplateId` выбранного отчета.
2. Принять из формы пользователя:
   - `startDate`, `endDate`, `claimOrganizationId`.
3. Из JWT пользователя извлечь роли -> `roleNames`.
4. Сформировать payload для `/api/admin/report-template/execute`.
5. Вызвать endpoint (proxy-call из вашего backend).
6. Вернуть клиенту файл и `Content-Disposition`.
7. Прокинуть метрики headers в лог/мониторинг.

---

## 6. Готовые заготовки кода

## 6.1 Java (Spring WebClient)

```java
var payload = Map.of(
    "reportTemplateId", reportTemplateId,
    "reportId", reportTemplateId,
    "startReport", startReport,   // optional
    "endReport", endReport,       // optional
    "claimOrganizationId", claimOrganizationId, // optional
    "roleNames", roleNames,
    "preview", false
);

var response = webClient.post()
    .uri("/api/admin/report-template/execute")
    .header("Authorization", "Bearer " + token)
    .contentType(MediaType.APPLICATION_JSON)
    .bodyValue(payload)
    .retrieve()
    .toEntity(byte[].class)
    .block();
```

## 6.2 Node.js (fetch)

```javascript
const resp = await fetch(`${ADMINKA_BASE_URL}/api/admin/report-template/execute`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    reportTemplateId,
    reportId: reportTemplateId,
    startReport,
    endReport,
    claimOrganizationId,
    roleNames,
    preview: false
  })
});

const fileBuffer = Buffer.from(await resp.arrayBuffer());
```

## 6.3 C# (HttpClient)

```csharp
var payload = new {
  reportTemplateId = reportTemplateId,
  reportId = reportTemplateId,
  startReport = startReport,
  endReport = endReport,
  claimOrganizationId = claimOrganizationId,
  roleNames = roleNames,
  preview = false
};

var req = new HttpRequestMessage(HttpMethod.Post, "/api/admin/report-template/execute");
req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
var resp = await httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
```

---

## 7. OpenAPI контракт (YAML)

```yaml
openapi: 3.0.3
info:
  title: My Module Report Export API
  version: 1.0.0
paths:
  /api/reports/export:
    post:
      summary: Сформировать Excel-отчет через adminka
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [reportTemplateId, reportId]
              properties:
                reportTemplateId: { type: string, format: uuid }
                reportId: { type: string, format: uuid }
                startReport: { type: string, format: date, nullable: true }
                endReport: { type: string, format: date, nullable: true }
                claimOrganizationId: { type: string, format: uuid, nullable: true }
                roleNames:
                  type: array
                  items: { type: string }
                preview: { type: boolean, default: false }
                limit: { type: integer, minimum: 1, maximum: 500, nullable: true }
      responses:
        "200":
          description: Excel file
          content:
            application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
              schema: { type: string, format: binary }
        "400":
          description: Validation/SQL error
```

---

## 8. Тесты (обязательный минимальный набор)

1. `AUTO`, без дат, `preview=false` -> 200 + файл.
2. `AUTO`, с датами -> 200 + файл.
3. `HAND`, без `roleNames` -> 400.
4. `HAND`, с `roleNames` -> 200 + файл.
5. `preview=true, limit=50` -> 200 + ограниченный файл.
6. невалидный UUID в `reportTemplateId`/`reportId`/`claimOrganizationId` -> 400.
7. несуществующий `reportTemplateId` -> 400.
8. проверить, что `numberDays` берется из БД, а не из внешнего payload.

---

## 9. CI-проверки OpenAPI

## 9.1 npm

```bash
npm i -D @apidevtools/swagger-cli
npx @apidevtools/swagger-cli validate docs/api/openapi-report-export.json
```

## 9.2 GitHub Actions (минимальный job)

```yaml
name: OpenAPI Contract Check
on: [pull_request]
jobs:
  validate-openapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm i -g @apidevtools/swagger-cli
      - run: swagger-cli validate docs/api/openapi-report-export.json
```

---

## 10. Makefile для контрактных проверок

```makefile
OPENAPI_FILE ?= docs/api/openapi-report-export.json
OPENAPI_BUNDLE ?= docs/api/openapi-report-export.bundle.json
MODULE_BASE_URL ?= http://localhost:8080
TEST_JWT ?=
REPORT_TEMPLATE_ID ?= 406a345a-d3e3-4fff-a3c4-88529fddee3d

SWAGGER_CLI = npx @apidevtools/swagger-cli

.PHONY: openapi-validate openapi-bundle openapi-smoke openapi-clean

openapi-validate:
	$(SWAGGER_CLI) validate "$(OPENAPI_FILE)"

openapi-bundle:
	$(SWAGGER_CLI) bundle "$(OPENAPI_FILE)" -o "$(OPENAPI_BUNDLE)" -t json

openapi-smoke:
	@test -n "$(TEST_JWT)" || (echo "ERROR: TEST_JWT is empty" && exit 1)
	curl -f -X POST "$(MODULE_BASE_URL)/api/reports/export" \
	  -H "Content-Type: application/json" \
	  -H "Authorization: Bearer $(TEST_JWT)" \
	  --data-raw "{\"reportTemplateId\":\"$(REPORT_TEMPLATE_ID)\",\"reportId\":\"$(REPORT_TEMPLATE_ID)\",\"roleNames\":[\"nl-gsg-claim-master-all\"],\"preview\":true,\"limit\":10}" \
	  --output /tmp/report-preview.xlsx
	@test -s /tmp/report-preview.xlsx || (echo "ERROR: empty file /tmp/report-preview.xlsx" && exit 1)

openapi-clean:
	rm -f "$(OPENAPI_BUNDLE)"
```

---

## 11. Ключевые итоговые требования

- Не вшивать параметры в процедуру.
- `numberDays` только из `report_templates`.
- `roleNames` только из JWT.
- Для `HAND` `roleNames` обязателен.
- Внешний модуль вызывает только API и не дублирует Excel-логику.

