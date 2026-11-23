declare module 'file-system-db' {
  export default class FSDB<T> {
    constructor(path: string);
    all(): { ID: string; data: T }[];
    set(id: string, data: T): void;
    delete(id: string): void;
  }
}
