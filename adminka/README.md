# employees_java

Проект на React + Java (Spring Boot).

## Запуск

```bash
cd /Users/roman/Documents/Cursor/employees_java
npm install
npm run install:all
npm run dev
```

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
- Backend: `http://localhost:3003/api/health`
- DB health: `http://localhost:3003/api/db-health`
- Swagger UI: `http://localhost:3003/api/docs`
- OpenAPI JSON: `http://localhost:3003/api/openapi.json`
