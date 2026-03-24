/** URL карточек для гиперссылок полей справочника (согласовано с App.jsx). */

const URL_EMPLOYEE_ID_PARAM = "employeeId";
const URL_ORGANIZATION_ID_PARAM = "organUnitId";
const PATH_EMPLOYEES = "/employees";
const PATH_ORGANIZATIONS = "/organizations";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeEmployeeId(value) {
  const normalized = String(value ?? "").trim();
  return UUID_PATTERN.test(normalized) ? normalized : "";
}

function normalizeOrganizationId(value) {
  const normalized = String(value ?? "").trim();
  return UUID_PATTERN.test(normalized) ? normalized : "";
}

export function buildEmployeeCardUrl(employeeId) {
  if (typeof window === "undefined") {
    return "#";
  }
  const normalized = normalizeEmployeeId(employeeId);
  if (!normalized) {
    return "#";
  }
  const params = new URLSearchParams();
  params.set(URL_EMPLOYEE_ID_PARAM, normalized);
  return `${PATH_EMPLOYEES}?${params.toString()}`;
}

export function buildOrganizationCardUrl(organUnitId) {
  if (typeof window === "undefined") {
    return "#";
  }
  const normalized = normalizeOrganizationId(organUnitId);
  if (!normalized) {
    return "#";
  }
  const params = new URLSearchParams();
  params.set(URL_ORGANIZATION_ID_PARAM, normalized);
  return `${PATH_ORGANIZATIONS}?${params.toString()}`;
}
