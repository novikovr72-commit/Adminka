package com.employees.backend.repository;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.BeanPropertySqlParameterSource;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PrintFormTemplateRepository {
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public PrintFormTemplateRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate) {
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    public List<Map<String, Object>> queryForNamedListByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForList(prepared.sql(), prepared.params());
    }

    public List<Map<String, Object>> queryForNamedList(String sql, MapSqlParameterSource params) {
        return namedParameterJdbcTemplate.queryForList(sql, params);
    }

    public List<Map<String, Object>> queryForNamedList(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.queryForList(sql, new BeanPropertySqlParameterSource(beanParams));
    }

    public int updateNamed(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.update(sql, new BeanPropertySqlParameterSource(beanParams));
    }

    public int updateNamedByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.update(prepared.sql(), prepared.params());
    }

    public <T> T queryForNamedObjectByArgs(String sql, Class<T> type, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForObject(prepared.sql(), prepared.params(), type);
    }

    public List<Map<String, Object>> findTemplates(String search, int limit, int sqlOffset) {
        String normalizedSearch = search == null ? "" : search.trim();
        boolean hasSearch = !normalizedSearch.isBlank();
        FindTemplatesParams sqlParams = new FindTemplatesParams(
            "%" + normalizedSearch + "%",
            limit,
            sqlOffset
        );
        String where = hasSearch
            ? "where deleted = false and (name ilike :search or code ilike :search)"
            : "where deleted = false";
        return namedParameterJdbcTemplate.queryForList(
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
            limit :limit
            offset :sqlOffset
            """.formatted(where),
            params(sqlParams)
        );
    }

    public Integer countTemplates(String search) {
        String normalizedSearch = search == null ? "" : search.trim();
        boolean hasSearch = !normalizedSearch.isBlank();
        String where = hasSearch
            ? "where deleted = false and (name ilike :search or code ilike :search)"
            : "where deleted = false";
        return namedParameterJdbcTemplate.queryForObject(
            """
            select count(*)::int
            from public.print_form_templates
            %s
            """.formatted(where),
            params(new SearchParams("%" + normalizedSearch + "%")),
            Integer.class
        );
    }

    public Map<String, Object> findTemplateById(String templateId, boolean withPdf) {
        List<Map<String, Object>> rows = namedParameterJdbcTemplate.queryForList(
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
            where id = cast(:templateId as uuid)
              and deleted = false
            """.formatted(withPdf ? "template_pdf" : "null::bytea as template_pdf"),
            params(new TemplateIdParams(templateId))
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public <T> List<T> queryForBeans(String sql, Class<T> beanType, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.query(prepared.sql(), prepared.params(), BeanPropertyRowMapper.newInstance(beanType));
    }

    public BeanPropertySqlParameterSource toBeanParams(Object bean) {
        return new BeanPropertySqlParameterSource(bean);
    }

    private static BeanPropertySqlParameterSource params(Object bean) {
        return new BeanPropertySqlParameterSource(bean);
    }

    private record SearchParams(String search) {
    }

    private record TemplateIdParams(String templateId) {
    }

    private record FindTemplatesParams(
        String search,
        int limit,
        int sqlOffset
    ) {
    }
}
