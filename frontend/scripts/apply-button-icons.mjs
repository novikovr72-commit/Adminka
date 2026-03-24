import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "..", "src", "App.jsx");

let s = fs.readFileSync(appPath, "utf8");

const importBlock = `import TableColumnSettingsPanel from "./components/TableColumnSettingsPanel";
import {
  IconAlignColumns,
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconCode,
  IconDownload,
  IconEye,
  IconFileJson,
  IconLink,
  IconListBulleted,
  IconMinus,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSliders,
  IconTrash,
  IconUndo,
  IconUpload,
  IconUser
} from "./components/AppIcons";`;

if (!s.includes('from "./components/AppIcons"')) {
  s = s.replace(
    `import TableColumnSettingsPanel from "./components/TableColumnSettingsPanel";`,
    importBlock
  );
}

const spanPairs = [
  ["<span aria-hidden=\"true\">+</span>", "<IconPlus aria-hidden />"],
  ["<span aria-hidden=\"true\">✕</span>", "<IconClose aria-hidden />"],
  ["<span aria-hidden=\"true\">↔</span>", "<IconAlignColumns aria-hidden />"],
  ["<span aria-hidden=\"true\">⚙</span>", "<IconSettings aria-hidden />"],
  ["<span aria-hidden=\"true\">↑</span>", "<IconUpload aria-hidden />"],
  ["<span aria-hidden=\"true\">↻</span>", "<IconRefresh aria-hidden />"],
  ["<span aria-hidden=\"true\">⧉</span>", "<IconSearch aria-hidden />"]
];
for (const [a, b] of spanPairs) {
  s = s.split(a).join(b);
}

const simplePairs = [
  ["✎ Изменить", "<IconPencil aria-hidden />\n                                      <span>Изменить</span>"],
  ["🗑 Удалить", "<IconTrash aria-hidden />\n                                      <span>Удалить</span>"],
  ["✕ Очистить логотип", "<IconClose aria-hidden />\n                                        <span>Очистить логотип</span>"],
  [
    "\n                                      ✓\n                                    </button>",
    "\n                                      <IconCheck aria-hidden />\n                                    </button>"
  ],
  [
    `          >
            ✔
          </button>`,
    `          >
            <IconCheck aria-hidden />
          </button>`
  ],
  [
    `          >
            ↩
          </button>`,
    `          >
            <IconUndo aria-hidden />
          </button>`
  ],
  [
    `        >
          ✔
        </button>`,
    `        >
          <IconCheck aria-hidden />
        </button>`
  ],
  [
    `        >
          ↩
        </button>`,
    `        >
          <IconUndo aria-hidden />
        </button>`
  ],
  [
    "\n                            ✎\n                          </button>",
    "\n                            <IconPencil aria-hidden />\n                          </button>"
  ],
  [
    "\n                            🗑\n                          </button>",
    "\n                            <IconTrash aria-hidden />\n                          </button>"
  ],
  [
    "\n                                            ✎\n                                          </button>",
    "\n                                            <IconPencil aria-hidden />\n                                          </button>"
  ],
  [
    "\n                                            🗑\n                                          </button>",
    "\n                                            <IconTrash aria-hidden />\n                                          </button>"
  ]
];
for (const [a, b] of simplePairs) {
  s = s.split(a).join(b);
}

