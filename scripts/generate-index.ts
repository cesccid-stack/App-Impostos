/**
 * @module scripts/generate-index
 * Genera `docs/CODE_INDEX.md`: índice compacto de todos los símbolos exportados
 * por los módulos de `src/`. Permite a un agente de IA localizar funciones,
 * interfaces, tipos y constantes **sin abrir los ficheros** (ahorro de contexto y tokens).
 *
 * Uso:  npm run index
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

// Igual que `verify-renta.ts`, declaramos localmente el único global que usamos
// para que el script type-checkee en modo estricto sin depender de `@types/node`.
declare const process: { cwd(): string; exit(code?: number): void };

type SymbolKind = 'function' | 'const' | 'class' | 'interface' | 'type' | 'enum' | 'reexport';

interface ExportedSymbol {
  kind: SymbolKind;
  name: string;
}

/** Punto de navegación dentro de un módulo (título de sección o declaración). */
interface Landmark {
  line: number;
  label: string;
}

interface ModuleEntry {
  path: string;
  description: string;
  lines: number;
  symbols: ExportedSymbol[];
  landmarks: Landmark[];
}

/** Solo se genera mapa de secciones para módulos a partir de este tamaño. */
const LANDMARK_MIN_LINES = 800;

/** Máximo de anclas por fichero (mantiene el índice compacto). */
const MAX_LANDMARKS = 35;

interface ModuleGroup {
  name: string;
  entries: ModuleEntry[];
}

/** Rutas base (normalizadas a `/` para salida estable entre plataformas). */
const ROOT = process.cwd().replace(/\\/g, '/');
const SRC_DIR = `${ROOT}/src`;
const DOCS_DIR = `${ROOT}/docs`;
const OUT_FILE = `${DOCS_DIR}/CODE_INDEX.md`;
const SYMBOLS_FILE = `${DOCS_DIR}/SYMBOLS.md`;

/** Patrones de exportación (se construyen por uso para evitar el estado de `lastIndex`). */
const SYMBOL_PATTERNS: Array<{ kind: SymbolKind; pattern: string }> = [
  { kind: 'function', pattern: '^export\\s+(?:async\\s+)?function\\s+([A-Za-z0-9_$]+)' },
  { kind: 'class', pattern: '^export\\s+(?:abstract\\s+)?class\\s+([A-Za-z0-9_$]+)' },
  { kind: 'const', pattern: '^export\\s+(?:const|let|var)\\s+([A-Za-z0-9_$]+)' },
  { kind: 'interface', pattern: '^export\\s+interface\\s+([A-Za-z0-9_$]+)' },
  { kind: 'enum', pattern: '^export\\s+enum\\s+([A-Za-z0-9_$]+)' },
  { kind: 'type', pattern: '^export\\s+type\\s+([A-Za-z0-9_$]+)' },
];

/** Reexportaciones: `export { a, b }` y `export type { X } from '...'`. */
const REEXPORT_PATTERN = '^export\\s+(?:type\\s+)?\\{([^}]*)\\}';

const SYMBOL_ORDER: SymbolKind[] = ['function', 'class', 'const', 'interface', 'type', 'enum', 'reexport'];

const KIND_LABELS: Record<SymbolKind, string> = {
  function: 'funciones',
  class: 'clases',
  const: 'constantes',
  interface: 'interfaces',
  type: 'tipos',
  enum: 'enums',
  reexport: 'reexportaciones',
};

/** Orden de presentación de los grupos de directorios. */
const GROUP_ORDER = ['src (raíz)', 'src/components', 'src/fiscal', 'src/import', 'src/pages', 'src/utils'];

