/** Мост между строкой действий в App (под page-header) и ReferenceBooksListPage */

let handlers = {
  clearFilters: () => {},
  alignColumns: () => {},
  openAdd: () => {},
  openColumnSettings: () => {}
};

export function registerReferenceBooksHeaderHandlers(next) {
  handlers = {
    clearFilters: typeof next.clearFilters === "function" ? next.clearFilters : () => {},
    alignColumns: typeof next.alignColumns === "function" ? next.alignColumns : () => {},
    openAdd: typeof next.openAdd === "function" ? next.openAdd : () => {},
    openColumnSettings: typeof next.openColumnSettings === "function" ? next.openColumnSettings : () => {}
  };
}

export function invokeReferenceBooksClearFilters() {
  handlers.clearFilters();
}

export function invokeReferenceBooksAlignColumns() {
  handlers.alignColumns();
}

export function invokeReferenceBooksOpenAdd() {
  handlers.openAdd();
}

export function invokeReferenceBooksOpenColumnSettings() {
  handlers.openColumnSettings();
}
