package com.employees.backend;

import com.employees.backend.repository.EmployeeRepository;
import com.employees.backend.service.EmployeeService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

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
        assertNotNull(repository.capturedInsertArgs);
        assertEquals(bossEmployeeId, repository.capturedInsertArgs[3]);
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
        assertNotNull(repository.capturedUpdateArgs);
        assertEquals(bossEmployeeId, repository.capturedUpdateArgs[3]);
    }

    private static class CapturingEmployeeRepository extends EmployeeRepository {
        private Object[] capturedInsertArgs;
        private Object[] capturedUpdateArgs;

        private CapturingEmployeeRepository() {
            super(new JdbcTemplate());
        }

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            if (sql.contains("select count(*)::int")) {
                return requiredType.cast(Integer.valueOf(0));
            }
            if (sql.contains("insert into party.emp_pos_empl_org_unit")) {
                this.capturedInsertArgs = args;
                return requiredType.cast("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
            }
            throw new IllegalStateException("Unexpected queryForObject SQL in test");
        }

        @Override
        public int update(String sql, Object... args) {
            if (sql.contains("update party.emp_pos_empl_org_unit")) {
                this.capturedUpdateArgs = args;
                return 1;
            }
            throw new IllegalStateException("Unexpected update SQL in test");
        }

        @Override
        public Map<String, Object> queryForMap(String sql, Object... args) {
            return Map.of(
                "employeeOrganId", args[0],
                "boss_id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "boss_name", "Boss Name"
            );
        }
    }
}
