import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { failure } from "../../api";
import { ReviewedOperation, type OperationPorts, type TicketReview } from "./reviewed_operation";

export function useReviewedOperation<Request, Review extends TicketReview<Request>, Execution>(
  options: Omit<OperationPorts<Request, Review, Execution>, "failure"> & {
    failure?: OperationPorts<Request, Review, Execution>["failure"];
  },
) {
  const latest = useRef(options);
  latest.current = options;
  const [operation] = useState(() => new ReviewedOperation<Request, Review, Execution>({
    inspect: (request) => latest.current.inspect(request),
    execute: (review) => latest.current.execute(review),
    failure: (error, mutation, request) => latest.current.failure?.(error, mutation, request) ?? failure(error, mutation),
    onBusy: (busy) => latest.current.onBusy(busy),
    onSettled: (request) => latest.current.onSettled(request),
  }));
  const state = useSyncExternalStore(operation.subscribe, operation.getSnapshot);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!state.review) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.review]);
  return { ...state, clock, locked: operation.locked,
    invalidate: operation.invalidate, setConfirmed: operation.confirm,
    inspect: operation.inspect, execute: operation.execute, reset: operation.reset };
}
