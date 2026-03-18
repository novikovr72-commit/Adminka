package com.employees.backend.repository;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PrintFormTemplateRepository {
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public PrintFormTemplateRepository(
        JdbcTemplate jdbcTemplate,
        NamedParameterJdbcTemplate namedParameterJdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    public List<Map<String, Object>> queryForList(String sql, Object... args) {
        return jdbcTemplate.queryForList(sql, args);
    }

    public List<Map<String, Object>> queryForNamedList(String sql, MapSqlParameterSource params) {
        return namedParameterJdbcTemplate.queryForList(sql, params);
    }

    public int update(String sql, Object... args) {
        return jdbcTemplate.update(sql, args);
    }

    public <T> T queryForObject(String sql, Class<T> type, Object... args) {
        return jdbcTemplate.queryForObject(sql, type, args);
    }

    public List<Map<String, Object>> findTemplates(String search, int limit, int sqlOffset) {
        List<Object> params = new ArrayList<>();
        String where = "where deleted = false";
        if (search != null && !search.isBlank()) {
            where += " and (name ilike ? or code ilike ?)";
            params.add("%" + search + "%");
            params.add("%" + search + "%");
        }
        params.add(limit);
        params.add(sqlOffset);
        return jdbcTemplate.queryForList(
            """
            select
              id::text as id,
              code,
              name,
              name_eng,
              description,
              data_sql,
              field_mapping::text as field_mapping,
              overlay_settings::text as overlay_settings,
              created_at,
              updated_at
            from public.print_form_templates
            %s
            order by updated_at desc, created_at desc
            limit ?
            offset ?
            """.formatted(where),
            params.toArray()
        );
    }

    public Integer countTemplates(String search) {
        List<Object> params = new ArrayList<>();
        String where = "where deleted = false";
        if (search != null && !search.isBlank()) {
            where += " and (name ilike ? or code ilike ?)";
            params.add("%" + search + "%");
            params.add("%" + search + "%");
        }
        return jdbcTemplate.queryForObject(
            """
            select count(*)::int
            from public.print_form_templates
            %s
            """.formatted(where),
            Integer.class,
            params.toArray()
        );
    }

    public Map<String, Object> findTemplateById(String templateId, boolean withPdf) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            """
            select
              id::text as id,
              code,
              name,
              name_eng,
              description,
              data_sql,
              field_mapping::text as field_mapping,
              overlay_settings::text as overlay_settings,
              created_at,
              updated_at,
              %s
            from public.print_form_templates
            where id = ?::uuid
              and deleted = false
            """.formatted(withPdf ? "template_pdf" : "null::bytea as template_pdf"),
            templateId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }
}
