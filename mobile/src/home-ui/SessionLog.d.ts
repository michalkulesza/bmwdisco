interface Props {
  logs: readonly string[];
  onExport: () => void;
}

declare const SessionLog: import('react').NamedExoticComponent<Props>;
export default SessionLog;
