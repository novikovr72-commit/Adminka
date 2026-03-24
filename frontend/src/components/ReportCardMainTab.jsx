import { memo, useCallback, useEffect, useRef, useState } from "react";
import { REPORT_ACCESS_GROUP_ENUM } from "../reportCardConstants";
import {
  DEFAULT_REPORT_CARD_LINK_WIDTHS,
  MIN_REPORT_CARD_LINK_ACTIONS,
  MIN_REPORT_CARD_LINK_MAIN,
  REPORT_CARD_LINKS_TABLE_WIDTHS_KEY,
  loadReportCardLinksWidths
} from "../reportCardLinksTableStorage";
import ReportCardLinksDataTable from "./ReportCardLinksDataTable";
import {
  IconCheck,
  IconClose,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUndo
} from "./AppIcons";

function ReportCardMainTab({
  isActive,
  isReportMainSettingsEditable,
  isReportMainSettingsSaving,
  isReportDeleting,
  isCreatingReportCard,
  reportMainSettingsDraft,
  selectedReport,
  handleSaveReportMainSettings,
  handleCancelReportMainSettingsEdit,
  handleOpenReportMainSettingsEdit,
  handleOpenReportDeleteModal,
  handleChangeReportMainSettingsDraft,
  sanitizePositiveIntegerDraftValue,
  resolveExportFileNameTemplate,
  isReportOrganizationAddMode,
  addingReportOrganization,
  isReportOrganizationComboOpen,
  reportOrganizationComboRef,
  reportOrganizationSearch,
  reportOrganizationOptions,
  selectedReportOrganizationIdForAdd,
  selectedReportOrganizations,
  setIsReportOrganizationComboOpen,
  setReportOrganizationSearch,
  setSelectedReportOrganizationIdForAdd,
  setReportOrganizationOptions,
  fetchReportOrganizationOptions,
  formatOrganizationTooltip,
  handleCellMouseEnter,
  updateCellTooltipPosition,
  handleCellMouseLeave,
  handleOpenReportOrganizationAdd,
  handleAddReportOrganization,
  handleCancelReportOrganizationAdd,
  handleDeleteReportOrganization,
  deletingReportOrganizationId,
  deletingReportAccessGroupCode,
  deletingReportRecipientEmail,
  isReportRecipientAddMode,
  addingReportRecipient,
  newReportRecipientEmail,
  setNewReportRecipientEmail,
  selectedReportRecipients,
  handleOpenReportRecipientAdd,
  handleAddReportRecipient,
  handleCancelReportRecipientAdd,
  handleDeleteReportRecipient,
  isReportAccessGroupAddMode,
  addingReportAccessGroup,
  newReportAccessGroupCode,
  setNewReportAccessGroupCode,
  selectedReportAccessGroups,
  handleOpenReportAccessGroupAdd,
  handleAddReportAccessGroup,
  handleCancelReportAccessGroupAdd,
  handleDeleteReportAccessGroup
}) {
  const [linkColWidths, setLinkColWidths] = useState(loadReportCardLinksWidths);
  const linkResizeRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(REPORT_CARD_LINKS_TABLE_WIDTHS_KEY, JSON.stringify(linkColWidths));
    } catch {
      /* quota */
    }
  }, [linkColWidths]);

  const handleLinkResizeMainStart = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startWidth = Math.round(
        Number(linkColWidths.main) || DEFAULT_REPORT_CARD_LINK_WIDTHS.main
      );
      linkResizeRef.current = {
        field: "main",
        startX: event.clientX,
        startWidth
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent) => {
        if (!linkResizeRef.current || linkResizeRef.current.field !== "main") {
          return;
        }
        const delta = moveEvent.clientX - linkResizeRef.current.startX;
        const nextWidth = Math.max(
          MIN_REPORT_CARD_LINK_MAIN,
          linkResizeRef.current.startWidth + delta
        );
        setLinkColWidths((prev) => ({ ...prev, main: nextWidth }));
      };

      const handleMouseUp = () => {
        linkResizeRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [linkColWidths.main]
  );

  const handleLinkResizeActionsStart = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startWidth = Math.round(
        Number(linkColWidths.actions) || DEFAULT_REPORT_CARD_LINK_WIDTHS.actions
      );
      linkResizeRef.current = {
        field: "actions",
        startX: event.clientX,
        startWidth
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent) => {
        if (!linkResizeRef.current || linkResizeRef.current.field !== "actions") {
          return;
        }
        const delta = moveEvent.clientX - linkResizeRef.current.startX;
        const nextWidth = Math.max(
          MIN_REPORT_CARD_LINK_ACTIONS,
          linkResizeRef.current.startWidth + delta
        );
        setLinkColWidths((prev) => ({ ...prev, actions: nextWidth }));
      };

      const handleMouseUp = () => {
        linkResizeRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [linkColWidths.actions]
  );

  return (
<div
  className={`employee-card-main-tab-content report-card-main-tab-content${
    isReportMainSettingsEditable ? " employee-card-main-tab-content-edit-mode" : ""
  }${!isActive ? " is-hidden" : ""}`}
  role="tabpanel"
  hidden={!isActive}
>
    <section className="employee-card-section">
      <div className="employee-card-subordination-header">
        <h3>Основные настройки</h3>
        <div className="employee-card-relations-header-actions">
          {isReportMainSettingsEditable ? (
            <>
              <button
                type="button"
                className="panel-action-button"
                onClick={handleSaveReportMainSettings}
                disabled={isReportMainSettingsSaving || isReportDeleting}
              >
                <IconCheck aria-hidden />
                <span>Сохранить</span>
              </button>
              <button
                type="button"
                className="panel-action-button"
                onClick={handleCancelReportMainSettingsEdit}
                disabled={isReportMainSettingsSaving || isReportDeleting}
              >
                <IconClose aria-hidden />
                <span>Отменить</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="panel-action-button"
                onClick={handleOpenReportMainSettingsEdit}
                disabled={isReportDeleting}
              >
                <IconPencil aria-hidden />
                <span>Изменить</span>
              </button>
              <button
                type="button"
                className="panel-action-button"
                onClick={handleOpenReportDeleteModal}
                disabled={isReportDeleting}
              >
                <IconTrash aria-hidden />
                <span>Удалить</span>
              </button>
            </>
          )}
        </div>
      </div>
      <div className="employee-card-params">
        <div className="employee-card-params-row">
          <div className="employee-card-param">
            <span className="employee-card-field-label">Код отчета</span>
            {isReportMainSettingsEditable ? (
              <input
                type="text"
                className="employee-card-field-input"
                value={reportMainSettingsDraft.codeReport}
                onChange={(event) =>
                  handleChangeReportMainSettingsDraft("codeReport", event.target.value)
                }
              />
            ) : (
              <span className="employee-card-field-value employee-card-field-value-block">
                {String(selectedReport?.codeReport ?? selectedReport?.code_report ?? "").trim() ||
                  "-"}
              </span>
            )}
          </div>
          <div className="employee-card-param">
            <span className="employee-card-field-label">Версия отчета</span>
            {isReportMainSettingsEditable ? (
              <input
                type="text"
                className="employee-card-field-input"
                value={reportMainSettingsDraft.version}
                onChange={(event) =>
                  handleChangeReportMainSettingsDraft("version", event.target.value)
                }
              />
            ) : (
              <span className="employee-card-field-value employee-card-field-value-block">
                {String(selectedReport?.version ?? "").trim() || "-"}
              </span>
            )}
          </div>
          <div className="employee-card-param">
            <span className="employee-card-field-label">Наименование отчета</span>
            {isReportMainSettingsEditable ? (
              <input
                type="text"
                className="employee-card-field-input"
                value={reportMainSettingsDraft.name}
                onChange={(event) =>
                  handleChangeReportMainSettingsDraft("name", event.target.value)
                }
              />
            ) : (
              <span className="employee-card-field-value employee-card-field-value-block">
                {String(selectedReport?.name ?? "").trim() || "-"}
              </span>
            )}
          </div>
        </div>
        <div className="employee-card-params-row">
          <div className="employee-card-param">
            <span className="employee-card-field-label">Метод формирования</span>
            {isReportMainSettingsEditable ? (
              <select
                className="employee-card-field-input employee-card-field-select"
                value={reportMainSettingsDraft.method}
                onChange={(event) =>
                  handleChangeReportMainSettingsDraft("method", event.target.value)
                }
              >
                <option value="AUTO">AUTO</option>
                <option value="HAND">HAND</option>
              </select>
            ) : (
              <span className="employee-card-field-value employee-card-field-value-block">
                {String(selectedReport?.method ?? "").trim() || "-"}
              </span>
            )}
          </div>
          <div className="employee-card-param">
            <span className="employee-card-field-label">Количество дней</span>
            {isReportMainSettingsEditable ? (
              <input
                type="text"
                className="employee-card-field-input"
                value={reportMainSettingsDraft.numberDays}
                onChange={(event) =>
                  handleChangeReportMainSettingsDraft(
                    "numberDays",
                    sanitizePositiveIntegerDraftValue(event.target.value)
                  )
                }
              />
            ) : (
              <span className="employee-card-field-value employee-card-field-value-block">
                {String(
                  selectedReport?.numberDays ?? selectedReport?.number_days ?? ""
                ).trim() || "-"}
              </span>
            )}
          </div>
          <div className="employee-card-param">
            <span className="employee-card-field-label">Наименование выходного файла</span>
            {isReportMainSettingsEditable ? (
              <div className="report-output-file-template-help">
                <input
                  type="text"
                  className="employee-card-field-input"
                  value={reportMainSettingsDraft.outputFileName}
                  onChange={(event) =>
                    handleChangeReportMainSettingsDraft("outputFileName", event.target.value)
                  }
                />
                <div className="report-output-file-template-help-text">
                  Доступные шаблоны: <code>{`{reportName}`}</code>,{" "}
                  <code>{`{now:dd.MM.yyyy_HH-mm-ss}`}</code>
                </div>
                <div className="report-output-file-template-help-text">
                  Пример:{" "}
                  <code>
                    {(
                      resolveExportFileNameTemplate(
                        String(reportMainSettingsDraft.outputFileName ?? ""),
                        String(reportMainSettingsDraft.name ?? "").trim() || "Отчет"
                      ) || String(reportMainSettingsDraft.outputFileName ?? "").trim() || "report"
                    ) +
                      "." +
                      (String(reportMainSettingsDraft.outputFileType ?? "XLSX")
                        .trim()
                        .toLowerCase() || "xlsx")}
                  </code>
                </div>
              </div>
            ) : (
              <span className="employee-card-field-value employee-card-field-value-block">
                {String(
                  selectedReport?.outputFileName ?? selectedReport?.output_file_name ?? ""
                ).trim() || "-"}
              </span>
            )}
          </div>
        </div>
        <div className="employee-card-params-row employee-card-params-row-status">
          <div className="employee-card-param">
            <span className="employee-card-field-label">Статус</span>
            {isReportMainSettingsEditable ? (
              <select
                className="employee-card-field-input employee-card-field-select"
                value={reportMainSettingsDraft.status}
                onChange={(event) =>
                  handleChangeReportMainSettingsDraft("status", event.target.value)
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            ) : (
              <span className="employee-card-field-value employee-card-field-value-block">
                {String(selectedReport?.status ?? "").trim() || "-"}
              </span>
            )}
          </div>
          <div className="employee-card-param">
            <span className="employee-card-field-label">Тип выходного файла</span>
            {isReportMainSettingsEditable ? (
              <select
                className="employee-card-field-input employee-card-field-select"
                value={reportMainSettingsDraft.outputFileType}
                onChange={(event) =>
                  handleChangeReportMainSettingsDraft("outputFileType", event.target.value)
                }
              >
                <option value="XLSX">XLSX</option>
              </select>
            ) : (
              <span className="employee-card-field-value employee-card-field-value-block">
                {String(
                  selectedReport?.outputFileType ?? selectedReport?.output_file_type ?? ""
                ).trim() || "-"}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
    <section
      className={`employee-card-section report-card-links-section${
        isCreatingReportCard ? " report-card-section-disabled" : ""
      }`}
    >
      {isCreatingReportCard && (
        <p className="report-card-links-disabled-note">
          Сохраните отчет, чтобы управлять связями с организациями, получателями и группами доступа.
        </p>
      )}
      <div className="report-card-links-grid">
        <div className="report-card-links-card report-card-links-card-organizations">
          <div className="employee-card-subordination-header">
            <h3>Организации</h3>
            <button
              type="button"
              className="panel-action-button employee-card-add-position-button"
              onClick={handleOpenReportOrganizationAdd}
              disabled={
                isCreatingReportCard ||
                isReportOrganizationAddMode ||
                addingReportOrganization ||
                Boolean(deletingReportOrganizationId) ||
                Boolean(deletingReportAccessGroupCode) ||
                Boolean(deletingReportRecipientEmail)
              }
            >
              <IconPlus aria-hidden />
              <span>Добавить</span>
            </button>
          </div>
          {isReportOrganizationAddMode && (
            <div className="report-card-links-actions report-card-links-actions-report-organizations">
              <div
                className={`relation-combobox report-organization-combobox${
                  isReportOrganizationComboOpen ? " open" : ""
                }`}
                ref={reportOrganizationComboRef}
              >
                <input
                  type="text"
                  className="relation-combobox-trigger employee-card-relations-filter-input"
                  value={
                    isReportOrganizationComboOpen
                      ? reportOrganizationSearch
                      : (
                          reportOrganizationOptions.find(
                            (item) =>
                              item.organUnitId ===
                              String(selectedReportOrganizationIdForAdd ?? "").trim()
                          )?.organUnitName ?? reportOrganizationSearch
                        )
                  }
                  placeholder="Выберите сбытовую организацию"
                  onFocus={() => {
                    setIsReportOrganizationComboOpen(true);
                    if (!reportOrganizationOptions.length) {
                      void fetchReportOrganizationOptions(reportOrganizationSearch);
                    }
                  }}
                  onChange={(event) => {
                    const value = event.target.value;
                    setReportOrganizationSearch(value);
                    setSelectedReportOrganizationIdForAdd("");
                    setIsReportOrganizationComboOpen(true);
                    void fetchReportOrganizationOptions(value);
                  }}
                />
                {String(reportOrganizationSearch ?? "").trim() && (
                  <button
                    type="button"
                    className="relation-combobox-clear-button"
                    aria-label="Очистить поле"
                    onClick={() => {
                      setReportOrganizationSearch("");
                      setSelectedReportOrganizationIdForAdd("");
                      setReportOrganizationOptions([]);
                      setIsReportOrganizationComboOpen(false);
                    }}
                  >
                    ×
                  </button>
                )}
                {isReportOrganizationComboOpen && (
                  <div className="relation-combobox-menu report-organization-combobox-menu">
                    <div className="relation-combobox-options">
                      {reportOrganizationOptions.length === 0 ? (
                        <div className="relation-combobox-empty">Нет данных</div>
                      ) : (
                        reportOrganizationOptions.map((item) => (
                          <button
                            key={item.organUnitId}
                            type="button"
                            className="relation-combobox-option"
                            onMouseEnter={(event) => {
                              const tooltipText = formatOrganizationTooltip({
                                organName: item.fieldName,
                                sapId: item.sapId,
                                inn: item.inn,
                                kpp: item.kpp,
                                ogrn: item.ogrn,
                                fullAddress: item.fullAddress
                              });
                              handleCellMouseEnter(event, tooltipText, tooltipText, true);
                            }}
                            onMouseMove={updateCellTooltipPosition}
                            onMouseLeave={handleCellMouseLeave}
                            onClick={() => {
                              setSelectedReportOrganizationIdForAdd(item.organUnitId);
                              setReportOrganizationSearch(item.organUnitName);
                              setIsReportOrganizationComboOpen(false);
                            }}
                          >
                            {item.organUnitName}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="employee-card-position-action-button"
                onClick={() => void handleAddReportOrganization()}
                disabled={
                  isCreatingReportCard ||
                  addingReportOrganization ||
                  !selectedReportOrganizationIdForAdd ||
                  Boolean(deletingReportOrganizationId) ||
                  Boolean(deletingReportAccessGroupCode) ||
                  Boolean(deletingReportRecipientEmail)
                }
                aria-label="Сохранить связь с организацией"
                data-tooltip="Сохранить"
              >
                <IconCheck aria-hidden />
              </button>
              <button
                type="button"
                className="employee-card-position-action-button"
                onClick={handleCancelReportOrganizationAdd}
                disabled={addingReportOrganization}
                aria-label="Отменить добавление связи с организацией"
                data-tooltip="Отменить"
              >
                <IconUndo aria-hidden />
              </button>
            </div>
          )}
          <ReportCardLinksDataTable
            firstHeaderLabel="Организация"
            colWidths={linkColWidths}
            onResizeMainStart={handleLinkResizeMainStart}
            onResizeActionsStart={handleLinkResizeActionsStart}
          >
            {selectedReportOrganizations.length > 0 ? (
              selectedReportOrganizations.map((item) => {
                const rowKey = item.organUnitId || item.organUnitName;
                const isDeleting =
                  deletingReportOrganizationId === item.organUnitId && Boolean(item.organUnitId);
                return (
                  <tr key={`report-organization-${rowKey}`}>
                    <td>{item.organUnitName || item.organUnitId || "-"}</td>
                    <td className="employee-card-positions-actions-cell">
                      <button
                        type="button"
                        className="employee-card-position-action-button"
                        onClick={() => void handleDeleteReportOrganization(item.organUnitId)}
                        disabled={
                          isCreatingReportCard ||
                          !item.organUnitId ||
                          isDeleting ||
                          Boolean(deletingReportAccessGroupCode) ||
                          Boolean(deletingReportRecipientEmail)
                        }
                        aria-label="Удалить связь с организацией"
                        data-tooltip="Удалить"
                      >
                        {isDeleting ? "..." : "✕"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={2} className="report-card-links-empty-cell">
                  Нет связанных организаций
                </td>
              </tr>
            )}
          </ReportCardLinksDataTable>
        </div>
        <div className="report-card-links-card report-card-links-card-recipients">
          <div className="employee-card-subordination-header">
            <h3>Email получателей</h3>
            <button
              type="button"
              className="panel-action-button employee-card-add-position-button"
              onClick={handleOpenReportRecipientAdd}
              disabled={
                isCreatingReportCard ||
                isReportRecipientAddMode ||
                addingReportRecipient ||
                Boolean(deletingReportOrganizationId) ||
                Boolean(deletingReportAccessGroupCode) ||
                Boolean(deletingReportRecipientEmail)
              }
            >
              <IconPlus aria-hidden />
              <span>Добавить</span>
            </button>
          </div>
          {isReportRecipientAddMode && (
            <div className="report-card-links-actions report-card-links-actions-report-recipients">
              <input
                type="text"
                className="employee-card-field-input"
                value={newReportRecipientEmail}
                onChange={(event) => setNewReportRecipientEmail(event.target.value)}
                placeholder="Введите email"
                disabled={addingReportRecipient || Boolean(deletingReportRecipientEmail)}
              />
              <button
                type="button"
                className="employee-card-position-action-button"
                onClick={() => void handleAddReportRecipient()}
                disabled={
                  isCreatingReportCard ||
                  addingReportRecipient ||
                  !String(newReportRecipientEmail ?? "").trim() ||
                  Boolean(deletingReportOrganizationId) ||
                  Boolean(deletingReportAccessGroupCode) ||
                  Boolean(deletingReportRecipientEmail)
                }
                aria-label="Сохранить получателя отчета"
                data-tooltip="Сохранить"
              >
                <IconCheck aria-hidden />
              </button>
              <button
                type="button"
                className="employee-card-position-action-button"
                onClick={handleCancelReportRecipientAdd}
                disabled={addingReportRecipient}
                aria-label="Отменить добавление получателя отчета"
                data-tooltip="Отменить"
              >
                <IconUndo aria-hidden />
              </button>
            </div>
          )}
          <ReportCardLinksDataTable
            firstHeaderLabel="Email"
            colWidths={linkColWidths}
            onResizeMainStart={handleLinkResizeMainStart}
            onResizeActionsStart={handleLinkResizeActionsStart}
          >
            {selectedReportRecipients.length > 0 ? (
              selectedReportRecipients.map((item) => {
                const isDeleting = deletingReportRecipientEmail === item.email;
                return (
                  <tr key={`report-recipient-${item.email}`}>
                    <td>{item.email}</td>
                    <td className="employee-card-positions-actions-cell">
                      <button
                        type="button"
                        className="employee-card-position-action-button"
                        onClick={() => void handleDeleteReportRecipient(item.email)}
                        disabled={
                          isCreatingReportCard ||
                          !item.email ||
                          isDeleting ||
                          Boolean(deletingReportOrganizationId) ||
                          Boolean(deletingReportAccessGroupCode)
                        }
                        aria-label="Удалить получателя отчета"
                        data-tooltip="Удалить"
                      >
                        {isDeleting ? "..." : "✕"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={2} className="report-card-links-empty-cell">
                  Нет получателей отчета
                </td>
              </tr>
            )}
          </ReportCardLinksDataTable>
        </div>
        <div className="report-card-links-card report-card-links-card-access-groups">
          <div className="employee-card-subordination-header">
            <h3>Группы доступа</h3>
            <button
              type="button"
              className="panel-action-button employee-card-add-position-button"
              onClick={handleOpenReportAccessGroupAdd}
              disabled={
                isCreatingReportCard ||
                isReportAccessGroupAddMode ||
                addingReportAccessGroup ||
                Boolean(deletingReportOrganizationId) ||
                Boolean(deletingReportAccessGroupCode) ||
                Boolean(deletingReportRecipientEmail)
              }
            >
              <IconPlus aria-hidden />
              <span>Добавить</span>
            </button>
          </div>
          {isReportAccessGroupAddMode && (
            <div className="report-card-links-actions report-card-links-actions-report-access-groups">
              <select
                className="employee-card-field-input employee-card-field-select"
                value={newReportAccessGroupCode}
                onChange={(event) =>
                  setNewReportAccessGroupCode(String(event.target.value ?? ""))
                }
                disabled={addingReportAccessGroup || Boolean(deletingReportAccessGroupCode)}
              >
                {REPORT_ACCESS_GROUP_ENUM.map((codeAccess) => (
                  <option key={codeAccess} value={codeAccess}>
                    {codeAccess}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="employee-card-position-action-button"
                onClick={() => void handleAddReportAccessGroup()}
                disabled={
                  isCreatingReportCard ||
                  addingReportAccessGroup ||
                  !String(newReportAccessGroupCode ?? "").trim() ||
                  Boolean(deletingReportOrganizationId) ||
                  Boolean(deletingReportAccessGroupCode) ||
                  Boolean(deletingReportRecipientEmail)
                }
                aria-label="Сохранить группу доступа"
                data-tooltip="Сохранить"
              >
                <IconCheck aria-hidden />
              </button>
              <button
                type="button"
                className="employee-card-position-action-button"
                onClick={handleCancelReportAccessGroupAdd}
                disabled={addingReportAccessGroup}
                aria-label="Отменить добавление группы доступа"
                data-tooltip="Отменить"
              >
                <IconUndo aria-hidden />
              </button>
            </div>
          )}
          <ReportCardLinksDataTable
            firstHeaderLabel="Группа доступа"
            colWidths={linkColWidths}
            onResizeMainStart={handleLinkResizeMainStart}
            onResizeActionsStart={handleLinkResizeActionsStart}
          >
            {selectedReportAccessGroups.length > 0 ? (
              selectedReportAccessGroups.map((item) => {
                const isDeleting = deletingReportAccessGroupCode === item.codeAccess;
                return (
                  <tr key={`report-access-group-${item.codeAccess}`}>
                    <td>{item.codeAccess}</td>
                    <td className="employee-card-positions-actions-cell">
                      <button
                        type="button"
                        className="employee-card-position-action-button"
                        onClick={() => void handleDeleteReportAccessGroup(item.codeAccess)}
                        disabled={
                          isCreatingReportCard ||
                          !item.codeAccess ||
                          isDeleting ||
                          Boolean(deletingReportOrganizationId) ||
                          Boolean(deletingReportRecipientEmail)
                        }
                        aria-label="Удалить группу доступа"
                        data-tooltip="Удалить"
                      >
                        {isDeleting ? "..." : "✕"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={2} className="report-card-links-empty-cell">
                  Нет групп доступа
                </td>
              </tr>
            )}
          </ReportCardLinksDataTable>
        </div>
      </div>
    </section>
  </div>

  );
}

export default memo(ReportCardMainTab);
