-- Индексы под POST /api/admin/report-templates (список с фильтрами и сортировкой).
-- Применять вручную на целевой БД после проверки pg_stat_user_indexes / EXPLAIN ANALYZE.
--
-- 1) Дочерние таблицы: подзапросы по report_template_id для строк списка.
create index if not exists idx_rto_report_template_id
  on public.report_template_organizations (report_template_id);

create index if not exists idx_rag_report_template_id
  on public.report_access_group (report_template_id);

create index if not exists idx_rtr_report_template_id
  on public.report_template_recipients (report_template_id);

-- 2) Сортировка в списке использует collate "C" для текстовых полей (см. ReportTemplateService.buildReportTemplateOrderBy).
create index if not exists idx_report_templates_active_code_report_c
  on public.report_templates (code_report collate "C")
  where deleted = false;

create index if not exists idx_report_templates_active_name_c
  on public.report_templates (name collate "C")
  where deleted = false;

create index if not exists idx_report_templates_active_output_file_name_c
  on public.report_templates (output_file_name collate "C")
  where deleted = false;

create index if not exists idx_report_templates_active_output_file_type_c
  on public.report_templates (output_file_type collate "C")
  where deleted = false;

create index if not exists idx_report_templates_active_version_c
  on public.report_templates (version collate "C")
  where deleted = false;

create index if not exists idx_report_templates_active_status_c
  on public.report_templates (status collate "C")
  where deleted = false;

create index if not exists idx_report_templates_active_method_c
  on public.report_templates (method collate "C")
  where deleted = false;

-- 3) Опционально: ускорение ILIKE '%...%' по полям фильтра (нужно расширение pg_trgm).
-- create extension if not exists pg_trgm;
-- create index if not exists idx_report_templates_code_report_trgm
--   on public.report_templates using gin (code_report gin_trgm_ops) where deleted = false;
-- create index if not exists idx_report_templates_name_trgm
--   on public.report_templates using gin (name gin_trgm_ops) where deleted = false;
