/* eslint-disable react/jsx-props-no-spreading */
/** Универсальные линейные иконки 16×16 (currentColor) для кнопок с подписью */

function mergeClass(base, className) {
  return [base, className].filter(Boolean).join(" ").trim();
}

function SvgIcon({ className, children, ...rest }) {
  return (
    <svg
      className={mergeClass("btn-icon-16", className)}
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconListBulleted(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 4h.01M4 8h.01M4 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.5 4h7M6.5 8h7M6.5 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconPlus(props) {
  return (
    <SvgIcon {...props}>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconMinus(props) {
  return (
    <SvgIcon {...props}>
      <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconClose(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </SvgIcon>
  );
}

/** Воронка + перечёркивание — сброс фильтров таблицы */
export function IconClearFilter(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M2.5 4h11L9.25 9.45V12.3L6.75 13.7V9.45L2.5 4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M3.5 12.5l9-9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconAlignColumns(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M2.5 3.5h11M2.5 8h11M2.5 12.5h11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M5 2v3M8 6.5v3M11 11v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconSettings(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M8 1.75v2.15M8 12.1v2.15M1.75 8h2.15M12.1 8h2.15M3.4 3.4l1.52 1.52M11.08 11.08l1.52 1.52M3.4 12.6l1.52-1.52M11.08 4.92l1.52-1.52"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

export function IconUpload(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M8 10.5V3M5.5 5.5L8 3l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconDownload(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M8 2.5v7M5.5 8L8 10.5 10.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 13.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconTrash(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M3.5 4.5h9M6 4.5V3.5a1 1 0 011-1h2a1 1 0 011 1v1M12.5 4.5V13a1 1 0 01-1 1h-7a1 1 0 01-1-1V4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 7.5v5M9.5 7.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconPencil(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M10.5 2.5l3 3-7.5 7.5H3v-3L10.5 2.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

export function IconCheck(props) {
  return (
    <SvgIcon {...props}>
      <path d="M3.5 8L6.5 11 12.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function IconRefresh(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M13 8a5 5 0 11-1.5-3.5H10M13 4.5V7h-2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

export function IconUndo(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M4.5 7.5H11a3.5 3.5 0 010 7H8M4.5 7.5L2.5 5.5M4.5 7.5L2.5 9.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

export function IconSearch(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconCopy(props) {
  return (
    <SvgIcon {...props}>
      <rect x="5" y="5" width="7.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 10.5H3.5a1 1 0 01-1-1V3.5a1 1 0 011-1H9a1 1 0 011 1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconEye(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.2" />
    </SvgIcon>
  );
}

export function IconCode(props) {
  return (
    <SvgIcon {...props}>
      <path d="M5 5l-2.5 3L5 11M11 5l2.5 3L11 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function IconPlay(props) {
  return (
    <SvgIcon {...props}>
      <path d="M5.5 4l6 4-6 4V4z" fill="currentColor" stroke="none" />
    </SvgIcon>
  );
}

export function IconChevronLeft(props) {
  return (
    <SvgIcon {...props}>
      <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function IconChevronRight(props) {
  return (
    <SvgIcon {...props}>
      <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function IconChevronsLeft(props) {
  return (
    <SvgIcon {...props}>
      <path d="M9 3.5L5 8l4 4.5M13 3.5L9 8l4 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function IconChevronsRight(props) {
  return (
    <SvgIcon {...props}>
      <path d="M7 3.5L11 8l-4 4.5M3 3.5L7 8l-4 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

/** Два шеврона вниз — «развернуть все» в группах меню */
export function IconChevronsDown(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4 4.5l4 3.5 4-3.5M4 9.5l4 3.5 4-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function IconFileJson(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M4 2.5h5l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-10a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9 2.5v3h3M5.5 9h5M5.5 11h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconSliders(props) {
  return (
    <SvgIcon {...props}>
      <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10" cy="4" r="1.2" fill="currentColor" />
      <circle cx="6" cy="8" r="1.2" fill="currentColor" />
      <circle cx="11" cy="12" r="1.2" fill="currentColor" />
    </SvgIcon>
  );
}

export function IconArrowRight(props) {
  return (
    <SvgIcon {...props}>
      <path d="M3 8h8.5M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function IconBuilding(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M3 13.5V5.5l4-2v10M7 13.5V9.5h5v4M7 5.5h8v8h-3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

export function IconUser(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 13.5c.8-2.2 2.6-3.5 4.5-3.5s3.7 1.3 4.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconLink(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M6.5 9.5l-2 2a2.5 2.5 0 000 3.5l.5.5a2.5 2.5 0 003.5 0l2-2M9.5 6.5l2-2a2.5 2.5 0 000-3.5l-.5-.5a2.5 2.5 0 00-3.5 0l-2 2M5.5 10.5l5-5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

export function IconShield(props) {
  return (
    <SvgIcon {...props}>
      <path
        d="M8 2.5l5 2v4.5c0 3-2.5 5-5 6.5-2.5-1.5-5-3.5-5-6.5V4.5l5-2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

export function IconMail(props) {
  return (
    <SvgIcon {...props}>
      <rect x="2.5" y="4" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.5 5.5L8 9l5.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconZoomIn(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 10l3.5 3.5M7 5.2v3.6M5.2 7h3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function IconZoomOut(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 10l3.5 3.5M5.2 7h5.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </SvgIcon>
  );
}
