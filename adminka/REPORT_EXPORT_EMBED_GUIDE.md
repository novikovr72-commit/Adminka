# Встраивание процедуры экспорта Excel из `adminka` в другой backend

Документ для случая, когда UI `adminka` использоваться не будет, а нужна только процедура:
- выполнение SQL отчета;
- подстановка входных параметров;
- применение макета `report_info` (json);
- генерация и возврат файла Excel.

---

## 1) Где взять процедуру в текущем коде `adminka`

Источник: `adminka/backend/src/main/java/com/employees/backend/ApiController.java`

Ключевые точки:
- `executeReportTemplate(...)` — единая точка запуска.
- `reportTemplateExcelExport(...)` — полный Excel.
- `reportTemplateExcelPreview(...)` — preview Excel.
- `toReportTemplateCheckSql(...)` — подстановка параметров в SQL.
- `resolveVisibleReportFields(...)` — чтение `json`-макета полей.
- `buildConfiguredReportExcelFromQuery(...)` — ядро генерации Excel по SQL + макету.
- `ReportFieldConfig` — модель поля макета.

---

## 2) Что уже вынесено в сервис в `adminka`

Теперь в backend есть отдельный сервис:

- `adminka/backend/src/main/java/com/employees/backend/ReportTemplateExportService.java`

Что делает этот сервис:
- централизует запуск `execute` (выбор preview/full);
- применяет единое правило для `preview` по умолчанию (`limit=50`, если не передан);
- используется endpoint-ами:
  - `POST /api/admin/report-template/execute`
  - `POST /api/admin/report-template/excel-preview`
  - `POST /api/admin/report-template/excel`

Важно: тяжелая бизнес-логика рендера Excel и парсинга макета пока остается в
`ApiController` (`buildConfiguredReportExcelFromQuery`, `resolveVisibleReportFields`, `toReportTemplateCheckSql`).
Это сделано осознанно, чтобы не сломать текущий контракт.

---

## 3) Готовый шаблон для вставки

Добавлен файл-шаблон:

- `adminka/docs/integration/EmbeddedReportTemplateExportProcedure.java`

Это самостоятельная заготовка orchestration-слоя:
- валидация запроса;
- проверка правила `method=HAND => roleNames обязательны`;
- подстановка параметров SQL;
- запуск SQL;
- вызов рендера Excel;
- формирование имени файла и метрик.

Что нужно реализовать в вашем модуле:
- `TemplateRepository` — чтение шаблона из `report_templates`;
- `SqlRunner` — выполнение SQL и `count` для preview;
- `ExcelRenderer` — рендер Excel по данным и `report_info`.

---

## 4) Пошаговая интеграция (детально)

### Шаг 1. Подключите зависимости

Минимум:
- Spring Web + Spring JDBC
- PostgreSQL driver
- Apache POI (`poi-ooxml`)

### Шаг 2. Выберите вариант интеграции

Вариант A (быстрый, рекомендуемый):
- ваш backend вызывает API `adminka` (`/api/admin/report-template/execute`).

Вариант B (встраивание кода):
- копируете шаблон процедуры из:
  - `adminka/docs/integration/EmbeddedReportTemplateExportProcedure.java`
- и реализуете интерфейсы доступа к БД/SQL/Excel у себя.

### Шаг 3. Скопируйте шаблон процедуры (для варианта B)

Скопируйте `EmbeddedReportTemplateExportProcedure.java` в ваш модуль, например:
- `src/main/java/.../report/EmbeddedReportTemplateExportProcedure.java`

### Шаг 4. Реализуйте `TemplateRepository`

Из таблицы `report_templates` читайте:
- `id`
- `method`
- `number_days`
- `sql_query`
- `output_file_name`
- `output_file_type`
- `name`
- `report_info`
- `report_logo`

Фильтр:
- `id = :reportTemplateId`
- `deleted = false`

### Шаг 5. Реализуйте `SqlRunner`

Нужны 2 операции:
- `runQuery(String sql)` -> `List<Map<String, Object>>`
- `countRows(String sql)` -> `long`

Для preview:
- `select count(*) from (<sql>) t`
- `select * from (<sql>) t limit :limit`

### Шаг 6. Реализуйте `ExcelRenderer`

Базовая задача:
- принять `rows`, `reportInfo`, `visibleFields`, `reportLogo`, `reportName`, период;
- собрать XLSX;
- вернуть `RenderedExcel(data, totalMs, queryMs, templateMs)`.

Если нужна идентичность 1:1 с `adminka`, переносите алгоритм из:
- `buildConfiguredReportExcelFromQuery(...)`
- всех его helper-методов в `ApiController.java`.

### Шаг 7. Подключите endpoint вашего модуля

Пример:
- `POST /api/reports/export`
- body:
  - `reportTemplateId` (uuid, обязательный)
  - `reportId` (uuid, обычно = `reportTemplateId`)
  - `startReport`, `endReport` (опционально)
  - `claimOrganizationId` (опционально)
  - `roleNames` (для `HAND` обязательно)
  - `preview` (bool)
  - `limit` (preview, 1..500)

Передайте body в `EmbeddedReportTemplateExportProcedure.execute(...)`.

