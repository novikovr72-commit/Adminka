-- НСИ: реестр справочников (метаданные для раздела просмотра/редактирования).
-- Применить на целевой БД вручную после ревью.

CREATE TABLE IF NOT EXISTS public.reference_books
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code character varying(128) COLLATE pg_catalog."default" NOT NULL,
    name character varying(500) COLLATE pg_catalog."default" NOT NULL,
    name_eng character varying(500) COLLATE pg_catalog."default" NOT NULL,
    procedure_code character varying(256) COLLATE pg_catalog."default",
    reference_url character varying(1024) COLLATE pg_catalog."default",
    table_name character varying(512) COLLATE pg_catalog."default",
    add_records boolean NOT NULL DEFAULT true,
    edit_records boolean NOT NULL DEFAULT true,
    properties json NOT NULL DEFAULT '{}'::json,
    rules jsonb,
    deleted boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reference_books_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reference_books_code_active
    ON public.reference_books USING btree (code COLLATE pg_catalog."C")
    WHERE deleted = false;

COMMENT ON TABLE public.reference_books IS 'НСИ: описание справочников (код, название, маршрут, JSON-схема полей UI)';

COMMENT ON COLUMN public.reference_books.id IS 'ID записи о справочнике (первичный ключ)';
COMMENT ON COLUMN public.reference_books.code IS 'Код справочника (обязателен; уникален среди неудалённых записей)';
COMMENT ON COLUMN public.reference_books.name IS 'Название справочника';
COMMENT ON COLUMN public.reference_books.name_eng IS 'Название (англ.); по правилу проекта совпадает с name';
COMMENT ON COLUMN public.reference_books.procedure_code IS 'Имя процедуры/кастомного компонента; NULL — стандартная обработка';
COMMENT ON COLUMN public.reference_books.reference_url IS 'Суффикс URL страницы справочника относительно списка, напр. product_groups → …/product_groups';
COMMENT ON COLUMN public.reference_books.table_name IS 'Целевая таблица данных справочника';
COMMENT ON COLUMN public.reference_books.add_records IS 'Разрешено добавление записей';
COMMENT ON COLUMN public.reference_books.edit_records IS 'Разрешено изменение записей';
COMMENT ON COLUMN public.reference_books.properties IS 'JSON (тип json): только описание полей UI { "fields": [...] }';
COMMENT ON COLUMN public.reference_books.rules IS 'JSON-массив: {rule: uniqueness|presence, fields: [{tableName}]}, минимум 2 поля в правиле; id не указывается';
COMMENT ON COLUMN public.reference_books.deleted IS 'Признак логического удаления';
COMMENT ON COLUMN public.reference_books.created_at IS 'Время создания записи';
COMMENT ON COLUMN public.reference_books.updated_at IS 'Время последнего обновления записи';

CREATE OR REPLACE FUNCTION public.reference_books_sync_name_eng()
    RETURNS trigger
    LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.name_eng := NEW.name;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_reference_books_sync_name_eng ON public.reference_books;

CREATE TRIGGER tr_reference_books_sync_name_eng
    BEFORE INSERT OR UPDATE
    ON public.reference_books
    FOR EACH ROW
    EXECUTE PROCEDURE public.reference_books_sync_name_eng();

-- Пример структуры properties (документация, не constraint):
-- {
--   "tableName": "product_groups",
--   "addRecords": true,
--   "editRecords": true,
--   "fields": [
--     {
--       "fieldName": "code",
--       "fieldCaption": "Код",
--       "fieldType": "varchar",
--       "fieldRequired": true,
--       "fieldDefaultValueString": null,
--       "fieldDefaultValueNumeric": null,
--       "fieldDefaultValueBoolean": null,
--       "fieldShow": true,
--       "fieldEdit": true,
--       "fieldValues": [{ "fieldValueString": "A" }],
--       "fieldLinkTable": null,
--       "fieldLinkField": null,
--       "fieldLinkShowField": null
--     }
--   ]
-- }
-- fieldType: varchar | numeric | date | datetime | boolean
