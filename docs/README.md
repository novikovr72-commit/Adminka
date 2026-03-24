# Документация проекта `adminka`

## Основные документы

- [Изменения структуры БД `nlmk_test`](./DB_STRUCTURE_CHANGES_NLMK_TEST.md)
- [Развертывание `adminka` на любом компьютере](./DEPLOY_ADMINKA_ANY_PC.md)
- [Функциональные требования, методы, сценарии и тесты](./ADMINKA_FUNCTIONAL_REQUIREMENTS_AND_TESTS.md)

## Быстрый порядок чтения

1. `DEPLOY_ADMINKA_ANY_PC.md` — сначала для запуска среды.
2. `DB_STRUCTURE_CHANGES_NLMK_TEST.md` — затем для проверки/применения структурных изменений БД.
3. `ADMINKA_FUNCTIONAL_REQUIREMENTS_AND_TESTS.md` — для понимания требований и тест-кейсов.

## Регламент актуализации

- Любая структурная правка БД: обновлять `DB_STRUCTURE_CHANGES_NLMK_TEST.md`.
- Любое изменение процесса запуска/установки: обновлять `DEPLOY_ADMINKA_ANY_PC.md`.
- Любое изменение функциональности разделов: обновлять `ADMINKA_FUNCTIONAL_REQUIREMENTS_AND_TESTS.md`.

## Контрольный чек перед merge

- Документация обновлена вместе с кодом.
- Новые API/SQL-изменения отражены в соответствующих файлах.
- Тестовые сценарии актуализированы под текущую логику UI/Backend.