/** @type {Array<[string, string]>} */
const chunks = [
  [
    `onClick={saveEmployeeCardMainInfo}
                                    >
                                      Сохранить
                                    </button>`,
    `onClick={saveEmployeeCardMainInfo}
                                    >
                                      <IconCheck aria-hidden />
                                      <span>Сохранить</span>
                                    </button>`
  ],
  [
    `onClick={cancelEmployeeCardEditMode}
                                    >
                                      Отменить
                                    </button>`,
    `onClick={cancelEmployeeCardEditMode}
                                    >
                                      <IconClose aria-hidden />
                                      <span>Отменить</span>
                                    </button>`
  ],
  [
    `onClick={startEmployeeCardEditMode}
                                    >
                                      Изменить
                                    </button>`,
    `onClick={startEmployeeCardEditMode}
                                    >
                                      <IconPencil aria-hidden />
                                      <span>Изменить</span>
                                    </button>`
  ],
  [
    `onClick={openDeleteEmployeeModal}
                                      >
                                        Удалить
                                      </button>`,
    `onClick={openDeleteEmployeeModal}
                                      >
                                        <IconTrash aria-hidden />
                                        <span>Удалить</span>
                                      </button>`
  ],
  [
    `onClick={saveOrganizationCardMainInfo}
                                  >
                                    Сохранить
                                  </button>`,
    `onClick={saveOrganizationCardMainInfo}
                                  >
                                    <IconCheck aria-hidden />
                                    <span>Сохранить</span>
                                  </button>`
  ],
  [
    `onClick={cancelOrganizationCardEditMode}
                                  >
                                    Отменить
                                  </button>`,
    `onClick={cancelOrganizationCardEditMode}
                                  >
                                    <IconClose aria-hidden />
                                    <span>Отменить</span>
                                  </button>`
  ],
  [
    `onClick={startOrganizationCardEditMode}
                                  >
                                    Изменить
                                  </button>`,
    `onClick={startOrganizationCardEditMode}
                                  >
                                    <IconPencil aria-hidden />
                                    <span>Изменить</span>
                                  </button>`
  ],
  [
    `onClick={openDeleteOrganizationModal}
                                  >
                                    Удалить
                                  </button>`,
    `onClick={openDeleteOrganizationModal}
                                  >
                                    <IconTrash aria-hidden />
                                    <span>Удалить</span>
                                  </button>`
  ],
  [
    `disabled={isReportMainSettingsSaving || isReportDeleting}
                                    >
                                      Сохранить
                                    </button>`,
    `disabled={isReportMainSettingsSaving || isReportDeleting}
                                    >
                                      <IconCheck aria-hidden />
                                      <span>Сохранить</span>
                                    </button>`
  ],
  [
    `disabled={isReportMainSettingsSaving || isReportDeleting}
                                    >
                                      Отменить
                                    </button>`,
    `disabled={isReportMainSettingsSaving || isReportDeleting}
                                    >
                                      <IconClose aria-hidden />
                                      <span>Отменить</span>
                                    </button>`
  ],
  [
    `onClick={handleEditOrSaveReportSql}
                                        disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                      >
                                        Сохранить
                                      </button>`,
    `onClick={handleEditOrSaveReportSql}
                                        disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                      >
                                        <IconCheck aria-hidden />
                                        <span>Сохранить</span>
                                      </button>`
  ],
  [
    `onClick={handleCancelReportSqlEdit}
                                        disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                      >
                                        Отменить
                                      </button>`,
    `onClick={handleCancelReportSqlEdit}
                                        disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                      >
                                        <IconClose aria-hidden />
                                        <span>Отменить</span>
                                      </button>`
  ],
  [
    `onClick={handleEditOrSaveReportSql}
                                      disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                    >
                                      Изменить скрипт
                                    </button>`,
    `onClick={handleEditOrSaveReportSql}
                                      disabled={isReportSqlResultsLoading || isReportSqlResultsLoadingMore}
                                    >
                                      <IconPencil aria-hidden />
                                      <span>Изменить скрипт</span>
                                    </button>`
  ],
  [
    `onClick={handleRefreshReportTemplateFieldsFromSql}
                                          disabled={isReportTemplateSettingsSaving || isReportSqlEditMode}
                                        >
                                          Обновить
                                        </button>`,
    `onClick={handleRefreshReportTemplateFieldsFromSql}
                                          disabled={isReportTemplateSettingsSaving || isReportSqlEditMode}
                                        >
                                          <IconRefresh aria-hidden />
                                          <span>Обновить</span>
                                        </button>`
  ],
  [
    `onClick={handleSaveReportTemplateSettings}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          {isReportTemplateSettingsSaving ? "Сохранение..." : "Сохранить"}
                                        </button>`,
    `onClick={handleSaveReportTemplateSettings}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          <IconCheck aria-hidden />
                                          <span>
                                            {isReportTemplateSettingsSaving ? "Сохранение..." : "Сохранить"}
                                          </span>
                                        </button>`
  ],
  [
    `onClick={handleCancelReportTemplateEdit}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          Отменить
                                        </button>`,
    `onClick={handleCancelReportTemplateEdit}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          <IconClose aria-hidden />
                                          <span>Отменить</span>
                                        </button>`
  ],
  [
    `onClick={handleOpenReportTemplateJsonView}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          Параметры json
                                        </button>`,
    `onClick={handleOpenReportTemplateJsonView}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          <IconFileJson aria-hidden />
                                          <span>Параметры json</span>
                                        </button>`
  ],
  [
    `onClick={handleStartReportTemplateEdit}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          Изменить
                                        </button>`,
    `onClick={handleStartReportTemplateEdit}
                                          disabled={isReportTemplateSettingsSaving}
                                        >
                                          <IconPencil aria-hidden />
                                          <span>Изменить</span>
                                        </button>`
  ],
  [
    `onClick={handleSaveReportTemplateJson}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        {isReportTemplateSettingsSaving ? "Сохранение..." : "Сохранить"}
                                      </button>`,
    `onClick={handleSaveReportTemplateJson}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        <IconCheck aria-hidden />
                                        <span>
                                          {isReportTemplateSettingsSaving ? "Сохранение..." : "Сохранить"}
                                        </span>
                                      </button>`
  ],
  [
    `onClick={handleCancelReportTemplateJsonEdit}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Отменить
                                      </button>`,
    `onClick={handleCancelReportTemplateJsonEdit}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        <IconClose aria-hidden />
                                        <span>Отменить</span>
                                      </button>`
  ],
  [
    `onClick={handleOpenReportTemplateSettingsView}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Настройка параметров
                                      </button>`,
    `onClick={handleOpenReportTemplateSettingsView}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        <IconSliders aria-hidden />
                                        <span>Настройка параметров</span>
                                      </button>`
  ],
  [
    `onClick={handleDownloadReportTemplateJson}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Выгрузить json
                                      </button>`,
    `onClick={handleDownloadReportTemplateJson}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        <IconDownload aria-hidden />
                                        <span>Выгрузить json</span>
                                      </button>`
  ],
  [
    `onClick={handleUploadReportTemplateJsonClick}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Загрузить json
                                      </button>`,
    `onClick={handleUploadReportTemplateJsonClick}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        <IconUpload aria-hidden />
                                        <span>Загрузить json</span>
                                      </button>`
  ],
  [
    `onClick={handleToggleReportTemplateJsonEdit}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        Изменить
                                      </button>`,
    `onClick={handleToggleReportTemplateJsonEdit}
                                        disabled={isReportTemplateSettingsSaving}
                                      >
                                        <IconPencil aria-hidden />
                                        <span>Изменить</span>
                                      </button>`
  ],
  [
    `onClick={handleOpenReportSqlEditorView}
                                      disabled={reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR}
                                    >
                                      Редактор
                                    </button>`,
    `onClick={handleOpenReportSqlEditorView}
                                      disabled={reportSqlViewMode === REPORT_SQL_VIEW_MODES.EDITOR}
                                    >
                                      <IconCode aria-hidden />
                                      <span>Редактор</span>
                                    </button>`
  ],
  [
    `onClick={handleOpenReportSqlResultsView}
                                      disabled={reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS}
                                    >
                                      Результаты запроса
                                    </button>`,
    `onClick={handleOpenReportSqlResultsView}
                                      disabled={reportSqlViewMode === REPORT_SQL_VIEW_MODES.RESULTS}
                                    >
                                      <IconEye aria-hidden />
                                      <span>Результаты запроса</span>
                                    </button>`
  ],
  [
    `onClick={() => setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.MAIN)}
                        >
                          Основные сведения
                        </button>`,
    `onClick={() => setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.MAIN)}
                        >
                          <IconUser aria-hidden />
                          <span>Основные сведения</span>
                        </button>`
  ],
  [
    `setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.RELATIONS);
                          }}
                          disabled={isEmployeeCardEditMode}
                        >
                          Связи сотрудника
                        </button>`,
    `setActiveEmployeeCardTab(EMPLOYEE_CARD_TABS.RELATIONS);
                          }}
                          disabled={isEmployeeCardEditMode}
                        >
                          <IconLink aria-hidden />
                          <span>Связи сотрудника</span>
                        </button>`
  ],
  [
    `onClick={() => setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN)}
                        >
                          Основная информация
                        </button>`,
    `onClick={() => setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.MAIN)}
                        >
                          <IconBuilding aria-hidden />
                          <span>Основная информация</span>
                        </button>`
  ],
  [
    `setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.DADATA);
                            }}
                            disabled={isOrganizationCardEditMode}
                          >
                            ДаДата
                          </button>`,
    `setActiveOrganizationCardTab(ORGANIZATION_CARD_TABS.DADATA);
                            }}
                            disabled={isOrganizationCardEditMode}
                          >
                            <IconSearch aria-hidden />
                            <span>ДаДата</span>
                          </button>`
  ],
  [
    `onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.MAIN)}
                        >
                          Основные настройки
                        </button>`,
    `onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.MAIN)}
                        >
                          <IconSliders aria-hidden />
                          <span>Основные настройки</span>
                        </button>`
  ],
  [
    `onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.SQL)}
                          disabled={isCreatingReportCard}
                        >
                          SQL-скрипт
                        </button>`,
    `onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.SQL)}
                          disabled={isCreatingReportCard}
                        >
                          <IconCode aria-hidden />
                          <span>SQL-скрипт</span>
                        </button>`
  ],
  [
    `onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.TEMPLATE)}
                          disabled={isCreatingReportCard}
                        >
                          Настройка шаблона
                        </button>`,
    `onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.TEMPLATE)}
                          disabled={isCreatingReportCard}
                        >
                          <IconSettings aria-hidden />
                          <span>Настройка шаблона</span>
                        </button>`
  ],
  [
    `onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.PREVIEW)}
                          disabled={isCreatingReportCard || !isReportPreviewTabAvailable}
                        >
                          Просмотр отчета
                        </button>`,
    `onClick={() => setActiveReportCardTab(REPORT_CARD_TABS.PREVIEW)}
                          disabled={isCreatingReportCard || !isReportPreviewTabAvailable}
                        >
                          <IconEye aria-hidden />
                          <span>Просмотр отчета</span>
                        </button>`
  ],
  [
    `onClick={() => setActivePrintFormsTab(PRINT_FORMS_TABS.LIST)}
                >
                  Список шаблонов
                </button>`,
    `onClick={() => setActivePrintFormsTab(PRINT_FORMS_TABS.LIST)}
                >
                  <IconListBulleted aria-hidden />
                  <span>Список шаблонов</span>
                </button>`
  ],
  [
    `onClick={() => setActivePrintFormsTab(PRINT_FORMS_TABS.CREATE)}
                >
                  Создание шаблона
                </button>`,
    `onClick={() => setActivePrintFormsTab(PRINT_FORMS_TABS.CREATE)}
                >
                  <IconPlus aria-hidden />
                  <span>Создание шаблона</span>
                </button>`
  ]
];

