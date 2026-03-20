package com.employees.backend;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.report-template")
public class AppReportTemplateProperties {

    private Integer excelMaxRows = 500000;
    /** Пусто = Europe/Moscow. Иначе IANA ID (например UTC). */
    private String excelTimezone = "";

    public Integer getExcelMaxRows() {
        return excelMaxRows;
    }

    public void setExcelMaxRows(Integer excelMaxRows) {
        this.excelMaxRows = excelMaxRows;
    }

    public String getExcelTimezone() {
        return excelTimezone;
    }

    public void setExcelTimezone(String excelTimezone) {
        this.excelTimezone = excelTimezone;
    }
}

