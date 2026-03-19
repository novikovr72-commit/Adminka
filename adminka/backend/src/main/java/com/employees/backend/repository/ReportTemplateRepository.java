package com.employees.backend.repository;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.BeanPropertySqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ReportTemplateRepository {
    public record QueryRowsWithColumns(
        List<String> columns,
        List<Map<String, Object>> rows
    ) {
    }

    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public ReportTemplateRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate) {
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    public List<Map<String, Object>> queryForNamedListByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForList(prepared.sql(), prepared.params());
    }

    public int updateNamedByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.update(prepared.sql(), prepared.params());
    }

    public boolean recipientsTableExists() {
        String relationName = namedParameterJdbcTemplate.queryForObject(
            "select to_regclass('public.report_template_recipients')::text",
            params(new EmptyParams()),
            String.class
        );
        return relationName != null && !relationName.isBlank();
    }

    public <T> T queryForNamedObjectByArgs(String sql, Class<T> requiredType, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForObject(prepared.sql(), prepared.params(), requiredType);
    }

    public int insertTemplate(
        String reportTemplateId,
        String codeReport,
        String name,
        String outputFileName,
        String outputFileType,
        String version,
        String status,
        String method,
        Integer numberDays
    ) {
        InsertTemplateParams sqlParams = new InsertTemplateParams(
            reportTemplateId,
            codeReport,
            name,
            outputFileName,
            outputFileType,
            version,
            status,
            method,
            numberDays
        );
        return namedParameterJdbcTemplate.update(
            """
            insert into public.report_templates(
              id, code_report, name, output_file_name, output_file_type,
              version, status, method, number_days, sql_query, report_info, deleted
            )
            values (
              cast(:reportTemplateId as uuid),
              :codeReport,
              :name,
              :outputFileName,
              :outputFileType,
              :version,
              :status,
              :method,
              :numberDays,
              '',
              '{}'::jsonb,
              false
            )
            """,
            params(sqlParams)
        );
    }

    public int updateMainSettings(
        String reportTemplateId,
        String codeReport,
        String name,
        String outputFileName,
        String outputFileType,
        String version,
        String status,
        String method,
        Integer numberDays
    ) {
        UpdateMainSettingsParams sqlParams = new UpdateMainSettingsParams(
            reportTemplateId,
            codeReport,
            name,
            outputFileName,
            outputFileType,
            version,
            status,
            method,
            numberDays
        );
        return namedParameterJdbcTemplate.update(
            """
            update public.report_templates
            set code_report = :codeReport,
                name = :name,
                output_file_name = :outputFileName,
                output_file_type = :outputFileType,
                version = :version,
                status = :status,
                method = :method,
                number_days = :numberDays
            where id = cast(:reportTemplateId as uuid)
              and deleted = false
            """,
            params(sqlParams)
        );
    }

    public int countActiveTemplateById(String reportTemplateId) {
        Integer value = namedParameterJdbcTemplate.queryForObject(
            """
            select count(*)::int
            from public.report_templates rt
            where rt.id = cast(:reportTemplateId as uuid)
              and rt.deleted = false
            """,
            params(new ReportTemplateIdParams(reportTemplateId)),
            Integer.class
        );
        return value == null ? 0 : value;
    }

    public int deleteAccessGroupsByTemplateId(String reportTemplateId) {
        return namedParameterJdbcTemplate.update(
            """
            delete from public.report_access_group
            where report_template_id = cast(:reportTemplateId as uuid)
            """,
            params(new ReportTemplateIdParams(reportTemplateId))
        );
    }

    public int deleteOrganizationsByTemplateId(String reportTemplateId) {
        return namedParameterJdbcTemplate.update(
            """
            delete from public.report_template_organizations
            where report_template_id = cast(:reportTemplateId as uuid)
            """,
            params(new ReportTemplateIdParams(reportTemplateId))
        );
    }

    public int deleteRecipientsByTemplateId(String reportTemplateId) {
        return namedParameterJdbcTemplate.update(
            """
            delete from public.report_template_recipients
            where report_template_id = cast(:reportTemplateId as uuid)
            """,
            params(new ReportTemplateIdParams(reportTemplateId))
        );
    }

    public int deleteTemplateById(String reportTemplateId) {
        return namedParameterJdbcTemplate.update(
            """
            delete from public.report_templates
            where id = cast(:reportTemplateId as uuid)
              and deleted = false
            """,
            params(new ReportTemplateIdParams(reportTemplateId))
        );
    }

    public int deleteOrganizationLink(String reportTemplateId, String organUnitId) {
        return namedParameterJdbcTemplate.update(
            """
            delete from public.report_template_organizations
            where report_template_id = cast(:reportTemplateId as uuid)
              and claim_organization_id = cast(:organUnitId as uuid)
            """,
            params(new ReportTemplateOrganizationParams(reportTemplateId, organUnitId))
        );
    }

    public int deleteAccessGroupLink(String reportTemplateId, String codeAccess) {
        return namedParameterJdbcTemplate.update(
            """
            delete from public.report_access_group
            where report_template_id = cast(:reportTemplateId as uuid)
              and code_access = :codeAccess
            """,
            params(new ReportTemplateAccessGroupParams(reportTemplateId, codeAccess))
        );
    }

    public int deleteRecipientLink(String reportTemplateId, String email) {
        return namedParameterJdbcTemplate.update(
            """
            delete from public.report_template_recipients
            where report_template_id = cast(:reportTemplateId as uuid)
              and lower(email) = lower(:email)
            """,
            params(new ReportTemplateEmailParams(reportTemplateId, email))
        );
    }

    public List<Map<String, Object>> findOrganizationInfoById(String organUnitId) {
        return namedParameterJdbcTemplate.queryForList(
            """
            select
              ou.id::text as organ_unit_id,
              coalesce(ou.sh_name, '') as organ_unit_name
            from party.organ_unit ou
            where ou.id = cast(:organUnitId as uuid)
              and ou.deleted = false
            limit 1
            """,
            params(new OrganUnitIdParams(organUnitId))
        );
    }

    public int insertOrganizationLinkIfAbsent(String reportTemplateId, String organUnitId) {
        return namedParameterJdbcTemplate.update(
            """
            insert into public.report_template_organizations(report_template_id, claim_organization_id)
            select cast(:reportTemplateId as uuid), cast(:organUnitId as uuid)
            where not exists (
              select 1
              from public.report_template_organizations rto
              where rto.report_template_id = cast(:reportTemplateId as uuid)
                and rto.claim_organization_id = cast(:organUnitId as uuid)
            )
            """,
            params(new ReportTemplateOrganizationParams(reportTemplateId, organUnitId))
        );
    }

    public int insertAccessGroupLinkIfAbsent(String reportTemplateId, String codeAccess) {
        return namedParameterJdbcTemplate.update(
            """
            insert into public.report_access_group(report_template_id, code_access)
            select cast(:reportTemplateId as uuid), :codeAccess
            where not exists (
              select 1
              from public.report_access_group rag
              where rag.report_template_id = cast(:reportTemplateId as uuid)
                and rag.code_access = :codeAccess
            )
            """,
            params(new ReportTemplateAccessGroupParams(reportTemplateId, codeAccess))
        );
    }

    public int insertRecipientIfAbsent(String reportTemplateId, String email) {
        return namedParameterJdbcTemplate.update(
            """
            insert into public.report_template_recipients(report_template_id, email)
            select cast(:reportTemplateId as uuid), :email
            where not exists (
              select 1
              from public.report_template_recipients rtr
              where rtr.report_template_id = cast(:reportTemplateId as uuid)
                and lower(rtr.email) = lower(:email)
            )
            """,
            params(new ReportTemplateEmailParams(reportTemplateId, email))
        );
    }

    public List<Map<String, Object>> findTemplateSettingsById(String reportTemplateId) {
        return namedParameterJdbcTemplate.queryForList(
            """
            select
              rt.id::text as report_template_id,
              rt.name as name,
              rt.report_info::text as report_info,
              jsonb_pretty(rt.report_info) as report_info_pretty,
              coalesce((
                select jsonb_agg(
                  jsonb_build_object('email', recipient_item.email)
                  order by recipient_item.email
                )
                from (
                  select distinct
                    rtr.email as email
                  from public.report_template_recipients rtr
                  where rtr.report_template_id = rt.id
                    and rtr.email is not null
                ) recipient_item
              ), '[]'::jsonb)::text as recipients,
              encode(rt.report_logo, 'base64') as report_logo_base64,
              case
                when rt.report_logo is null then null
                when substring(rt.report_logo from 1 for 8) = decode('89504E470D0A1A0A', 'hex') then 'image/png'
                when substring(rt.report_logo from 1 for 3) = decode('FFD8FF', 'hex') then 'image/jpeg'
                when substring(rt.report_logo from 1 for 6) = decode('474946383761', 'hex')
                  or substring(rt.report_logo from 1 for 6) = decode('474946383961', 'hex')
                  then 'image/gif'
                when substring(rt.report_logo from 9 for 4) = decode('57454250', 'hex') then 'image/webp'
                else 'application/octet-stream'
              end as report_logo_mime_type
            from public.report_templates rt
            where rt.id = cast(:reportTemplateId as uuid)
              and rt.deleted = false
            """,
            params(new ReportTemplateIdParams(reportTemplateId))
        );
    }

    public List<Map<String, Object>> findTemplateSettingsByIdWithoutRecipients(String reportTemplateId) {
        return namedParameterJdbcTemplate.queryForList(
            """
            select
              rt.id::text as report_template_id,
              rt.name as name,
              rt.report_info::text as report_info,
              jsonb_pretty(rt.report_info) as report_info_pretty,
              encode(rt.report_logo, 'base64') as report_logo_base64,
              case
                when rt.report_logo is null then null
                when substring(rt.report_logo from 1 for 8) = decode('89504E470D0A1A0A', 'hex') then 'image/png'
                when substring(rt.report_logo from 1 for 3) = decode('FFD8FF', 'hex') then 'image/jpeg'
                when substring(rt.report_logo from 1 for 6) = decode('474946383761', 'hex')
                  or substring(rt.report_logo from 1 for 6) = decode('474946383961', 'hex')
                  then 'image/gif'
                when substring(rt.report_logo from 9 for 4) = decode('57454250', 'hex') then 'image/webp'
                else 'application/octet-stream'
              end as report_logo_mime_type
            from public.report_templates rt
            where rt.id = cast(:reportTemplateId as uuid)
              and rt.deleted = false
            """,
            params(new ReportTemplateIdParams(reportTemplateId))
        );
    }

    public int updateTemplateSettingsWithLogo(String reportTemplateId, String reportInfoJson, byte[] reportLogoBytes) {
        return namedParameterJdbcTemplate.update(
            """
            update public.report_templates
            set report_info = cast(:reportInfoJson as jsonb),
                report_logo = :reportLogoBytes
            where id = cast(:reportTemplateId as uuid)
              and deleted = false
            """,
            params(new ReportTemplateSettingsWithLogoParams(reportTemplateId, reportInfoJson, reportLogoBytes))
        );
    }

    public int updateTemplateSettingsWithoutLogo(String reportTemplateId, String reportInfoJson) {
        return namedParameterJdbcTemplate.update(
            """
            update public.report_templates
            set report_info = cast(:reportInfoJson as jsonb)
            where id = cast(:reportTemplateId as uuid)
              and deleted = false
            """,
            params(new ReportTemplateSettingsWithoutLogoParams(reportTemplateId, reportInfoJson))
        );
    }

    public List<Map<String, Object>> findTemplateSqlMetaById(String reportTemplateId) {
        return namedParameterJdbcTemplate.queryForList(
            """
            select
              rt.sql_query as sql_query,
              coalesce(rt.number_days, 0)::int as number_days,
              upper(coalesce(rt.method, 'AUTO')) as method
            from public.report_templates rt
            where rt.id = cast(:reportTemplateId as uuid)
              and rt.deleted = false
            """,
            params(new ReportTemplateIdParams(reportTemplateId))
        );
    }

    public Map<String, Object> findTemplateExcelMetaById(
        String reportTemplateId,
        String defaultOutputFileName,
        String defaultOutputFileType
    ) {
        List<Map<String, Object>> rows = namedParameterJdbcTemplate.queryForList(
            """
            select
              rt.sql_query as sql_query,
              coalesce(rt.number_days, 0)::int as number_days,
              upper(coalesce(rt.method, 'AUTO')) as method,
              coalesce(nullif(trim(rt.output_file_name), ''), :defaultOutputFileName) as output_file_name,
              coalesce(nullif(trim(rt.output_file_type), ''), :defaultOutputFileType) as output_file_type,
              coalesce(nullif(trim(rt.name), ''), 'Отчет') as report_name,
              rt.report_info::text as report_info,
              rt.report_logo as report_logo
            from public.report_templates rt
            where rt.id = cast(:reportTemplateId as uuid)
              and rt.deleted = false
            """,
            params(new ReportTemplateExcelMetaParams(reportTemplateId, defaultOutputFileName, defaultOutputFileType))
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public int updateTemplateSql(String reportTemplateId, String sqlQueryToSave) {
        return namedParameterJdbcTemplate.update(
            """
            update public.report_templates
            set sql_query = :sqlQueryToSave
            where id = cast(:reportTemplateId as uuid)
              and deleted = false
            """,
            params(new UpdateTemplateSqlParams(reportTemplateId, sqlQueryToSave))
        );
    }

    public Long queryLong(String sql) {
        return namedParameterJdbcTemplate.queryForObject(
            sql,
            params(new EmptyParams()),
            Long.class
        );
    }

    public void explain(String sql) {
        namedParameterJdbcTemplate.queryForList(
            "explain " + sql,
            params(new EmptyParams())
        );
    }

    public QueryRowsWithColumns queryRowsWithColumnsNamed(String sql, Object beanParams) {
        List<String> columns = new java.util.ArrayList<>();
        List<Map<String, Object>> rows = namedParameterJdbcTemplate.query(
            sql,
            params(beanParams),
            resultSet -> {
                List<Map<String, Object>> extractedRows = new java.util.ArrayList<>();
                int columnCount = resultSet.getMetaData().getColumnCount();
                if (columns.isEmpty()) {
                    for (int index = 1; index <= columnCount; index += 1) {
                        columns.add(resultSet.getMetaData().getColumnLabel(index));
                    }
                }
                while (resultSet.next()) {
                    java.util.LinkedHashMap<String, Object> mappedRow = new java.util.LinkedHashMap<>();
                    for (int index = 1; index <= columnCount; index += 1) {
                        String columnName = columns.get(index - 1);
                        mappedRow.put(columnName, resultSet.getObject(index));
                    }
                    extractedRows.add(mappedRow);
                }
                return extractedRows;
            }
        );
        return new QueryRowsWithColumns(columns, rows);
    }

    public <T> List<T> queryForBeans(String sql, Class<T> beanType, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.query(prepared.sql(), prepared.params(), BeanPropertyRowMapper.newInstance(beanType));
    }

    private static BeanPropertySqlParameterSource params(Object bean) {
        return new BeanPropertySqlParameterSource(bean);
    }

    private record EmptyParams() {
    }

    private record ReportTemplateIdParams(String reportTemplateId) {
    }

    private record OrganUnitIdParams(String organUnitId) {
    }

    private record ReportTemplateOrganizationParams(
        String reportTemplateId,
        String organUnitId
    ) {
    }

    private record ReportTemplateAccessGroupParams(
        String reportTemplateId,
        String codeAccess
    ) {
    }

    private record ReportTemplateEmailParams(
        String reportTemplateId,
        String email
    ) {
    }

    private record InsertTemplateParams(
        String reportTemplateId,
        String codeReport,
        String name,
        String outputFileName,
        String outputFileType,
        String version,
        String status,
        String method,
        Integer numberDays
    ) {
    }

    private record UpdateMainSettingsParams(
        String reportTemplateId,
        String codeReport,
        String name,
        String outputFileName,
        String outputFileType,
        String version,
        String status,
        String method,
        Integer numberDays
    ) {
    }

    private record ReportTemplateSettingsWithLogoParams(
        String reportTemplateId,
        String reportInfoJson,
        byte[] reportLogoBytes
    ) {
    }

    private record ReportTemplateSettingsWithoutLogoParams(
        String reportTemplateId,
        String reportInfoJson
    ) {
    }

    private record ReportTemplateExcelMetaParams(
        String reportTemplateId,
        String defaultOutputFileName,
        String defaultOutputFileType
    ) {
    }

    private record UpdateTemplateSqlParams(
        String reportTemplateId,
        String sqlQueryToSave
    ) {
    }
}
