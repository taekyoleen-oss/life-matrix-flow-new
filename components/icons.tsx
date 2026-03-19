// Icon components using Heroicons-style SVG
import React from 'react';

interface IconProps {
  className?: string;
  width?: number;
  height?: number;
}

const defaultProps: IconProps = {
  className: '',
  width: 24,
  height: 24,
};

// Logo Icon
export const LogoIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

// Play Icon
export const PlayIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

// Code Bracket Icon
export const CodeBracketIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M14 8l4 4-4 4" />
  </svg>
);

// Folder Open Icon
export const FolderOpenIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h12a2 2 0 0 1 2 2v1M5 19h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2z" />
  </svg>
);

// Plus Icon
export const PlusIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// Minus Icon
export const MinusIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14" />
  </svg>
);

// Arrow Uturn Left Icon (Undo) — Heroicons outline
export const ArrowUturnLeftIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
  </svg>
);

// Arrow Uturn Right Icon (Redo) — Heroicons outline
export const ArrowUturnRightIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
  </svg>
);

// Arrows Pointing Out Icon (Fit to View) — Heroicons outline 24x24
export const ArrowsPointingOutIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
  </svg>
);

// Arrows Pointing In Icon — Heroicons outline 24x24
export const ArrowsPointingInIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
  </svg>
);

// Sparkles Icon
export const SparklesIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423z" />
  </svg>
);

// Check Icon
export const CheckIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

// Command Line Icon
export const CommandLineIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 10l6 6 10-10" />
  </svg>
);

// Bars 3 Icon
export const Bars3Icon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);

// Clipboard Document List Icon
export const ClipboardDocumentListIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 2v4M15 2v4M9 22h6M9 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2M9 2h6M9 10h6M9 14h6M9 18h4" />
  </svg>
);

// Beaker Icon
export const BeakerIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9.5 3v5.5a2.5 2.5 0 0 1-5 0V3M9.5 3h5M9.5 3H7m2.5 0h5M4.5 8.5h15M6 21h12a2 2 0 0 0 2-2v-8.5H4v8.5a2 2 0 0 0 2 2z" />
  </svg>
);

// Chevron Up Icon
export const ChevronUpIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m18 15-6-6-6 6" />
  </svg>
);

// Chevron Down Icon
export const ChevronDownIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// Queue List Icon
export const QueueListIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

// Font Size Increase Icon (using ArrowsPointingOutIcon)
export const FontSizeIncreaseIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <ArrowsPointingOutIcon className={className} width={width} height={height} />
);

// Font Size Decrease Icon (using ArrowsPointingInIcon)
export const FontSizeDecreaseIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <ArrowsPointingInIcon className={className} width={width} height={height} />
);

// X Mark Icon
export const XMarkIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

// X Circle Icon
export const XCircleIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  </svg>
);

// Database Icon
export const DatabaseIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
  </svg>
);

// Table Cells Icon
export const TableCellsIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);

// Document Text Icon
export const DocumentTextIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);

// Calculator Icon
export const CalculatorIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M8 6h8M8 10h8M8 14h4M8 18h4" />
  </svg>
);

// Price Tag Icon
export const PriceTagIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.586 8.586a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828L12.586 2.586zM7 7h.01" />
  </svg>
);

// Check Badge Icon
export const CheckBadgeIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

// Adjustments Horizontal Icon
export const AdjustmentsHorizontalIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12h18M3 6h18M3 18h18M6 3v6M6 15v6M18 3v6M18 15v6" />
  </svg>
);

// Tag Icon
export const TagIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.586 8.586a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828L12.586 2.586zM7 7h.01" />
  </svg>
);

// Banknotes Icon
export const BanknotesIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h12M6 14h8" />
  </svg>
);

// Text Box Icon
export const TextBoxIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h4" />
  </svg>
);

// Group Box Icon
export const GroupBoxIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 3v18" />
  </svg>
);

// Arrow Down Tray Icon (Download Icon)
// Bookmark Icon (for save)
export const BookmarkIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </svg>
);

export const ArrowDownTrayIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

// Sun Icon
export const SunIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

// Moon Icon
export const MoonIcon: React.FC<IconProps> = ({ className = '', width = 24, height = 24 }) => (
  <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
