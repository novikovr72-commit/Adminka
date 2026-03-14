package com.employees.backend;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.BooleanSchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Configuration
public class OpenApiSchemasConfig {

    @Bean
    public OpenApiCustomizer explicitApiSchemasCustomizer() {
        return openApi -> {
            ensureComponents(openApi);
            registerSchemas(openApi.getComponents().getSchemas());

            setJsonResponse(openApi, "/api/health", PathItem.HttpMethod.GET, "HealthResponse");
            setJsonResponse(openApi, "/api/db-health", PathItem.HttpMethod.GET, "DbHealthResponse");
            setJsonResponse(openApi, "/api/list_organizations", PathItem.HttpMethod.GET, "OrganizationLookupResponse");
            setJsonResponse(openApi, "/api/list_relations", PathItem.HttpMethod.GET, "LookupListResponse");
            setJsonResponse(openApi, "/api/list_product_groups", PathItem.HttpMethod.GET, "LookupListResponse");
            setJsonResponse(openApi, "/api/list_positions", PathItem.HttpMethod.GET, "PositionLookupResponse");
            setJsonResponse(openApi, "/api/list_employees", PathItem.HttpMethod.GET, "EmployeeLookupResponse");
            setJsonRequest(openApi, "/api/relations", PathItem.HttpMethod.POST, "application/json", "RelationsQueryRequest");
            setJsonResponse(openApi, "/api/relations", PathItem.HttpMethod.POST, "RelationsResponse");

            setJsonResponse(openApi, "/api/employees", PathItem.HttpMethod.GET, "MethodHintResponse");
            setJsonRequest(openApi, "/api/employees", PathItem.HttpMethod.POST, "application/json", "EmployeesQueryRequest");
            setJsonResponse(openApi, "/api/employees", PathItem.HttpMethod.POST, "EmployeesQueryResponse");
            setJsonRequest(openApi, "/api/employees/export", PathItem.HttpMethod.POST, "application/json", "EmployeesExportRequest");
            setBinaryResponse(openApi, "/api/employees/export", PathItem.HttpMethod.POST);
            setMultipartRequest(openApi, "/api/employees/import", PathItem.HttpMethod.POST, "EmployeesImportRequest");
            setJsonResponse(openApi, "/api/employees/import", PathItem.HttpMethod.POST, "ImportResponse");

            setJsonResponse(openApi, "/api/organizations", PathItem.HttpMethod.GET, "MethodHintResponse");
            setJsonRequest(openApi, "/api/organizations", PathItem.HttpMethod.POST, "application/json", "OrganizationsQueryRequest");
            setJsonResponse(openApi, "/api/organizations", PathItem.HttpMethod.POST, "OrganizationsQueryResponse");
            setJsonRequest(openApi, "/api/organizations/export", PathItem.HttpMethod.POST, "application/json", "OrganizationsExportRequest");
            setBinaryResponse(openApi, "/api/organizations/export", PathItem.HttpMethod.POST);

            setJsonRequest(openApi, "/api/relation/{employeeId}", PathItem.HttpMethod.POST, "application/json", "EmployeeRelationsQueryRequest");
            setJsonResponse(openApi, "/api/relation/{employeeId}", PathItem.HttpMethod.POST, "EmployeeRelationsResponse");

            setJsonRequest(openApi, "/api/relation", PathItem.HttpMethod.POST, "application/json", "RelationMutationRequest");
            setJsonResponse(openApi, "/api/relation", PathItem.HttpMethod.POST, "RelationMutationResponse");

            setJsonRequest(openApi, "/api/relation/{relationId}", PathItem.HttpMethod.PATCH, "application/json", "RelationMutationRequest");
            setJsonResponse(openApi, "/api/relation/{relationId}", PathItem.HttpMethod.PATCH, "RelationMutationResponse");
            setJsonResponse(openApi, "/api/relation/{relationId}", PathItem.HttpMethod.DELETE, "DeleteResponse");

            setJsonResponse(openApi, "/api/employee-position/{employeeOrganId}", PathItem.HttpMethod.DELETE, "DeleteResponse");
            setJsonRequest(openApi, "/api/employee-position", PathItem.HttpMethod.POST, "application/json", "EmployeePositionMutationRequest");
            setJsonResponse(openApi, "/api/employee-position", PathItem.HttpMethod.POST, "EmployeePositionMutationResponse");
            setJsonRequest(openApi, "/api/employee-position/{employeeOrganId}", PathItem.HttpMethod.PATCH, "application/json", "EmployeePositionMutationRequest");
            setJsonResponse(openApi, "/api/employee-position/{employeeOrganId}", PathItem.HttpMethod.PATCH, "EmployeePositionMutationResponse");
            setJsonRequest(openApi, "/api/employee", PathItem.HttpMethod.POST, "application/json", "EmployeeSaveRequest");
            setJsonResponse(openApi, "/api/employee", PathItem.HttpMethod.POST, "EmployeeSaveResponse");
            setJsonRequest(openApi, "/api/employee/{employeeId}", PathItem.HttpMethod.PATCH, "application/json", "EmployeeSaveRequest");
            setJsonResponse(openApi, "/api/employee/{employeeId}", PathItem.HttpMethod.PATCH, "EmployeeSaveResponse");
            setJsonResponse(openApi, "/api/employee/{employeeId}", PathItem.HttpMethod.DELETE, "DeleteResponse");

            removeLegacySnakeCaseParameters(openApi);
            setDefaultErrorSchemas(openApi);
        };
    }

