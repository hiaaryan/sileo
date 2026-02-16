import {
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Sileo } from "./sileo";
import {
  SILEO_POSITIONS,
  type SileoOffsetConfig,
  type SileoOffsetValue,
  type SileoOptions,
  type SileoPosition,
} from "../core/types";
import {
  DEFAULT_DURATION,
  dismissToast,
  store,
  timeoutKey,
  pillAlign,
  expandDir,
  type SileoItem,
  type SileoListener,
} from "../core/store";

/* ---------------------------------- Types --------------------------------- */

export interface SileoToasterProps {
  children?: ReactNode;
  position?: SileoPosition;
  offset?: SileoOffsetValue | SileoOffsetConfig;
  options?: Partial<SileoOptions>;
}

/* ------------------------------ Toaster Component ------------------------- */

export function Toaster({
  children,
  position = "top-right",
  offset,
  options,
}: SileoToasterProps) {
  const [toasts, setToasts] = useState<SileoItem[]>(store.toasts);
  const [activeId, setActiveId] = useState<string>();

  const hoverRef = useRef(false);
  const timersRef = useRef(new Map<string, number>());
  const listRef = useRef(toasts);
  const latestRef = useRef<string | undefined>(undefined);
  const handlersCache = useRef(
    new Map<
      string,
      {
        enter: MouseEventHandler<HTMLButtonElement>;
        leave: MouseEventHandler<HTMLButtonElement>;
        dismiss: () => void;
      }
    >()
  );

  useEffect(() => {
    store.position = position;
    store.options = options;
  }, [position, options]);

  const clearAllTimers = useCallback(() => {
    for (const t of timersRef.current.values()) clearTimeout(t);
    timersRef.current.clear();
  }, []);

  const schedule = useCallback((items: SileoItem[]) => {
    if (hoverRef.current) return;

    for (const item of items) {
      if (item.exiting) continue;
      const key = timeoutKey(item);
      if (timersRef.current.has(key)) continue;

      const dur = item.duration ?? DEFAULT_DURATION;
      if (dur === null || dur <= 0) continue;

      timersRef.current.set(
        key,
        window.setTimeout(() => dismissToast(item.id), dur)
      );
    }
  }, []);

  useEffect(() => {
    const listener: SileoListener = (next) => setToasts(next);
    store.listeners.add(listener);
    return () => {
      store.listeners.delete(listener);
      clearAllTimers();
    };
  }, [clearAllTimers]);

  useEffect(() => {
    listRef.current = toasts;

    const toastKeys = new Set(toasts.map(timeoutKey));
    const toastIds = new Set(toasts.map((t) => t.id));
    for (const [key, timer] of timersRef.current) {
      if (!toastKeys.has(key)) {
        clearTimeout(timer);
        timersRef.current.delete(key);
      }
    }
    for (const id of handlersCache.current.keys()) {
      if (!toastIds.has(id)) handlersCache.current.delete(id);
    }

    schedule(toasts);
  }, [toasts, schedule]);

  const handleMouseEnterRef =
    useRef<MouseEventHandler<HTMLButtonElement>>(null);
  const handleMouseLeaveRef =
    useRef<MouseEventHandler<HTMLButtonElement>>(null);

  handleMouseEnterRef.current = useCallback<
    MouseEventHandler<HTMLButtonElement>
  >(() => {
    if (hoverRef.current) return;
    hoverRef.current = true;
    clearAllTimers();
  }, [clearAllTimers]);

  handleMouseLeaveRef.current = useCallback<
    MouseEventHandler<HTMLButtonElement>
  >(() => {
    if (!hoverRef.current) return;
    hoverRef.current = false;
    schedule(listRef.current);
  }, [schedule]);

  const latest = useMemo(() => {
    for (let i = toasts.length - 1; i >= 0; i--) {
      if (!toasts[i].exiting) return toasts[i].id;
    }
    return undefined;
  }, [toasts]);

  useEffect(() => {
    latestRef.current = latest;
    setActiveId(latest);
  }, [latest]);

  const getHandlers = useCallback((toastId: string) => {
    let cached = handlersCache.current.get(toastId);
    if (cached) return cached;

    cached = {
      enter: ((e) => {
        setActiveId((prev) => (prev === toastId ? prev : toastId));
        handleMouseEnterRef.current?.(e);
      }) as MouseEventHandler<HTMLButtonElement>,
      leave: ((e) => {
        setActiveId((prev) =>
          prev === latestRef.current ? prev : latestRef.current
        );
        handleMouseLeaveRef.current?.(e);
      }) as MouseEventHandler<HTMLButtonElement>,
      dismiss: () => dismissToast(toastId),
    };

    handlersCache.current.set(toastId, cached);
    return cached;
  }, []);

  const getViewportStyle = useCallback(
    (pos: SileoPosition): CSSProperties | undefined => {
      if (offset === undefined) return undefined;

      const o =
        typeof offset === "object"
          ? offset
          : { top: offset, right: offset, bottom: offset, left: offset };

      const s: CSSProperties = {};
      const px = (v: SileoOffsetValue) =>
        typeof v === "number" ? `${v}px` : v;

      if (pos.startsWith("top") && o.top) s.top = px(o.top);
      if (pos.startsWith("bottom") && o.bottom) s.bottom = px(o.bottom);
      if (pos.endsWith("left") && o.left) s.left = px(o.left);
      if (pos.endsWith("right") && o.right) s.right = px(o.right);

      return s;
    },
    [offset]
  );

  const byPosition = useMemo(() => {
    const map = {} as Partial<Record<SileoPosition, SileoItem[]>>;
    for (const t of toasts) {
      const pos = t.position ?? position;
      const arr = map[pos];
      if (arr) {
        arr.push(t);
      } else {
        map[pos] = [t];
      }
    }
    return map;
  }, [toasts, position]);

  return (
    <>
      {children}
      {SILEO_POSITIONS.map((pos) => {
        const items = byPosition[pos];
        if (!items?.length) return null;

        const pill = pillAlign(pos);
        const expand = expandDir(pos);

        return (
          <section
            key={pos}
            data-sileo-viewport
            data-position={pos}
            aria-live="polite"
            style={getViewportStyle(pos)}
          >
            {items.map((item) => {
              const h = getHandlers(item.id);
              return (
                <Sileo
                  key={item.id}
                  id={item.id}
                  state={item.state}
                  title={item.title}
                  description={item.description}
                  position={pill}
                  expand={expand}
                  icon={item.icon}
                  fill={item.fill}
                  styles={item.styles}
                  button={item.button}
                  roundness={item.roundness}
                  exiting={item.exiting}
                  autoExpandDelayMs={item.autoExpandDelayMs}
                  autoCollapseDelayMs={item.autoCollapseDelayMs}
                  refreshKey={item.instanceId}
                  canExpand={activeId === undefined || activeId === item.id}
                  onMouseEnter={h.enter}
                  onMouseLeave={h.leave}
                  onDismiss={h.dismiss}
                />
              );
            })}
          </section>
        );
      })}
    </>
  );
}