/** Título de sección en una sola línea: `// ── Título ──`. */
const DIVIDER_INLINE = /^\/\/\s*[─═=*#]{2,}\s+(\S.*?)\s+[─═=*#]{2,}$/;

/** Línea decorativa pura: `// ═════════════`. */
const DIVIDER_PURE = /^\/\/\s*[─═=*#]{5,}$/;

/** Declaraciones de nivel superior usadas como anclas de navegación. */
const DECLARATION_PATTERNS: Array<{ prefix: string; pattern: RegExp }> = [
  { prefix: 'fn', pattern: /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/ },
  { prefix: 'class', pattern: /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/ },
  { prefix: 'const', pattern: /^(?:export\s+)?(?:const|let)\s+([A-Za-z0-9_$]+)\s*[:=]/ },
  { prefix: 'iface', pattern: /^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/ },
  { prefix: 'type', pattern: /^(?:export\s+)?type\s+([A-Za-z0-9_$]+)/ },
];

/** Recorre un directorio y devuelve todos los ficheros `.ts` (excluye `.d.ts`). */
function listTsFiles(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      listTsFiles(full, acc);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

/** Extrae la descripción del bloque de cabecera `@module` (máx. 180 caracteres). */
function extractDescription(source: string, fallback: string): string {
  const lines = source.split('\n').slice(0, 20);
  const parts: string[] = [];
  let inside = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inside) {
      if (trimmed.startsWith('/**')) inside = true;
      continue;
    }
    if (trimmed.startsWith('*/')) break;
    const text = trimmed.replace(/^\*\s?/, '').trim();
    if (text.length === 0 || text.startsWith('@module')) continue;
    parts.push(text);
  }
  const description = parts.join(' ');
  if (description.length === 0) return `Módulo \`${fallback}\`.`;
  return description.length > 180 ? `${description.slice(0, 177)}…` : description;
}

/** Normaliza el nombre de una reexportación (`type X`, `A as B`). */
function normalizeReexportName(raw: string): string {
  let name = raw.trim().replace(/^type\s+/, '');
  const asIndex = name.indexOf(' as ');
  if (asIndex !== -1) name = name.slice(asIndex + 4).trim();
  return name.replace(/[^A-Za-z0-9_$]/g, '');
}

/** Extrae los símbolos exportados por un módulo (sin duplicados por nombre). */
function extractSymbols(source: string): ExportedSymbol[] {
  const found: ExportedSymbol[] = [];

  for (const { kind, pattern } of SYMBOL_PATTERNS) {
    const regex = new RegExp(pattern, 'gm');
    let match = regex.exec(source);
    while (match !== null) {
      found.push({ kind, name: match[1] });
      match = regex.exec(source);
    }
  }

  const reexportRegex = new RegExp(REEXPORT_PATTERN, 'gm');
  let reexport = reexportRegex.exec(source);
  while (reexport !== null) {
    for (const raw of reexport[1].split(',')) {
      const name = normalizeReexportName(raw);
      if (name.length > 0) found.push({ kind: 'reexport', name });
    }
    reexport = reexportRegex.exec(source);
  }

  const seen = new Set<string>();
  return found.filter((symbol) => {
    if (seen.has(symbol.name)) return false;
    seen.add(symbol.name);
    return true;
  });
}

/** Devuelve el índice de la siguiente línea no vacía, o -1 si no existe. */
function nextNonEmptyIndex(lines: string[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].trim().length > 0) return i;
  }
  return -1;
}

/**
 * Extrae anclas de navegación: títulos de sección (`// ── Título ──` y bloques
 * `// ═══` + título) y declaraciones de nivel superior (columna 0).
 */
