/** RFC 7807 problem from the backend; branch on `code`, never on the text. */
export class OrbiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.name = "OrbiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

