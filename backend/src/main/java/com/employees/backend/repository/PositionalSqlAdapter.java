package com.employees.backend.repository;

import org.springframework.jdbc.core.namedparam.BeanPropertySqlParameterSource;

final class PositionalSqlAdapter {

    private PositionalSqlAdapter() {
    }

    record SqlWithParams(String sql, BeanPropertySqlParameterSource params) {
    }

    static SqlWithParams prepare(String sql, Object... args) {
        Object[] safeArgs = args == null ? new Object[0] : args;
        if (safeArgs.length == 0) {
            return new SqlWithParams(sql, new BeanPropertySqlParameterSource(new IndexedArgs(safeArgs)));
        }

        StringBuilder convertedSql = new StringBuilder(sql.length() + safeArgs.length * 8);
        boolean inSingleQuote = false;
        int paramIndex = 0;
        for (int index = 0; index < sql.length(); index += 1) {
            char current = sql.charAt(index);
            if (current == '\'') {
                if (inSingleQuote && index + 1 < sql.length() && sql.charAt(index + 1) == '\'') {
                    convertedSql.append("''");
                    index += 1;
                    continue;
                }
                inSingleQuote = !inSingleQuote;
                convertedSql.append(current);
                continue;
            }
            if (!inSingleQuote && current == '?') {
                convertedSql.append(":args[").append(paramIndex).append("]");
                paramIndex += 1;
                continue;
            }
            convertedSql.append(current);
        }

        if (paramIndex != safeArgs.length) {
            throw new IllegalArgumentException(
                "Количество параметров не совпадает с SQL: placeholders=" + paramIndex + ", args=" + safeArgs.length
            );
        }

        return new SqlWithParams(convertedSql.toString(), new BeanPropertySqlParameterSource(new IndexedArgs(safeArgs)));
    }

    static final class IndexedArgs {
        private final Object[] args;

        IndexedArgs(Object[] args) {
            this.args = args == null ? new Object[0] : args.clone();
        }

        public Object[] getArgs() {
            return args.clone();
        }
    }
}
