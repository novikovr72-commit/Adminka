create table if not exists public.report_template_recipients (
  report_template_id uuid not null,
  email varchar(320) not null,
  constraint report_template_recipients_pk primary key (report_template_id, email),
  constraint report_template_recipients_report_template_fk
    foreign key (report_template_id)
    references public.report_templates(id)
    on delete cascade
);

create index if not exists idx_report_template_recipients_report_template_id
  on public.report_template_recipients(report_template_id);

