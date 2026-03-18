package com.employees.backend.repository;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RelationRepository {
    private final JdbcTemplate jdbcTemplate;

    public RelationRepository(JdbcTemplate jdbcTemplate) {
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

    public Map<String, Object> queryForMap(String sql, Object... args) {
        return jdbcTemplate.queryForMap(sql, args);
    }
}
