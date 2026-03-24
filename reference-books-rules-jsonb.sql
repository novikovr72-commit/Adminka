-- Правила связок полей справочника (presence / uniqueness). См. adminka/docs/reference-books-rules.md
-- Применить на существующей БД после ревью.

ALTER TABLE IF EXISTS public.reference_books
    ADD COLUMN IF NOT EXISTS rules jsonb;

COMMENT ON COLUMN public.reference_books.rules IS 'JSON-массив: {rule: uniqueness|presence, fields: [{tableName}]}, минимум 2 поля в правиле; id не указывается';
