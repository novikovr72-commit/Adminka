-- Примеры записей реестра справочников (идемпотентно: не дублирует активный code).
-- Применить после create-reference-books-nsi.sql

INSERT INTO public.reference_books (code, name, procedure_code, reference_url, table_name, add_records, edit_records, properties)
SELECT
    'product_groups',
    'Группы продукции',
    NULL,
    'product_groups',
    'product_groups',
    true,
    true,
    '{"fields":[]}'::json
WHERE NOT EXISTS (
    SELECT 1
    FROM public.reference_books rb
    WHERE rb.code = 'product_groups'
      AND rb.deleted = false
);
