package com.employees.backend.repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class EmployeeRepository {
    private final JdbcTemplate jdbcTemplate;

    public EmployeeRepository(JdbcTemplate jdbcTemplate) {
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

    public List<String> loadAllEmployeeEmailsLower() {
        return jdbcTemplate.query(
            "select lower(email) as email from party.employee where email is not null",
            (resultSet, rowNum) -> resultSet.getString("email")
        );
    }

    public List<Map<String, Object>> loadActiveEmployeeIdEmail() {
        return jdbcTemplate.queryForList(
            "select id, email from party.employee where deleted = false"
        );
    }

    public int insertEmployee(
        String sapId,
        String fullName,
        String email,
        Integer personalNumber,
        String firstName,
        String surname,
        String middleName,
        String phoneNumber
    ) {
        return jdbcTemplate.update(
            """
            insert into party.employee (
                sap_id,
                full_name,
                email,
                personal_number,
                first_name,
                surname,
                middle_name,
                phone_number,
                deleted,
                created_at,
                updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, false, now(), now())
            """,
            sapId,
            fullName,
            email,
            personalNumber,
            firstName,
            surname,
            middleName,
            phoneNumber
        );
    }

    public int updateEmployeeByEmail(
        String sapId,
        String fullName,
        Integer personalNumber,
        String firstName,
        String surname,
        String middleName,
        String phoneNumber,
        String email
    ) {
        return jdbcTemplate.update(
            """
            update party.employee
            set sap_id = ?,
                full_name = ?,
                personal_number = ?,
                first_name = ?,
                surname = ?,
                middle_name = ?,
                phone_number = ?,
                deleted = false,
                updated_at = now()
            where email = ?
            """,
            sapId,
            fullName,
            personalNumber,
            firstName,
            surname,
            middleName,
            phoneNumber,
            email
        );
    }

    public int markEmployeeDeletedById(Object employeeId) {
        UUID id = employeeId instanceof UUID ? (UUID) employeeId : UUID.fromString(String.valueOf(employeeId));
        return jdbcTemplate.update(
            "update party.employee set deleted = true, updated_at = now() where id = ?",
            id
        );
    }
}
