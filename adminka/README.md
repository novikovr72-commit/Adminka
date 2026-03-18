# employees_java

Проект на React + Java (Spring Boot).

## Запуск

```bash
cd /Users/roman/Documents/Cursor/employees_java
npm install
npm run install:all
npm run dev
```

## Стабильный запуск dev (зафиксировано)

Чтобы фронт `5175` и backend `3003` поднимались и контролировались одной командой:

```bash
npm run dev:fixed:start
```

Проверка состояния:

```bash
npm run dev:fixed:status
```

Перезапуск:

```bash
npm run dev:fixed:restart
```

Остановка:

```bash
npm run dev:fixed:stop
```

Логи сохраняются в `.run/logs/`:
- backend: `.run/logs/backend.log`
- frontend: `.run/logs/frontend.log`

## Архитектурный каркас backend (рефакторинг)

В backend зафиксирована целевая структура слоев:

- `controller` — только HTTP-маршрутизация;
- `service` — бизнес-правила и orchestration;
- `repository` — доступ к БД;
- `dto` / `mapper` / `domain` — модели API и домена.

Текущее состояние миграции:

- доменные endpoint-ы разнесены по отдельным контроллерам (`ReportTemplate`, `Employee`, `Organization`, `Relation`, `PrintFormTemplate`, `SystemLookup`);
- SQL-операции report-template и print-form-template вынесены в `repository`-слой;
- `PrintFormTemplate` разделен на HTTP (`PrintFormTemplateController`) + business (`PrintFormTemplateService`) + DAO (`PrintFormTemplateRepository`) + PDF-core (`PrintFormTemplatePdfService`);
- SQL-поток report-template вынесен в `ReportTemplateSqlCore` + `ReportTemplateSqlService`;
- Excel-поток report-template вынесен в отдельный core-класс `ReportTemplateExcelCore` и используется через `ReportTemplateExcelFacade` + `ReportTemplateExecuteService`;
- legacy-нейминг (`Legacy*`) из runtime-цепочек удален.

Maven отдельно устанавливать не нужно: используется `backend/mvnw`.
Java Runtime (OpenJDK) должен быть установлен через Homebrew.

## PostgreSQL

```bash
cp backend/.env.example backend/.env
```

По умолчанию backend использует:
- `postgresql://roman@localhost:5432/employees`

## Frontend API URL

```bash
cp frontend/.env.example frontend/.env
```

Для запуска клиента с backend на другом компьютере укажи:
- `VITE_API_BASE_URL=http://<SERVER_IP>:3003`

## Адреса

- Frontend: `http://localhost:5175`
- Backend: `http://localhost:3003/api/admin/health`
- DB health: `http://localhost:3003/api/admin/db-health`
- Swagger UI: `http://localhost:3003/api/admin/docs`
- OpenAPI JSON: `http://localhost:3003/api/admin/openapi.json`

## Интеграция экспорта отчетов

- Полная инструкция для backend-интеграции: `REPORT_EXPORT_INTEGRATION_GUIDE.md`
- OpenAPI контракт для внешних модулей: `docs/api/openapi-report-export.json`
