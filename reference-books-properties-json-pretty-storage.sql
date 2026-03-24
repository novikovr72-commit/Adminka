-- jsonb нормализует JSON в одну строку; тип json хранит текст как вставлен (удобно для дампов/pgAdmin).
-- Идемпотентно: выполняется только если колонка ещё jsonb.

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'reference_books'
      AND c.column_name = 'properties'
      AND c.data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.reference_books
      ALTER COLUMN properties DROP DEFAULT;
    ALTER TABLE public.reference_books
      ALTER COLUMN properties TYPE json USING jsonb_pretty(properties::jsonb)::json;
    ALTER TABLE public.reference_books
      ALTER COLUMN properties SET DEFAULT '{}'::json;
  END IF;
END;
$migration$;

COMMENT ON COLUMN public.reference_books.properties IS 'JSON (тип json, не jsonb): текст в БД с переносами для читаемости; семантика как у JSON-объекта';
