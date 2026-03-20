package com.employees.backend;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.report-template")
public class AppReportTemplateProperties {

    private Integer excelMaxRows = 500000;

    public Integer getExcelMaxRows() {
        return excelMaxRows;
    }

    public void setExcelMaxRows(Integer excelMaxRows) {
        this.excelMaxRows = excelMaxRows;
    }
}

