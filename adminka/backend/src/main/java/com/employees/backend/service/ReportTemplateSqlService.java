package com.employees.backend.service;

import com.employees.backend.repository.ReportTemplateRepository;
import org.springframework.stereotype.Service;

@Service
public class ReportTemplateSqlService extends ReportTemplateSqlCore {
    public ReportTemplateSqlService(ReportTemplateRepository reportTemplateRepository) {
        super(reportTemplateRepository);
    }
}
