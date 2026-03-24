-- Миграция: колонки table_name, add_records, edit_records (раньше часть json properties).
-- Выполнить на целевой БД: psql -f reference-books-table-name-columns.sql
-- или через клиент PostgreSQL.

ALTER TABLE IF EXISTS public.reference_books
  ADD COLUMN IF NOT EXISTS table_name character varying(512) COLLATE pg_catalog."default";

ALTER TABLE IF EXISTS public.reference_books
  ADD COLUMN IF NOT EXISTS add_records boolean NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS public.reference_books
  ADD COLUMN IF NOT EXISTS edit_records boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.reference_books.table_name IS 'Целевая таблица данных справочника (ранее properties.tableName)';
COMMENT ON COLUMN public.reference_books.add_records IS 'Разрешено добавление записей (ранее properties.addRecords)';
COMMENT ON COLUMN public.reference_books.edit_records IS 'Разрешено изменение записей (ранее properties.editRecords)';

-- Перенос из JSON (если значения ещё только в properties)
UPDATE public.reference_books rb
SET
  table_name = COALESCE(
    NULLIF(trim(rb.properties::jsonb->>'tableName'), ''),
    rb.table_name
  ),
  add_records = CASE
    WHEN rb.properties::jsonb ? 'addRecords' THEN (rb.properties::jsonb->>'addRecords')::boolean
    WHEN rb.properties::jsonb ? 'addRecors' THEN (rb.properties::jsonb->>'addRecors')::boolean
    ELSE rb.add_records
  END,
  edit_records = CASE
    WHEN rb.properties::jsonb ? 'editRecords' THEN (rb.properties::jsonb->>'editRecords')::boolean
    WHEN rb.properties::jsonb ? 'editRecors' THEN (rb.properties::jsonb->>'editRecors')::boolean
    ELSE rb.edit_records
  END
WHERE rb.properties IS NOT NULL;

UPDATE public.reference_books
SET properties = (
  properties::jsonb
  - 'tableName'
  - 'addRecords'
  - 'editRecords'
  - 'addRecors'
  - 'editRecors'
)::json
WHERE properties IS NOT NULL;