for (const [from, to] of chunks) {
  if (!s.includes(from)) {
    console.warn("Missing chunk:", from.slice(0, 72).replace(/\n/g, "\\n"));
  } else {
    s = s.split(from).join(to);
  }
}

const zoomOut = `                                >
                                  −
                                </button>`;
const zoomIn = `                                >
                                  +
                                </button>`;
const zc = s.split(zoomOut).length - 1;
if (zc === 4) {
  s = s.split(zoomOut).join(`                                >
                                  <IconMinus aria-hidden />
                                </button>`);
} else {
  console.warn("Zoom − blocks:", zc);
}
const zi = s.split(zoomIn).length - 1;
if (zi === 4) {
  s = s.split(zoomIn).join(`                                >
                                  <IconPlus aria-hidden />
                                </button>`);
} else {
  console.warn("Zoom + blocks:", zi);
}

const pgPrev = `                  >
                    ←
                  </button>`;
const pgNext = `                  >
                    →
                  </button>`;
if (s.includes(pgPrev)) {
  s = s.split(pgPrev).join(`                  >
                    <IconChevronLeft aria-hidden />
                  </button>`);
}
if (s.includes(pgNext)) {
  s = s.split(pgNext).join(`                  >
                    <IconChevronRight aria-hidden />
                  </button>`);
}

const pageJump = `                  >
                    Перейти
                  </button>`;
if (s.includes(pageJump)) {
  s = s.split(pageJump).join(`                  >
                    <IconArrowRight aria-hidden />
                    <span>Перейти</span>
                  </button>`);
}

const modalYes = `                >
                  Да
                </button>`;
const modalNo = `                >
                  Нет
                </button>`;
const yesCount = s.split(modalYes).length - 1;
if (yesCount >= 1) {
  s = s.split(modalYes).join(`                >
                  <IconCheck aria-hidden />
                  <span>Да</span>
                </button>`);
}
if (s.split(modalNo).length - 1 >= 1) {
  s = s.split(modalNo).join(`                >
                  <IconClose aria-hidden />
                  <span>Нет</span>
                </button>`);
}

const modalClose = `              >
                Закрыть
              </button>`;
if (s.includes(modalClose)) {
  s = s.split(modalClose).join(`              >
                <IconClose aria-hidden />
                <span>Закрыть</span>
              </button>`);
}

fs.writeFileSync(appPath, s);
console.log("Done", appPath);
