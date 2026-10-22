export interface OperationFailure { kind: string; message: string }
export interface TicketReview<Request> { ticket: string; expiresAt: number; request: Request }
export interface OperationState<Request, Review, Execution> {
  busy: boolean;
  confirmed: boolean;
  review?: Review;
  attempt?: Request;
  result?: Execution;
  error?: OperationFailure;
}
export interface OperationPorts<Request, Review, Execution> {
  inspect: (request: Request) => Promise<Review>;
  execute: (review: Review) => Promise<Execution>;
  failure: (error: unknown, mutation: boolean, request: Request) => OperationFailure;
  onBusy: (busy: boolean) => void;
  onSettled: (request: Request) => void;
}

// Owns the safety rules and their state. Provider policy and recovery text are ports.
export class ReviewedOperation<Request, Review extends TicketReview<Request>, Execution> {
  private state: OperationState<Request, Review, Execution> = { busy: false, confirmed: false };
  private listeners = new Set<() => void>();
  private revision = 0;
  private ports: OperationPorts<Request, Review, Execution>;
  private now: () => number;
  constructor(ports: OperationPorts<Request, Review, Execution>, now = Date.now) {
    this.ports = ports;
    this.now = now;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(patch: Partial<OperationState<Request, Review, Execution>>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private working(busy: boolean) {
    this.update({ busy });
    this.ports.onBusy(busy);
  }
  get locked() {
    return this.state.busy || !!this.state.result || this.state.error?.kind === "uncertain";
  }
  invalidate = () => {
    this.revision++;
    this.update({ review: undefined, confirmed: false });
  };
  confirm = (confirmed: boolean) => {
    if (!this.state.busy && this.state.review) this.update({ confirmed });
  };
  inspect = async (request: Request) => {
    if (this.locked) return;
    this.invalidate();
    const revision = this.revision;
    this.update({ error: undefined, attempt: undefined });
    this.working(true);
    try {
      const review = await this.ports.inspect(request);
      if (revision === this.revision) this.update({ review });
    } catch (error) {
      if (revision === this.revision) this.update({ error: this.ports.failure(error, false, request) });
    } finally {
      this.working(false);
    }
  };
  execute = async () => {
    const snapshot = this.state.review;
    if (this.locked || !snapshot || !this.state.confirmed || snapshot.expiresAt <= this.now()) return;
    this.invalidate();
    this.update({ attempt: snapshot.request, error: undefined });
    this.working(true);
    try {
      this.update({ result: await this.ports.execute(snapshot) });
    } catch (error) {
      this.update({ error: this.ports.failure(error, true, snapshot.request) });
    } finally {
      this.working(false);
      this.ports.onSettled(snapshot.request);
    }
  };
  reset = () => {
    // An ambiguous financial request must be reconciled before a new operation.
    if (this.state.busy || this.state.error?.kind === "uncertain") return;
    this.invalidate();
    this.update({ result: undefined, attempt: undefined, error: undefined });
  };
}
