# Подробная инструкция по разворачиванию `adminka` (на любом компьютере)

## 1. Что разворачиваем

`adminka` состоит из:
- backend: Java Spring Boot (`adminka/backend`), порт `3003`;
- frontend: Vite + React (`adminka/frontend`), порт `5175`;
- PostgreSQL БД (по умолчанию `nlmk_test`).

## 2. Требования к окружению

Минимально:
- Git;
- Node.js 20+ и npm 10+;
- Java 21+ (в проекте используется JDK 25, рекомендуется 21/25);
- PostgreSQL 14+;
- доступ в интернет для `npm install` и Maven-зависимостей.

Проверка версий:

```bash
git --version
node -v
npm -v
java -version
psql --version
```

## 3. Клонирование и установка зависимостей

```bash
git clone <URL_РЕПОЗИТОРИЯ>
cd Cursor/adminka
npm install
```

Что делает `npm install` в корне:
- ставит зависимости для корневого `package.json`;
- подтягивает зависимости frontend/backend (через существующие скрипты проекта).

## 4. Подготовка БД PostgreSQL

### 4.1 Создание БД

```bash
createdb nlmk_test
```

Если нужен другой пользователь/пароль:
- создайте роль;
- выдайте права на БД.

### 4.2 Загрузка схемы/базовых данных

```bash
psql "postgresql://<user>:<password>@localhost:5432/nlmk_test" -f pos-01-final-sql.sql
```

### 4.3 Применение структурных миграций проекта

```bash
psql "postgresql://<user>:<password>@localhost:5432/nlmk_test" -f add-print-form-templates.sql
psql "postgresql://<user>:<password>@localhost:5432/nlmk_test" -f add-organ-unit-data-info.sql
psql "postgresql://<user>:<password>@localhost:5432/nlmk_test" -f add-report-logo-to-report-templates.sql
```

Важно:
- полный реестр структурных изменений ведется в `docs/DB_STRUCTURE_CHANGES_NLMK_TEST.md`;
- новые SQL-изменения всегда применять и фиксировать в этом реестре.

## 5. Настройка переменных окружения

Создать файл `adminka/backend/.env`:

```env
PORT=3003
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/nlmk_test
JDBC_DATABASE_URL=jdbc:postgresql://localhost:5432/nlmk_test
DB_USERNAME=<user>
DB_PASSWORD=<password>
DADATA_API_TOKEN=<ваш_dadata_token>
```

Опционально (`adminka/frontend/.env`), если backend не на localhost:

```env
VITE_API_BASE_URL=http://<host>:3003
```

## 6. Запуск приложения

Из корня `adminka`:

```bash
npm run dev
```

Поднимаются:
- backend: `http://localhost:3003`;
- frontend: `http://localhost:5175`.

## 7. Проверка после старта

### 7.1 Backend

```bash
curl -sS http://localhost:3003/api/admin/list_organization_unit_types
```

Ожидаемо:
- HTTP 200;
- JSON-массив типов организаций.

### 7.2 Frontend

Открыть в браузере:
- `http://localhost:5175`

Ожидаемо:
- загружается интерфейс без белого экрана/ошибок API.

### 7.3 Проверка DaData

Открыть карточку организации-резидента с пустым `data_info`.
Ожидаемо:
- на вкладке ДаДата выполняется автозапрос;
- по кнопке `Обновить` данные обновляются повторно.

## 8. Сборка для продакшна

### 8.1 Frontend build

```bash
cd frontend
npm run build
```

Артефакты: `frontend/dist`.

### 8.2 Backend build

```bash
cd ../backend
./mvnw clean package -DskipTests
```

Артефакт: `backend/target/*.jar`.

### 8.3 Запуск jar

```bash
java -jar backend/target/<artifact>.jar
```

Перед запуском убедиться, что все env-переменные заданы.

## 9. Типовые проблемы и решение

### 9.1 `bad SQL grammar ... data_info`
- Причина: не применена миграция `add-organ-unit-data-info.sql`.
- Решение: применить SQL из раздела 4.3.

### 9.2 Нет данных DaData
- Причина: отсутствует/невалиден `DADATA_API_TOKEN`.
- Решение: проверить `backend/.env`, перезапустить backend.

### 9.3 CORS/неверный URL API на frontend
- Решение: проверить `VITE_API_BASE_URL` (или использовать стандартный localhost-сценарий).

### 9.4 Не подключается к БД
- Решение:
  - проверить `DATABASE_URL`, `JDBC_DATABASE_URL`, `DB_USERNAME`, `DB_PASSWORD`;
  - проверить доступность PostgreSQL (`pg_isready`).

## 10. Регламент обновления документа

При любых изменениях процесса разворачивания:
- обновлять этот файл в том же PR/коммите;
- добавлять новые обязательные шаги и проверки;
- указывать новые переменные окружения и миграции.