function extractLandmarks(source: string): Landmark[] {
  const lines = source.split('\n');
  const landmarks: Landmark[] = [];

  for (let i = 0; i < lines.length && landmarks.length < MAX_LANDMARKS; i++) {
    const trimmed = lines[i].trim();

    const inline = DIVIDER_INLINE.exec(trimmed);
    if (inline !== null && inline[1].trim().length > 2) {
      landmarks.push({ line: i + 1, label: `§ ${inline[1].trim()}` });
      continue;
    }

    if (DIVIDER_PURE.test(trimmed)) {
      const nextIndex = nextNonEmptyIndex(lines, i + 1);
      if (nextIndex !== -1) {
        const next = lines[nextIndex].trim();
        if (next.startsWith('//') && next.length > 4 && !DIVIDER_PURE.test(next)) {
          landmarks.push({ line: i + 1, label: `§ ${next.replace(/^\/\/\s?/, '').trim()}` });
        }
      }
      continue;
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    for (const { prefix, pattern } of DECLARATION_PATTERNS) {
      const match = pattern.exec(lines[i]);
      if (match !== null) {
        landmarks.push({ line: i + 1, label: `${prefix} ${match[1]}` });
        break;
      }
    }
  }

  return landmarks;
}

/** Grupo de directorio al que pertenece un módulo. */
function groupOf(path: string): string {
  const rel = path.startsWith('src/') ? path.slice(4) : path;
  const slash = rel.indexOf('/');
  return slash === -1 ? 'src (raíz)' : `src/${rel.slice(0, slash)}`;
}

/** Agrupa los módulos por directorio, en el orden definido por `GROUP_ORDER`. */
function groupEntries(entries: ModuleEntry[]): ModuleGroup[] {
  const map = new Map<string, ModuleEntry[]>();
  for (const entry of entries) {
    const key = groupOf(entry.path);
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .map(([name, list]) => ({ name, entries: list }))
    .sort((a, b) => {
      const indexA = GROUP_ORDER.indexOf(a.name);
      const indexB = GROUP_ORDER.indexOf(b.name);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
}

/** Renderiza la lista de símbolos de un módulo, agrupados por tipo. */
function renderSymbols(symbols: ExportedSymbol[]): string[] {
  const lines: string[] = [];
  for (const kind of SYMBOL_ORDER) {
    const names = symbols.filter((symbol) => symbol.kind === kind).map((symbol) => `\`${symbol.name}\``);
    if (names.length > 0) lines.push(`- **${KIND_LABELS[kind]}:** ${names.join(', ')}`);
  }
  return lines.length > 0 ? lines : ['- *(sin exportaciones detectadas)*'];
}

/** Construye el Markdown del índice de módulos (con el mapa de secciones). */
function renderModulesMarkdown(entries: ModuleEntry[]): string {
  const totalSymbols = entries.reduce((sum, entry) => sum + entry.symbols.length, 0);
  const totalLines = entries.reduce((sum, entry) => sum + entry.lines, 0);
  const out: string[] = [];

  out.push('# CODE_INDEX — Índice de módulos y mapa de secciones');
  out.push('');
  out.push('> **Fichero generado automáticamente. No lo edites a mano: usa `npm run index`.**');
  out.push('> **Búscalo** (`search_codebase`) para localizar un módulo o una sección; **no lo leas entero.**');
  out.push('> Índice alfabético de símbolos: **`docs/SYMBOLS.md`**. Contexto y convenciones: **`AGENTS.md`**.');
  out.push('');
  out.push(`- Módulos indexados: **${entries.length}**`);
  out.push(`- Símbolos exportados: **${totalSymbols}**`);
  out.push(`- Líneas de código: **${totalLines}**`);
  out.push('');
  out.push('## Grupos');
  out.push('');

  const groups = groupEntries(entries);
  for (const group of groups) {
    out.push(`- \`${group.name}\` — ${group.entries.length} módulos`);
  }
  out.push('');

  for (const group of groups) {
    out.push(`## ${group.name}`);
    out.push('');
    for (const entry of group.entries) {
      out.push(`### \`${entry.path}\` · ${entry.lines} líneas`);
      out.push('');
      out.push(entry.description);
      out.push('');
      out.push(...renderSymbols(entry.symbols));
      out.push('');
    }
  }

  const bigFiles = entries.filter((entry) => entry.landmarks.length > 0);
  if (bigFiles.length > 0) {
    out.push('## Mapa de secciones — ficheros ≥ 800 líneas');
    out.push('');
    out.push('> **No leas estos ficheros completos.** Salta a la línea indicada con');
    out.push('> `read_files` (`start_line`/`end_line`). Si un fichero tiene pocas anclas es');
    out.push('> porque concentra casi todo en una única función: busca dentro con `search_codebase`.');
    out.push('');
    for (const entry of bigFiles) {
      out.push(`### \`${entry.path}\` · ${entry.lines} líneas`);
      out.push('');
      for (const landmark of entry.landmarks) {
        out.push(`- L${landmark.line} · ${landmark.label}`);
      }
      out.push('');
    }
  }

  return out.join('\n');
}

/** Construye el Markdown del índice alfabético símbolo → fichero(s). */
function renderSymbolsMarkdown(entries: ModuleEntry[]): string {
  const out: string[] = [];

  out.push('# SYMBOLS — Índice alfabético de símbolos');
  out.push('');
  out.push('> **Fichero generado automáticamente. No lo edites a mano: usa `npm run index`.**');
  out.push('> **Búscalo** (`search_codebase`) para ver en qué fichero(s) se exporta un símbolo.');
  out.push('> Índice de módulos y mapa de secciones: **`docs/CODE_INDEX.md`**.');
  out.push('');

  const symbolMap = new Map<string, Set<string>>();
  for (const entry of entries) {
    for (const symbol of entry.symbols) {
      const set = symbolMap.get(symbol.name) ?? new Set<string>();
      set.add(entry.path);
      symbolMap.set(symbol.name, set);
    }
  }

  const names = Array.from(symbolMap.keys()).sort((a, b) => a.localeCompare(b, 'es'));
  out.push(`Nombres de símbolo únicos: **${names.length}**`);
  out.push('');
  for (const name of names) {
    const paths = Array.from(symbolMap.get(name) ?? []).sort();
    out.push(`- \`${name}\` → ${paths.map((path) => `\`${path}\``).join(', ')}`);
  }
  out.push('');

  return out.join('\n');
}

/** Convierte un fichero en una entrada del índice. */
function toEntry(fullPath: string): ModuleEntry {
  const source = readFileSync(fullPath, 'utf8');
  const path = fullPath.replace(`${ROOT}/`, '');
  const lines = source.split('\n').length;
  return {
    path,
    description: extractDescription(source, path),
    lines,
    symbols: extractSymbols(source),
    landmarks: lines >= LANDMARK_MIN_LINES ? extractLandmarks(source) : [],
  };
}

/** Punto de entrada: indexa `src/` y escribe `docs/CODE_INDEX.md` y `docs/SYMBOLS.md`. */
function main(): void {
  if (!existsSync(SRC_DIR)) {
    console.error(`No se ha encontrado el directorio fuente: ${SRC_DIR}`);
    process.exit(1);
  }

  const files = listTsFiles(SRC_DIR, []).sort();
  const entries = files.map(toEntry);

  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
  writeFileSync(OUT_FILE, renderModulesMarkdown(entries), 'utf8');
  writeFileSync(SYMBOLS_FILE, renderSymbolsMarkdown(entries), 'utf8');

  const totalSymbols = entries.reduce((sum, entry) => sum + entry.symbols.length, 0);
  console.log(
    `Índice generado: docs/CODE_INDEX.md + docs/SYMBOLS.md (${entries.length} módulos, ${totalSymbols} símbolos)`,
  );
}

main();
