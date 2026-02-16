import {
  type PropType,
  type VNode,
  Fragment,
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
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
import {
  SILEO_POSITIONS,
  type SileoOffsetConfig,
  type SileoOffsetValue,
  type SileoOptions,
  type SileoPosition,
} from "../core/types";
import { Sileo } from "./sileo";

/* ------------------------------ Toaster Component ------------------------- */

export const Toaster = defineComponent({
  name: "SileoToaster",
  props: {
    position: {
      type: String as PropType<SileoPosition>,
      default: "top-right",
    },
    offset: {
      type: [Number, String, Object] as PropType<
        SileoOffsetValue | SileoOffsetConfig
      >,
      default: undefined,
    },
    options: {
      type: Object as PropType<Partial<SileoOptions>>,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    const isMounted = ref(false);
    const toasts = ref<SileoItem[]>([]);
    const activeId = ref<string | undefined>();

    let isHovering = false;
    const timers = new Map<string, number>();
    let latestId: string | undefined;

    const handlersCache = new Map<
      string,
      {
        enter: (e: MouseEvent) => void;
        leave: (e: MouseEvent) => void;
        dismiss: () => void;
      }
    >();

    /* ----------------------------- Store Sync ----------------------------- */

    watch(
      [() => props.position, () => props.options],
      ([pos, opts]) => {
        store.position = pos;
        store.options = opts;
      },
      { immediate: true }
    );

    const clearAllTimers = () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };

    const schedule = (items: SileoItem[]) => {
      if (isHovering) return;
      for (const item of items) {
        if (item.exiting) continue;
        const key = timeoutKey(item);
        if (timers.has(key)) continue;
        const dur = item.duration ?? DEFAULT_DURATION;
        if (dur === null || dur <= 0) continue;
        timers.set(
          key,
          window.setTimeout(() => dismissToast(item.id), dur)
        );
      }
    };

    const listener: SileoListener = (next) => {
      toasts.value = next;
    };

    onMounted(() => {
      isMounted.value = true;
      toasts.value = [...store.toasts];
      store.listeners.add(listener);
    });

    onUnmounted(() => {
      store.listeners.delete(listener);
      clearAllTimers();
    });

    /* ----------------------------- Timer Management ----------------------- */

    watch(toasts, (items) => {
      const toastKeys = new Set(items.map(timeoutKey));
      const toastIds = new Set(items.map((t) => t.id));
      for (const [key, timer] of timers) {
        if (!toastKeys.has(key)) {
          clearTimeout(timer);
          timers.delete(key);
        }
      }
      for (const id of handlersCache.keys()) {
        if (!toastIds.has(id)) handlersCache.delete(id);
      }
      schedule(items);
    });

    /* ----------------------------- Active Tracking ------------------------ */

    const latest = computed(() => {
      for (let i = toasts.value.length - 1; i >= 0; i--) {
        if (!toasts.value[i].exiting) return toasts.value[i].id;
      }
      return undefined;
    });

    watch(
      latest,
      (val) => {
        latestId = val;
        activeId.value = val;
      },
      { immediate: true }
    );

    /* ----------------------------- Handlers ------------------------------- */

    const getHandlers = (toastId: string) => {
      let cached = handlersCache.get(toastId);
      if (cached) return cached;

      cached = {
        enter: () => {
          activeId.value = toastId;
          if (!isHovering) {
            isHovering = true;
            clearAllTimers();
          }
        },
        leave: () => {
          activeId.value = latestId;
          if (isHovering) {
            isHovering = false;
            schedule(toasts.value);
          }
        },
        dismiss: () => dismissToast(toastId),
      };

      handlersCache.set(toastId, cached);
      return cached;
    };

    const getViewportStyle = (pos: SileoPosition) => {
      if (props.offset === undefined) return undefined;
      const o =
        typeof props.offset === "object"
          ? (props.offset as SileoOffsetConfig)
          : {
              top: props.offset,
              right: props.offset,
              bottom: props.offset,
              left: props.offset,
            };
      const s: Record<string, string> = {};
      const px = (v: SileoOffsetValue) =>
        typeof v === "number" ? `${v}px` : v;
      if (pos.startsWith("top") && o.top) s.top = px(o.top);
      if (pos.startsWith("bottom") && o.bottom) s.bottom = px(o.bottom);
      if (pos.endsWith("left") && o.left) s.left = px(o.left);
      if (pos.endsWith("right") && o.right) s.right = px(o.right);
      return s;
    };

    /* ----------------------------- Grouping ------------------------------- */

    const byPosition = computed(() => {
      const map = {} as Partial<Record<SileoPosition, SileoItem[]>>;
      for (const t of toasts.value) {
        const pos = (t.position ?? props.position) as SileoPosition;
        const arr = map[pos];
        if (arr) {
          arr.push(t);
        } else {
          map[pos] = [t];
        }
      }
      return map;
    });

    /* -------------------------------- Render ------------------------------ */

    return () => {
      if (!isMounted.value) return slots.default?.() ?? null;

      const viewports: VNode[] = [];

      for (const pos of SILEO_POSITIONS) {
        const items = byPosition.value[pos];
        if (!items?.length) continue;

        const pill = pillAlign(pos);
        const expand = expandDir(pos);

        viewports.push(
          h(
            "section",
            {
              key: pos,
              "data-sileo-viewport": "",
              "data-position": pos,
              "aria-live": "polite",
              style: getViewportStyle(pos),
            },
            items.map((item) => {
              const handlers = getHandlers(item.id);
              return h(Sileo, {
                key: item.id,
                id: item.id,
                state: item.state,
                title: item.title,
                description: item.description,
                position: pill,
                expand,
                icon: item.icon,
                fill: item.fill,
                styles: item.styles,
                button: item.button,
                roundness: item.roundness,
                exiting: item.exiting,
                autoExpandDelayMs: item.autoExpandDelayMs,
                autoCollapseDelayMs: item.autoCollapseDelayMs,
                refreshKey: item.instanceId,
                canExpand:
                  activeId.value === undefined || activeId.value === item.id,
                onMouseEnter: handlers.enter,
                onMouseLeave: handlers.leave,
                onDismiss: handlers.dismiss,
              });
            })
          )
        );
      }

      return h(Fragment, [slots.default?.(), ...viewports]);
    };
  },
});