    private void ensureComponents(OpenAPI openApi) {
        if (openApi.getComponents() == null) {
            openApi.setComponents(new Components());
        }
        if (openApi.getComponents().getSchemas() == null) {
            openApi.getComponents().setSchemas(new LinkedHashMap<>());
        }
    }

    private void registerSchemas(Map<String, Schema> schemas) {
        schemas.putIfAbsent("ErrorResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "error", new StringSchema()
            ),
            "ok", "error"
        ));

        schemas.putIfAbsent("HealthResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "message", new StringSchema()
            ),
            "ok", "message"
        ));

        schemas.putIfAbsent("DbHealthResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "database", new StringSchema(),
                "error", new StringSchema()
            ),
            "ok"
        ));

        schemas.putIfAbsent("MethodHintResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "error", new StringSchema(),
                "expected_method", new StringSchema()
            ),
            "ok", "error"
        ));

        schemas.putIfAbsent("SortRule", objectSchema(
            Map.of(
                "field", new StringSchema(),
                "direction", new StringSchema()._enum(java.util.List.of("ASC", "DESC"))
            ),
            "field", "direction"
        ));

        schemas.putIfAbsent("LookupItem", objectSchema(
            Map.of(
                "id", new StringSchema(),
                "name", new StringSchema(),
                "sh_name", new StringSchema()
            ),
            "id", "name"
        ));

        schemas.putIfAbsent("OrganizationLookupItem", objectSchema(
            Map.of(
                "id", new StringSchema(),
                "sh_name", new StringSchema(),
                "sap_id", new StringSchema(),
                "inn", new StringSchema(),
                "kpp", new StringSchema(),
                "ogrn", new StringSchema(),
                "full_address", new StringSchema()
            ),
            "id", "sh_name"
        ));

        schemas.putIfAbsent("PositionLookupItem", objectSchema(
            Map.of(
                "position_id", new StringSchema(),
                "position_name", new StringSchema()
            ),
            "position_id", "position_name"
        ));

        schemas.putIfAbsent("LookupListResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "items", refArray("LookupItem")
            ),
            "ok", "items"
        ));

        schemas.putIfAbsent("OrganizationLookupResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "items", refArray("OrganizationLookupItem")
            ),
            "ok", "items"
        ));

        schemas.putIfAbsent("PositionLookupResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "items", refArray("PositionLookupItem")
            ),
            "ok", "items"
        ));

        schemas.putIfAbsent("EmployeeLookupItem", objectSchema(
            Map.of(
                "employeeId", new StringSchema(),
                "employeeFullName", new StringSchema()
            ),
            "employeeId", "employeeFullName"
        ));

        schemas.putIfAbsent("EmployeeLookupResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "items", refArray("EmployeeLookupItem")
            ),
            "ok", "items"
        ));

        schemas.putIfAbsent("EmployeesQueryRequest", objectSchema(
            Map.ofEntries(
                Map.entry("limit", new IntegerSchema()),
                Map.entry("offset", new IntegerSchema()),
                Map.entry("employee_id", new StringSchema()),
                Map.entry("sorts", refArray("SortRule")),
                Map.entry("full_name", new StringSchema()),
                Map.entry("surname", new StringSchema()),
                Map.entry("first_name", new StringSchema()),
                Map.entry("middle_name", new StringSchema()),
                Map.entry("email", new StringSchema()),
                Map.entry("personal_number", new StringSchema()),
                Map.entry("phone_number", new StringSchema()),
                Map.entry("sap_id", new StringSchema()),
                Map.entry("status", new StringSchema()),
                Map.entry("organ_name", new StringSchema()),
                Map.entry("depart_name", new StringSchema()),
                Map.entry("position_name", new StringSchema()),
                Map.entry("boss_name", new StringSchema())
            )
        ));

        schemas.putIfAbsent("EmployeePositionItem", objectSchema(
            Map.ofEntries(
                Map.entry("employeeOrganId", new StringSchema()),
                Map.entry("organ_name", new StringSchema()),
                Map.entry("organ_unit_id", new StringSchema()),
                Map.entry("organ_sap_id", new StringSchema()),
                Map.entry("organ_inn", new StringSchema()),
                Map.entry("organ_kpp", new StringSchema()),
                Map.entry("organ_ogrn", new StringSchema()),
                Map.entry("organ_full_address", new StringSchema()),
                Map.entry("depart_name", new StringSchema()),
                Map.entry("depart_unit_id", new StringSchema()),
                Map.entry("position_id", new StringSchema()),
                Map.entry("position_name", new StringSchema()),
                Map.entry("boss_id", new StringSchema()),
                Map.entry("boss_name", new StringSchema())
            ),
            "employeeOrganId", "organ_name", "position_name"
        ));

        schemas.putIfAbsent("EmployeeItem", objectSchema(
            Map.ofEntries(
                Map.entry("employee_id", new StringSchema()),
                Map.entry("full_name", new StringSchema()),
                Map.entry("surname", new StringSchema()),
                Map.entry("first_name", new StringSchema()),
                Map.entry("middle_name", new StringSchema()),
                Map.entry("email", new StringSchema()),
                Map.entry("personal_number", new IntegerSchema()),
                Map.entry("phone_number", new StringSchema()),
                Map.entry("sap_id", new StringSchema()),
                Map.entry("status", new StringSchema()),
                Map.entry("organ_name", new StringSchema()),
                Map.entry("depart_name", new StringSchema()),
                Map.entry("position_name", new StringSchema()),
                Map.entry("boss_name", new StringSchema()),
                Map.entry("positions", refArray("EmployeePositionItem"))
            ),
            "employee_id", "full_name", "email", "positions"
        ));

        schemas.putIfAbsent("EmployeesQueryResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "items", refArray("EmployeeItem"),
                "count", new IntegerSchema(),
                "total_count", new IntegerSchema(),
                "limit", new IntegerSchema(),
                "offset", new IntegerSchema(),
                "sorts", refArray("SortRule")
            ),
            "ok", "items", "count", "total_count"
        ));

        schemas.putIfAbsent("EmployeeSaveRequest", objectSchema(
            Map.of(
                "surname", new StringSchema(),
                "first_name", new StringSchema(),
                "middle_name", new StringSchema(),
                "email", new StringSchema(),
                "phone_number", new StringSchema(),
                "sap_id", new StringSchema(),
                "personal_number", new StringSchema(),
                "status", new StringSchema()._enum(java.util.List.of("ACTIVE", "INACTIVE"))
            ),
            "email", "status"
        ));

        schemas.putIfAbsent("EmployeeSaveItem", objectSchema(
            Map.of(
                "id", new StringSchema(),
                "full_name", new StringSchema(),
                "surname", new StringSchema(),
                "first_name", new StringSchema(),
                "middle_name", new StringSchema(),
                "email", new StringSchema(),
                "phone_number", new StringSchema(),
                "sap_id", new StringSchema(),
                "personal_number", new IntegerSchema(),
                "status", new StringSchema()
            ),
            "id", "email", "status"
        ));

        schemas.putIfAbsent("EmployeeSaveResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "item", refSchema("EmployeeSaveItem")
            ),
            "ok", "item"
        ));

        schemas.putIfAbsent("EmployeesExportRequest", schemas.get("EmployeesQueryRequest"));

        schemas.putIfAbsent("EmployeesImportRequest", objectSchema(
            Map.of(
                "file", new StringSchema().format("binary"),
                "delete_missing", new StringSchema()._enum(java.util.List.of("true", "false"))
            ),
            "file"
        ));

        schemas.putIfAbsent("ImportResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "total_read", new IntegerSchema(),
                "created", new IntegerSchema(),
                "updated", new IntegerSchema(),
                "deleted", new IntegerSchema(),
                "errors", new IntegerSchema(),
                "log_file", new StringSchema(),
                "log_url", new StringSchema()
            ),
            "ok"
        ));

        schemas.putIfAbsent("OrganizationItem", objectSchema(
            Map.ofEntries(
                Map.entry("id", new StringSchema()),
                Map.entry("sap_id", new StringSchema()),
                Map.entry("name", new StringSchema()),
                Map.entry("sh_name", new StringSchema()),
                Map.entry("inn", new StringSchema()),
                Map.entry("kpp", new StringSchema()),
                Map.entry("ogrn", new StringSchema()),
                Map.entry("okpo", new StringSchema()),
                Map.entry("country_name", new StringSchema()),
                Map.entry("address", new StringSchema()),
                Map.entry("sign_resident", new StringSchema())
            ),
            "id", "name"
        ));

        schemas.putIfAbsent("OrganizationsQueryRequest", objectSchema(
            Map.ofEntries(
                Map.entry("limit", new IntegerSchema()),
                Map.entry("offset", new IntegerSchema()),
                Map.entry("sorts", refArray("SortRule")),
                Map.entry("sap_id", new StringSchema()),
                Map.entry("name", new StringSchema()),
                Map.entry("sh_name", new StringSchema()),
                Map.entry("inn", new StringSchema()),
                Map.entry("kpp", new StringSchema()),
                Map.entry("ogrn", new StringSchema()),
                Map.entry("okpo", new StringSchema()),
                Map.entry("country_name", new StringSchema()),
                Map.entry("address", new StringSchema()),
                Map.entry("sign_resident", new StringSchema())
            )
        ));

        schemas.putIfAbsent("OrganizationsQueryResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "items", refArray("OrganizationItem"),
                "count", new IntegerSchema(),
                "total_count", new IntegerSchema(),
                "limit", new IntegerSchema(),
                "offset", new IntegerSchema(),
                "sorts", refArray("SortRule")
            ),
            "ok", "items", "count", "total_count"
        ));

        schemas.putIfAbsent("OrganizationsExportRequest", schemas.get("OrganizationsQueryRequest"));

        schemas.putIfAbsent("EmployeeRelationsQueryRequest", objectSchema(
            Map.of(
                "limit", new IntegerSchema(),
                "offset", new IntegerSchema(),
                "sorts", refArray("SortRule"),
                "organName", new StringSchema(),
                "relationName", new StringSchema(),
                "defaultFlag", new StringSchema(),
                "salesOrganName", new StringSchema(),
                "productGroupName", new StringSchema()
            )
        ));

        schemas.putIfAbsent("RelationItem", objectSchema(
            Map.of(
                "relationId", new StringSchema(),
                "organUnitId", new StringSchema(),
                "organName", new StringSchema(),
                "relationTypeId", new StringSchema(),
                "relationName", new StringSchema(),
                "defaultFlag", new BooleanSchema(),
                "salesOrganUnitId", new StringSchema(),
                "salesOrganName", new StringSchema(),
                "productGroupId", new StringSchema(),
                "productGroupName", new StringSchema()
            ),
            "relationId", "organName", "relationName"
        ));

        schemas.putIfAbsent("EmployeeRelationsResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "items", refArray("RelationItem"),
                "count", new IntegerSchema(),
                "totalCount", new IntegerSchema(),
                "limit", new IntegerSchema(),
                "offset", new IntegerSchema(),
                "sorts", refArray("SortRule")
            ),
            "ok", "items"
        ));

        schemas.putIfAbsent("RelationMutationRequest", objectSchema(
            Map.of(
                "employeeId", new StringSchema(),
                "organUnitId", new StringSchema(),
                "relationTypeId", new StringSchema(),
                "defaultFlag", new StringSchema()._enum(java.util.List.of("ДА", "НЕТ")),
                "salesOrganizationId", new StringSchema(),
                "productGroupsId", new StringSchema()
            ),
            "employeeId", "organUnitId", "relationTypeId", "defaultFlag"
        ));

        schemas.putIfAbsent("RelationMutationResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "item", refSchema("RelationItem"),
                "message", new StringSchema()
            ),
            "ok"
        ));

        schemas.putIfAbsent("RelationEmployeeItem", objectSchema(
            Map.ofEntries(
                Map.entry("relationId", new StringSchema()),
                Map.entry("employeeId", new StringSchema()),
                Map.entry("employeeName", new StringSchema()),
                Map.entry("organName", new StringSchema()),
                Map.entry("organSapId", new StringSchema()),
                Map.entry("organInn", new StringSchema()),
                Map.entry("organKpp", new StringSchema()),
                Map.entry("organOgrn", new StringSchema()),
                Map.entry("organFullAddress", new StringSchema()),
                Map.entry("organUnitId", new StringSchema()),
                Map.entry("relationName", new StringSchema()),
                Map.entry("relationTypeId", new StringSchema()),
                Map.entry("salesOrganName", new StringSchema()),
                Map.entry("salesOrganUnitId", new StringSchema()),
                Map.entry("productGroupName", new StringSchema()),
                Map.entry("productGroupId", new StringSchema()),
                Map.entry("defaultFlag", new BooleanSchema())
            ),
            "relationId", "employeeId", "employeeName", "organName", "relationName"
        ));

        schemas.putIfAbsent("RelationsResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "items", refArray("RelationEmployeeItem"),
                "count", new IntegerSchema(),
                "totalCount", new IntegerSchema(),
                "sorts", refArray("SortRule")
            ),
            "ok", "items", "count", "totalCount"
        ));

        schemas.putIfAbsent("RelationsQueryRequest", objectSchema(
            Map.ofEntries(
                Map.entry("limit", new IntegerSchema()),
                Map.entry("offset", new IntegerSchema()),
                Map.entry("sorts", refArray("SortRule")),
                Map.entry("sortField", new StringSchema()),
                Map.entry("sortDirection", new StringSchema()._enum(java.util.List.of("ASC", "DESC"))),
                Map.entry("organName", new StringSchema()),
                Map.entry("relationName", new StringSchema()),
                Map.entry("salesOrganName", new StringSchema()),
                Map.entry("productGroupName", new StringSchema()),
                Map.entry("defaultFlag", new StringSchema()),
                Map.entry("employeeName", new StringSchema())
            )
        ));

        schemas.putIfAbsent("EmployeePositionMutationRequest", objectSchema(
            Map.of(
                "employee_id", new StringSchema(),
                "organ_unit_id", new StringSchema(),
                "depart_unit_id", new StringSchema(),
                "position_id", new StringSchema(),
                "boss_employee_id", new StringSchema()
            ),
            "employee_id", "organ_unit_id", "position_id"
        ));

        schemas.putIfAbsent("EmployeePositionMutationResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "item", refSchema("EmployeePositionItem"),
                "message", new StringSchema()
            ),
            "ok"
        ));

        schemas.putIfAbsent("DeleteResponse", objectSchema(
            Map.of(
                "ok", new BooleanSchema(),
                "message", new StringSchema(),
                "deleted_count", new IntegerSchema()
            ),
            "ok", "message"
        ));
    }

    private void setDefaultErrorSchemas(OpenAPI openApi) {
        if (openApi.getPaths() == null) {
            return;
        }
        for (PathItem pathItem : openApi.getPaths().values()) {
            if (pathItem == null || pathItem.readOperations() == null) {
                continue;
            }
            for (Operation operation : pathItem.readOperations()) {
                if (operation == null) {
                    continue;
                }
                ApiResponses responses = operation.getResponses();
                if (responses == null) {
                    responses = new ApiResponses();
                    operation.setResponses(responses);
                }
                setJsonSchema(ensureResponse(responses, "400"), "ErrorResponse");
                setJsonSchema(ensureResponse(responses, "500"), "ErrorResponse");
            }
        }
    }

    private void removeLegacySnakeCaseParameters(OpenAPI openApi) {
        if (openApi.getPaths() == null) {
            return;
        }
        for (PathItem pathItem : openApi.getPaths().values()) {
            if (pathItem == null || pathItem.readOperations() == null) {
                continue;
            }
            for (Operation operation : pathItem.readOperations()) {
                if (operation == null || operation.getParameters() == null || operation.getParameters().isEmpty()) {
                    continue;
                }
                List<Parameter> parameters = operation.getParameters();
                Set<String> parameterNames = new HashSet<>();
                for (Parameter parameter : parameters) {
                    if (parameter != null && parameter.getName() != null) {
                        parameterNames.add(parameter.getName());
                    }
                }
                List<Parameter> filtered = new ArrayList<>();
                for (Parameter parameter : parameters) {
                    String name = parameter == null ? null : parameter.getName();
                    if (name == null) {
                        filtered.add(parameter);
                        continue;
                    }
                    if (name.contains("_") && parameterNames.contains(toCamelCase(name))) {
                        continue;
                    }
                    filtered.add(parameter);
                }
                operation.setParameters(filtered);
            }
        }
    }

    private String toCamelCase(String snakeCaseName) {
        StringBuilder result = new StringBuilder();
        boolean uppercaseNext = false;
        for (int index = 0; index < snakeCaseName.length(); index += 1) {
            char current = snakeCaseName.charAt(index);
            if (current == '_') {
                uppercaseNext = true;
                continue;
            }
            if (uppercaseNext) {
                result.append(Character.toUpperCase(current));
                uppercaseNext = false;
            } else {
                result.append(current);
            }
        }
        return result.toString();
    }

    private void setJsonRequest(OpenAPI openApi, String path, PathItem.HttpMethod method, String contentType, String schemaName) {
        Operation operation = getOperation(openApi, path, method);
        if (operation == null) {
            return;
        }
        if (operation.getRequestBody() == null) {
            operation.setRequestBody(new RequestBody());
        }
        if (operation.getRequestBody().getContent() == null) {
            operation.getRequestBody().setContent(new Content());
        }
        MediaType mediaType = operation.getRequestBody().getContent().get(contentType);
        if (mediaType == null) {
            mediaType = new MediaType();
            operation.getRequestBody().getContent().addMediaType(contentType, mediaType);
        }
        mediaType.setSchema(refSchema(schemaName));
    }

    private void setMultipartRequest(OpenAPI openApi, String path, PathItem.HttpMethod method, String schemaName) {
        setJsonRequest(openApi, path, method, "multipart/form-data", schemaName);
    }

    private void setJsonResponse(OpenAPI openApi, String path, PathItem.HttpMethod method, String schemaName) {
        Operation operation = getOperation(openApi, path, method);
        if (operation == null) {
            return;
        }
        ApiResponses responses = operation.getResponses();
        if (responses == null) {
            responses = new ApiResponses();
            operation.setResponses(responses);
        }
        ApiResponse response = ensureResponse(responses, "200");
        setJsonSchema(response, schemaName);
    }

    private void setBinaryResponse(OpenAPI openApi, String path, PathItem.HttpMethod method) {
        Operation operation = getOperation(openApi, path, method);
        if (operation == null) {
            return;
        }
        ApiResponses responses = operation.getResponses();
        if (responses == null) {
            responses = new ApiResponses();
            operation.setResponses(responses);
        }
        ApiResponse response = ensureResponse(responses, "200");
        Content content = response.getContent();
        if (content == null) {
            content = new Content();
            response.setContent(content);
        }
        Schema<String> binarySchema = new StringSchema().format("binary");
        content.addMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new MediaType().schema(binarySchema));
        content.addMediaType("application/octet-stream", new MediaType().schema(binarySchema));
    }

    private ApiResponse ensureResponse(ApiResponses responses, String statusCode) {
        ApiResponse response = responses.get(statusCode);
        if (response == null) {
            response = new ApiResponse().description("OK");
            responses.addApiResponse(statusCode, response);
        }
        return response;
    }

    private void setJsonSchema(ApiResponse response, String schemaName) {
        Content content = response.getContent();
        if (content == null) {
            content = new Content();
            response.setContent(content);
        }
        MediaType mediaType = content.get("application/json");
        if (mediaType == null) {
            mediaType = new MediaType();
            content.addMediaType("application/json", mediaType);
        }
        mediaType.setSchema(refSchema(schemaName));
    }

    private Operation getOperation(OpenAPI openApi, String path, PathItem.HttpMethod method) {
        if (openApi.getPaths() == null) {
            return null;
        }
        PathItem pathItem = openApi.getPaths().get(path);
        if (pathItem == null || pathItem.readOperationsMap() == null) {
            return null;
        }
        return pathItem.readOperationsMap().get(method);
    }

    private Schema<?> refSchema(String name) {
        return new Schema<>().$ref("#/components/schemas/" + name);
    }

    private ArraySchema refArray(String schemaName) {
        return new ArraySchema().items(refSchema(schemaName));
    }

    private ObjectSchema objectSchema(Map<String, Schema> properties, String... requiredFields) {
        ObjectSchema schema = new ObjectSchema();
        for (Map.Entry<String, Schema> property : properties.entrySet()) {
            schema.addProperty(property.getKey(), property.getValue());
        }
        for (String requiredField : requiredFields) {
            schema.addRequiredItem(requiredField);
        }
        return schema;
    }
}
