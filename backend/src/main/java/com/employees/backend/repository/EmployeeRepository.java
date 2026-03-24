package com.employees.backend.repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.namedparam.BeanPropertySqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.stereotype.Repository;

@Repository
public class EmployeeRepository {
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public EmployeeRepository(NamedParameterJdbcTemplate namedParameterJdbcTemplate) {
        this.namedParameterJdbcTemplate = namedParameterJdbcTemplate;
    }

    public List<Map<String, Object>> queryForNamedListByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForList(prepared.sql(), prepared.params());
    }

    public List<Map<String, Object>> queryForNamedList(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.queryForList(sql, params(beanParams));
    }

    public List<Map<String, Object>> queryForList(String sql, SqlParameterSource parameterSource) {
        return namedParameterJdbcTemplate.queryForList(sql, parameterSource);
    }

    public int updateNamedByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.update(prepared.sql(), prepared.params());
    }

    public int updateNamed(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.update(sql, params(beanParams));
    }

    public <T> T queryForNamedObjectByArgs(String sql, Class<T> requiredType, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForObject(prepared.sql(), prepared.params(), requiredType);
    }

    public <T> T queryForNamedObject(String sql, Class<T> requiredType, Object beanParams) {
        return namedParameterJdbcTemplate.queryForObject(sql, params(beanParams), requiredType);
    }

    public Map<String, Object> queryForNamedMapByArgs(String sql, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.queryForMap(prepared.sql(), prepared.params());
    }

    public Map<String, Object> queryForNamedMap(String sql, Object beanParams) {
        return namedParameterJdbcTemplate.queryForMap(sql, params(beanParams));
    }

    public List<String> loadAllEmployeeEmailsLower() {
        List<EmailLowerProjection> rows = namedParameterJdbcTemplate.query(
            "select lower(email) as email from party.employee where email is not null",
            params(new EmptyParams()),
            BeanPropertyRowMapper.newInstance(EmailLowerProjection.class)
        );
        return rows.stream().map(EmailLowerProjection::getEmail).toList();
    }

    public List<Map<String, Object>> loadActiveEmployeeIdEmail() {
        return namedParameterJdbcTemplate.queryForList(
            "select id, email from party.employee where deleted = false",
            params(new EmptyParams())
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
        InsertEmployeeParams sqlParams = new InsertEmployeeParams(
            sapId,
            fullName,
            email,
            personalNumber,
            firstName,
            surname,
            middleName,
            phoneNumber
        );
        return namedParameterJdbcTemplate.update(
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
            ) values (
                :sapId,
                :fullName,
                :email,
                :personalNumber,
                :firstName,
                :surname,
                :middleName,
                :phoneNumber,
                false,
                now(),
                now()
            )
            """,
            params(sqlParams)
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
        UpdateEmployeeByEmailParams sqlParams = new UpdateEmployeeByEmailParams(
            sapId,
            fullName,
            personalNumber,
            firstName,
            surname,
            middleName,
            phoneNumber,
            email
        );
        return namedParameterJdbcTemplate.update(
            """
            update party.employee
            set sap_id = :sapId,
                full_name = :fullName,
                personal_number = :personalNumber,
                first_name = :firstName,
                surname = :surname,
                middle_name = :middleName,
                phone_number = :phoneNumber,
                deleted = false,
                updated_at = now()
            where email = :email
            """,
            params(sqlParams)
        );
    }

    public int markEmployeeDeletedById(Object employeeId) {
        UUID id = employeeId instanceof UUID ? (UUID) employeeId : UUID.fromString(String.valueOf(employeeId));
        return namedParameterJdbcTemplate.update(
            "update party.employee set deleted = true, updated_at = now() where id = :employeeId",
            params(new EmployeeIdParams(id))
        );
    }

    public <T> List<T> queryForBeans(String sql, Class<T> beanType, Object... args) {
        PositionalSqlAdapter.SqlWithParams prepared = PositionalSqlAdapter.prepare(sql, args);
        return namedParameterJdbcTemplate.query(prepared.sql(), prepared.params(), BeanPropertyRowMapper.newInstance(beanType));
    }

    public static class EmailLowerProjection {
        private String email;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }
    }

    private static BeanPropertySqlParameterSource params(Object value) {
        return new BeanPropertySqlParameterSource(value);
    }

    private record EmptyParams() {
    }

    private record EmployeeIdParams(UUID employeeId) {
    }

    private record InsertEmployeeParams(
        String sapId,
        String fullName,
        String email,
        Integer personalNumber,
        String firstName,
        String surname,
        String middleName,
        String phoneNumber
    ) {
    }

    private record UpdateEmployeeByEmailParams(
        String sapId,
        String fullName,
        Integer personalNumber,
        String firstName,
        String surname,
        String middleName,
        String phoneNumber,
        String email
    ) {
    }
}
