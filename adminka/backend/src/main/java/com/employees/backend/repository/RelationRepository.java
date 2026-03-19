package com.employees.backend.repository;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.BeanPropertySqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RelationRepository {
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public RelationRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate) {
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    public List<Map<String, Object>> queryForNamedListByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForList(prepared.sql(), prepared.params());
    }

    public List<Map<String, Object>> queryForNamedList(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.queryForList(sql, new BeanPropertySqlParameterSource(beanParams));
    }

    public int updateNamedByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.update(prepared.sql(), prepared.params());
    }

    public int updateNamed(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.update(sql, new BeanPropertySqlParameterSource(beanParams));
    }

    public <T> T queryForNamedObjectByArgs(String sql, Class<T> requiredType, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForObject(prepared.sql(), prepared.params(), requiredType);
    }

    public <T> T queryForNamedObject(String sql, Class<T> requiredType, Object beanParams) {
        return namedParameterJdbcTemplate.queryForObject(
            sql,
            new BeanPropertySqlParameterSource(beanParams),
            requiredType
        );
    }

    public Map<String, Object> queryForNamedMapByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForMap(prepared.sql(), prepared.params());
    }

    public Map<String, Object> queryForNamedMap(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.queryForMap(sql, new BeanPropertySqlParameterSource(beanParams));
    }

    public <T> List<T> queryForBeans(String sql, Class<T> beanType, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.query(prepared.sql(), prepared.params(), BeanPropertyRowMapper.newInstance(beanType));
    }
}
