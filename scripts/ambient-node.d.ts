/**
 * @module scripts/ambient-node
 * Declaraciones de entorno mínimas para los scripts de Node del proyecto.
 *
 * Este fichero es un *script global* (sin `import`/`export`), por lo que
 * `declare module` actúa como declaración de módulo ambiente y no como
 * *module augmentation* (lo que provocaría el error TS2664). Se declaran
 * únicamente los miembros de `node:fs` que realmente usa `generate-index.ts`,
 * evitando arrastrar los globals de `@types/node` (que entrarían en conflicto
 * con la lib DOM que usa toda la aplicación).
 */

declare module 'node:fs' {
  /** Entrada de directorio devuelta por `readdirSync` con `withFileTypes`. */
  export interface Dirent {
    name: string;
    isDirectory(): boolean;
  }

  /** Lista el contenido de un directorio (con información de tipo). */
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];

  /** Lee un fichero de texto completo. */
  export function readFileSync(path: string, encoding: 'utf8'): string;

  /** Escribe un fichero de texto completo. */
  export function writeFileSync(path: string, data: string, encoding: 'utf8'): void;

  /** Comprueba si una ruta existe. */
  export function existsSync(path: string): boolean;

  /** Crea un directorio (y sus padres si no existen). */
  export function mkdirSync(path: string, options: { recursive: boolean }): void;
}
