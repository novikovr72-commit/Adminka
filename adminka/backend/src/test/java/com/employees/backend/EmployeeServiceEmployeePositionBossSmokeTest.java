package com.employees.backend;

import com.employees.backend.repository.EmployeeRepository;
import com.employees.backend.service.EmployeeService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class EmployeeServiceEmployeePositionBossSmokeTest {

    @Test
    void createEmployeePositionSavesBossEmployeeIdIntoParentId() {
        CapturingEmployeeRepository repository = new CapturingEmployeeRepository();
        EmployeeService employeeService = new EmployeeService(repository, "backend/logs");

        String employeeId = "11111111-1111-4111-8111-111111111111";
        String organUnitId = "22222222-2222-4222-8222-222222222222";
        String employeePositionId = "33333333-3333-4333-8333-333333333333";
        String bossEmployeeId = "44444444-4444-4444-8444-444444444444";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("employeeId", employeeId);
        body.put("organUnitId", organUnitId);
        body.put("employeePositionId", employeePositionId);
        body.put("bossEmployeeId", bossEmployeeId);

        ResponseEntity<Map<String, Object>> response = employeeService.employeePositionCreate(body);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(repository.capturedInsertParentId);
        assertEquals(bossEmployeeId, repository.capturedInsertParentId);
    }

    @Test
    void updateEmployeePositionSavesBossEmployeeIdIntoParentId() {
        CapturingEmployeeRepository repository = new CapturingEmployeeRepository();
        EmployeeService employeeService = new EmployeeService(repository, "backend/logs");

        String employeeOrganId = "66666666-6666-4666-8666-666666666666";
        String employeeId = "11111111-1111-4111-8111-111111111111";
        String organUnitId = "22222222-2222-4222-8222-222222222222";
        String employeePositionId = "33333333-3333-4333-8333-333333333333";
        String bossEmployeeId = "77777777-7777-4777-8777-777777777777";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("employeeId", employeeId);
        body.put("organUnitId", organUnitId);
        body.put("employeePositionId", employeePositionId);
        body.put("bossEmployeeId", bossEmployeeId);

        ResponseEntity<Map<String, Object>> response = employeeService.employeePositionUpdate(employeeOrganId, body);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(repository.capturedUpdateParentId);
        assertEquals(bossEmployeeId, repository.capturedUpdateParentId);
    }

    private static class CapturingEmployeeRepository extends EmployeeRepository {
        private String capturedInsertParentId;
        private String capturedUpdateParentId;

        private CapturingEmployeeRepository() {
            super(new NamedParameterJdbcTemplate(new org.springframework.jdbc.core.JdbcTemplate()));
        }

        @Override
        public <T> T queryForNamedObject(String sql, Class<T> requiredType, Object beanParams) {
            if (sql.contains("select count(*)::int")) {
                return requiredType.cast(Integer.valueOf(0));
            }
            if (sql.contains("insert into party.emp_pos_empl_org_unit")) {
                this.capturedInsertParentId = String.valueOf(readParam(beanParams, "parentId"));
                return requiredType.cast("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
            }
            throw new IllegalStateException("Unexpected queryForObject SQL in test");
        }

        @Override
        public int updateNamed(String sql, Object beanParams) {
            if (sql.contains("update party.emp_pos_empl_org_unit")) {
                this.capturedUpdateParentId = String.valueOf(readParam(beanParams, "parentId"));
                return 1;
            }
            throw new IllegalStateException("Unexpected update SQL in test");
        }

        @Override
        public Map<String, Object> queryForNamedMap(String sql, Object beanParams) {
            return Map.of(
                "employeeOrganId", readParam(beanParams, "employeeOrganId"),
                "boss_id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "boss_name", "Boss Name"
            );
        }

        private Object readParam(Object beanParams, String name) {
            if (beanParams == null) {
                return null;
            }
            try {
                java.lang.reflect.Method accessor = beanParams.getClass().getDeclaredMethod(name);
                accessor.setAccessible(true);
                return accessor.invoke(beanParams);
            } catch (Exception exception) {
                throw new IllegalStateException("Cannot read parameter: " + name, exception);
            }
        }
    }
}
