/**
 * Logging like ZotSeek: `[SemanticZotero:<module>] [INFO] message`, to the Browser
 * Console (Tools → Developer) and to Zotero's debug output (Help → Debug Output
 * Logging). Filter by "[SemanticZotero" to see every module.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * The Browser Console. A plugin sandbox's `console` (and the main window's, called from the sandbox)
 * does not reach it – checked in E2E – so lines go to the console service directly.
 */
function toConsole(level: LogLevel, line: string): void {
  try {
    const svc = (globalThis as any).Services?.console ?? (Zotero as any).getMainWindow?.()?.Services?.console;
    if (level === 'warn' || level === 'error') {
      const Ci = (globalThis as any).Ci ?? (globalThis as any).Components?.interfaces;
      const Cc = (globalThis as any).Cc ?? (globalThis as any).Components?.classes;
      const err = Cc?.['@mozilla.org/scripterror;1']?.createInstance(Ci.nsIScriptError);
      if (err && svc) {
        err.init(line, '', null, 0, 0, level === 'error' ? Ci.nsIScriptError.errorFlag : Ci.nsIScriptError.warningFlag, 'chrome javascript');
        svc.logMessage(err);
        return;
      }
    }
    svc?.logStringMessage(line);
  } catch {
    // unit tests: no Services
  }
}

function text(args: unknown[]): string {
  return args.map((a) => {
    if (a instanceof Error) return a.message;
    if (typeof a === 'object' && a !== null) {
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    }
    return String(a);
  }).join(' ');
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  /** Runs `fn` and logs how long it took: "<label> in 123 ms" (or "failed after …"). */
  time<T>(label: string, fn: () => Promise<T>, summary?: (r: T) => string): Promise<T>;
}

export function logger(module: string): Logger {
  const prefix = module ? `[SemanticZotero:${module}]` : '[SemanticZotero]';
  const write = (level: LogLevel, args: unknown[]) => {
    const line = `${prefix} [${level.toUpperCase()}] ${text(args)}`;
    try {
      Zotero.debug(line);
    } catch {
      // unit tests: no Zotero
    }
    toConsole(level, line);
  };
  const l: Logger = {
    debug: (...a) => write('debug', a),
    info: (...a) => write('info', a),
    warn: (...a) => write('warn', a),
    error: (...a) => write('error', a),
    async time(label, fn, summary) {
      const t0 = Date.now();
      try {
        const r = await fn();
        write('info', [`${label} in ${Date.now() - t0} ms${summary ? `: ${summary(r)}` : ''}`]);
        return r;
      } catch (e) {
        write('warn', [`${label} failed after ${Date.now() - t0} ms: ${text([e])}`]);
        throw e;
      }
    },
  };
  return l;
}

const root = logger('');

export function log(msg: string): void {
  root.info(msg);
}

export function logError(e: unknown): void {
  root.error(e);
  Zotero.logError(e);
}