### Шаг 8. Обязательно соблюдите правило `HAND`

Для шаблонов с `method=HAND`:
- если `roleNames` пустой -> `400` с сообщением  
  `Для отчетов с method=HAND параметр roleNames обязателен`

Источник `roleNames`:
- из JWT пользователя (`realm_access.roles`, `resource_access.*.roles`).

### Шаг 8.1. Извлечение `roleNames` из `access_token` и передача в процедуру

Нужно взять из payload токена:
- `realm_access.roles` (основной источник);
- при необходимости дополнительно объединить с `resource_access.<client>.roles`.

#### Вариант Java (Spring, без проверки подписи)

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public static List<String> extractRoleNamesFromAccessToken(String accessToken) {
    if (accessToken == null || accessToken.isBlank()) {
        return List.of();
    }
    try {
        String[] parts = accessToken.split("\\.");
        if (parts.length < 2) {
            return List.of();
        }
        byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[1]);
        String payloadJson = new String(payloadBytes, StandardCharsets.UTF_8);
        JsonNode payload = new ObjectMapper().readTree(payloadJson);

        Set<String> roles = new LinkedHashSet<>();
        JsonNode realmRoles = payload.path("realm_access").path("roles");
        if (realmRoles.isArray()) {
            realmRoles.forEach(node -> {
                String role = node.asText("").trim();
                if (!role.isEmpty()) {
                    roles.add(role);
                }
            });
        }

        JsonNode resourceAccess = payload.path("resource_access");
        if (resourceAccess.isObject()) {
            resourceAccess.fields().forEachRemaining(entry -> {
                JsonNode clientRoles = entry.getValue().path("roles");
                if (clientRoles.isArray()) {
                    clientRoles.forEach(node -> {
                        String role = node.asText("").trim();
                        if (!role.isEmpty()) {
                            roles.add(role);
                        }
                    });
                }
            });
        }
        return new ArrayList<>(roles);
    } catch (Exception ignored) {
        return List.of();
    }
}
```

Передача в процедуру:

```java
List<String> roleNames = extractRoleNamesFromAccessToken(accessToken);

var request = new EmbeddedReportTemplateExportProcedure.ExportRequest(
    reportTemplateId,
    reportId,
    startReport,
    endReport,
    claimOrganizationId,
    roleNames,
    preview,
    limit
);

var result = procedure.execute(request);
```

#### Вариант Node.js

```javascript
function extractRoleNamesFromAccessToken(accessToken) {
  if (!accessToken) return [];
  try {
    const [, payloadPart] = accessToken.split(".");
    if (!payloadPart) return [];
    const payloadJson = Buffer.from(payloadPart, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    const roles = new Set();
    (payload?.realm_access?.roles ?? []).forEach((r) => r && roles.add(String(r).trim()));
    Object.values(payload?.resource_access ?? {}).forEach((client) => {
      (client?.roles ?? []).forEach((r) => r && roles.add(String(r).trim()));
    });
    return [...roles].filter(Boolean);
  } catch {
    return [];
  }
}
```

Передача в body вызова:

```javascript
const roleNames = extractRoleNamesFromAccessToken(accessToken);

const payload = {
  reportTemplateId,
  reportId,
  startReport,
  endReport,
  claimOrganizationId,
  roleNames,
  preview: false
};
```

### Шаг 9. Верните файл корректно

В ответе:
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="<имя>.xlsx"`
- метрики в headers:
  - `X-Execution-Ms`
  - `X-Query-Execution-Ms`
  - `X-Template-Fill-Ms`
  - `X-Selected-Rows`
  - для preview: `X-Preview-Limit`

### Шаг 10. Проверьте контракт тестами

Минимальный чеклист:
1. `AUTO`, без дат -> 200 + файл.
2. `AUTO`, с датами -> 200 + файл.
3. `HAND`, без `roleNames` -> 400.
4. `HAND`, с `roleNames` -> 200 + файл.
5. `preview=true`, `limit=50` -> 200 + ограниченный набор.
6. Невалидный UUID -> 400.
7. Несуществующий `reportTemplateId` -> 400.
8. Проверка, что `numberDays` берется из `report_templates.number_days`.

---

## 5) Что копировать 1:1 из `adminka` для полной идентичности

Если вам нужен полностью тот же результат, что в `adminka`:
- переносите блок генерации Excel из `ApiController.buildConfiguredReportExcelFromQuery(...)`;
- переносите парсинг полей `resolveVisibleReportFields(...)`;
- переносите SQL-подстановку `toReportTemplateCheckSql(...)`.

Именно эти 3 блока формируют совпадающее поведение по:
- форматам даты/чисел/bool;
- выравниванию;
- ссылкам `LINK_%`;
- ширинам/автопереносу/жирности;
- метрикам выполнения.

---

## 6) Рекомендуемая стратегия внедрения

1. Сначала запустите по шаблону (`EmbeddedReportTemplateExportProcedure`) и получите рабочий экспорт.  
2. Затем поэтапно переносите 1:1 методы из `ApiController` до полного совпадения формата.  
3. Зафиксируйте контракт интеграции в OpenAPI вашего модуля.

