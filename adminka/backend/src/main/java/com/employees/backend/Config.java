package com.employees.backend;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.sql.DataSource;
import java.net.URI;
import java.nio.file.Path;

@Configuration
public class Config implements WebMvcConfigurer {

    @Value("${app.logs-dir:backend/logs}")
    private String logsDir;

    @Value("${spring.datasource.url:jdbc:postgresql://localhost:5432/employees}")
    private String jdbcUrl;

    @Value("${spring.datasource.username:roman}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedMethods("*")
            .allowedHeaders("*")
            .exposedHeaders(
                "Content-Disposition",
                "X-Execution-Ms",
                "X-Execution-Time",
                "X-Selected-Rows",
                "X-Preview-Limit",
                "X-Query-Execution-Ms",
                "X-Template-Fill-Ms",
                "X-Query-Execution-Ns",
                "X-Template-Fill-Ns"
            )
            .allowedOrigins("*");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path absoluteLogsPath = Path.of(logsDir).toAbsolutePath().normalize();
        registry
            .addResourceHandler("/api/admin/import-logs/**", "/api/import-logs/**")
            .addResourceLocations("file:" + absoluteLogsPath + "/");
    }

    @Bean
    public DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.postgresql.Driver");
        dataSource.setUrl(jdbcUrl);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        return dataSource;
    }
}

@RestController
class AliasController {

    @GetMapping({"/api/admin/openapi", "/api/openapi"})
    public void openapiAlias(HttpServletRequest request, HttpServletResponse response) throws Exception {
        request.getRequestDispatcher("/api/admin/openapi.json").forward(request, response);
    }

    @GetMapping("/api/openapi.json")
    public void openapiJsonAlias(HttpServletRequest request, HttpServletResponse response) throws Exception {
        request.getRequestDispatcher("/api/admin/openapi.json").forward(request, response);
    }

    @GetMapping({"/swagger", "/api/swagger", "/api/docs"})
    public ResponseEntity<Void> swaggerAlias(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create("/api/admin/docs")).build();
    }
}
