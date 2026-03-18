package com.employees.backend.repository;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ReportTemplateRepository {
    public record QueryRowsWithColumns(
        List<String> columns,
        List<Map<String, Object>> rows
    ) {
    }

    private final JdbcTemplate jdbcTemplate;

    public ReportTemplateRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> queryForList(String sql, Object... args) {
        return jdbcTemplate.queryForList(sql, args);
    }

    public int update(String sql, Object... args) {
        return jdbcTemplate.update(sql, args);
    }

    public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
        return jdbcTemplate.queryForObject(sql, requiredType, args);
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
        return jdbcTemplate.update(
            """
            insert into public.report_templates(
              id, code_report, name, output_file_name, output_file_type,
              version, status, method, number_days, sql_query, report_info, deleted
            )
            values (?::uuid, ?, ?, ?, ?, ?, ?, ?, ?, '', '{}'::jsonb, false)
            """,
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
        return jdbcTemplate.update(
            """
            update public.report_templates
            set code_report = ?,
                name = ?,
                output_file_name = ?,
                output_file_type = ?,
                version = ?,
                status = ?,
                method = ?,
                number_days = ?
            where id = ?::uuid
              and deleted = false
            """,
            codeReport,
            name,
            outputFileName,
            outputFileType,
            version,
            status,
            method,
            numberDays,
            reportTemplateId
        );
    }

    public int countActiveTemplateById(String reportTemplateId) {
        Integer value = jdbcTemplate.queryForObject(
            """
            select count(*)::int
            from public.report_templates rt
            where rt.id = ?::uuid
              and rt.deleted = false
            """,
            Integer.class,
            reportTemplateId
        );
        return value == null ? 0 : value;
    }

    public int deleteAccessGroupsByTemplateId(String reportTemplateId) {
        return jdbcTemplate.update(
            """
            delete from public.report_access_group
            where report_template_id = ?::uuid
            """,
            reportTemplateId
        );
    }

    public int deleteOrganizationsByTemplateId(String reportTemplateId) {
        return jdbcTemplate.update(
            """
            delete from public.report_template_organizations
            where report_template_id = ?::uuid
            """,
            reportTemplateId
        );
    }

    public int deleteTemplateById(String reportTemplateId) {
        return jdbcTemplate.update(
            """
            delete from public.report_templates
            where id = ?::uuid
              and deleted = false
            """,
            reportTemplateId
        );
    }

    public int deleteOrganizationLink(String reportTemplateId, String organUnitId) {
        return jdbcTemplate.update(
            """
            delete from public.report_template_organizations
            where report_template_id = ?::uuid
              and claim_organization_id = ?::uuid
            """,
            reportTemplateId,
            organUnitId
        );
    }

    public int deleteAccessGroupLink(String reportTemplateId, String codeAccess) {
        return jdbcTemplate.update(
            """
            delete from public.report_access_group
            where report_template_id = ?::uuid
              and code_access = ?
            """,
            reportTemplateId,
            codeAccess
        );
    }

    public List<Map<String, Object>> findOrganizationInfoById(String organUnitId) {
        return jdbcTemplate.queryForList(
            """
            select
              ou.id::text as organ_unit_id,
              coalesce(ou.sh_name, '') as organ_unit_name
            from party.organ_unit ou
            where ou.id = ?::uuid
              and ou.deleted = false
            limit 1
            """,
            organUnitId
        );
    }

    public int insertOrganizationLinkIfAbsent(String reportTemplateId, String organUnitId) {
        return jdbcTemplate.update(
            """
            insert into public.report_template_organizations(report_template_id, claim_organization_id)
            select ?::uuid, ?::uuid
            where not exists (
              select 1
              from public.report_template_organizations rto
              where rto.report_template_id = ?::uuid
                and rto.claim_organization_id = ?::uuid
            )
            """,
            reportTemplateId,
            organUnitId,
            reportTemplateId,
            organUnitId
        );
    }

    public int insertAccessGroupLinkIfAbsent(String reportTemplateId, String codeAccess) {
        return jdbcTemplate.update(
            """
            insert into public.report_access_group(report_template_id, code_access)
            select ?::uuid, ?
            where not exists (
              select 1
              from public.report_access_group rag
              where rag.report_template_id = ?::uuid
                and rag.code_access = ?
            )
            """,
            reportTemplateId,
            codeAccess,
            reportTemplateId,
            codeAccess
        );
    }

    public List<Map<String, Object>> findTemplateSettingsById(String reportTemplateId) {
        return jdbcTemplate.queryForList(
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
            where rt.id = ?::uuid
              and rt.deleted = false
            """,
            reportTemplateId
        );
    }

    public int updateTemplateSettingsWithLogo(String reportTemplateId, String reportInfoJson, byte[] reportLogoBytes) {
        return jdbcTemplate.update(
            """
            update public.report_templates
            set report_info = ?::jsonb,
                report_logo = ?
            where id = ?::uuid
              and deleted = false
            """,
            reportInfoJson,
            reportLogoBytes,
            reportTemplateId
        );
    }

    public int updateTemplateSettingsWithoutLogo(String reportTemplateId, String reportInfoJson) {
        return jdbcTemplate.update(
            """
            update public.report_templates
            set report_info = ?::jsonb
            where id = ?::uuid
              and deleted = false
            """,
            reportInfoJson,
            reportTemplateId
        );
    }

    public List<Map<String, Object>> findTemplateSqlMetaById(String reportTemplateId) {
        return jdbcTemplate.queryForList(
            """
            select
              rt.sql_query as sql_query,
              coalesce(rt.number_days, 0)::int as number_days,
              upper(coalesce(rt.method, 'AUTO')) as method
            from public.report_templates rt
            where rt.id = ?::uuid
              and rt.deleted = false
            """,
            reportTemplateId
        );
    }

    public Map<String, Object> findTemplateExcelMetaById(
        String reportTemplateId,
        String defaultOutputFileName,
        String defaultOutputFileType
    ) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            """
            select
              rt.sql_query as sql_query,
              coalesce(rt.number_days, 0)::int as number_days,
              upper(coalesce(rt.method, 'AUTO')) as method,
              coalesce(nullif(trim(rt.output_file_name), ''), ?) as output_file_name,
              coalesce(nullif(trim(rt.output_file_type), ''), ?) as output_file_type,
              coalesce(nullif(trim(rt.name), ''), 'Отчет') as report_name,
              rt.report_info::text as report_info,
              rt.report_logo as report_logo
            from public.report_templates rt
            where rt.id = ?::uuid
              and rt.deleted = false
            """,
            defaultOutputFileName,
            defaultOutputFileType,
            reportTemplateId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public int updateTemplateSql(String reportTemplateId, String sqlQueryToSave) {
        return jdbcTemplate.update(
            """
            update public.report_templates
            set sql_query = ?
            where id = ?::uuid
              and deleted = false
            """,
            sqlQueryToSave,
            reportTemplateId
        );
    }

    public Long queryLong(String sql) {
        return jdbcTemplate.queryForObject(sql, Long.class);
    }

    public void explain(String sql) {
        jdbcTemplate.queryForList("explain " + sql);
    }

    public QueryRowsWithColumns queryRowsWithColumns(
        String sql,
        Object... args
    ) {
        List<String> columns = new java.util.ArrayList<>();
        List<Map<String, Object>> rows = jdbcTemplate.query(
            sql,
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
            },
            args
        );
        return new QueryRowsWithColumns(columns, rows);
    }
}
