ALTER TABLE IF EXISTS public.report_templates
ADD COLUMN IF NOT EXISTS report_logo bytea;

COMMENT ON COLUMN public.report_templates.report_logo
IS 'Логотип отчета (binary), необязательное поле';
