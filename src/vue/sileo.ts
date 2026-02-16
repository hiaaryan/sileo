import {
  type PropType,
  type VNode,
  type VNodeChild,
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import type { SileoButton, SileoState, SileoStyles } from "../core/types";
import {
  ArrowRight,
  Check,
  CircleAlert,
  LifeBuoy,
  LoaderCircle,
  X,
} from "./icons";

/* --------------------------------- Config --------------------------------- */

const HEIGHT = 40;
const WIDTH = 350;
const DEFAULT_ROUNDNESS = 18;
const BLUR_RATIO = 0.5;
const PILL_PADDING = 10;
const MIN_EXPAND_RATIO = 2.25;
const SWAP_COLLAPSE_MS = 200;
const HEADER_EXIT_MS = 150;

type State = SileoState;

interface View {
  title?: string;
  description?: unknown;
  state: State;
  icon?: unknown;
  styles?: SileoStyles;
  button?: SileoButton;
  fill: string;
}

/* ---------------------------------- Icons --------------------------------- */

const STATE_ICON: Record<State, () => VNode> = {
  success: () => Check(),
  loading: () =>
    LoaderCircle({ "data-sileo-icon": "spin", "aria-hidden": "true" }),
  error: () => X(),
  warning: () => CircleAlert(),
  info: () => LifeBuoy(),
  action: () => ArrowRight(),
};

/* ----------------------------- Gooey SVG Filter --------------------------- */

function GooeyDefs(filterId: string, blur: number): VNode {
  return h("defs", null, [
    h(
      "filter",
      {
        id: filterId,
        x: "-20%",
        y: "-20%",
        width: "140%",
        height: "140%",
        "color-interpolation-filters": "sRGB",
      },
      [
        h("feGaussianBlur", {
          in: "SourceGraphic",
          stdDeviation: blur,
          result: "blur",
        }),
        h("feColorMatrix", {
          in: "blur",
          mode: "matrix",
          values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10",
          result: "goo",
        }),
        h("feComposite", {
          in: "SourceGraphic",
          in2: "goo",
          operator: "atop",
        }),
      ]
    ),
  ]);
}

/* ------------------------------- Component -------------------------------- */

export const Sileo = defineComponent({
  name: "Sileo",
  props: {
    id: { type: String, required: true },
    fill: { type: String, default: "#FFFFFF" },
    state: { type: String as PropType<State>, default: "success" },
    title: { type: String, default: undefined },
    description: { default: undefined },
    position: {
      type: String as PropType<"left" | "center" | "right">,
      default: "left",
    },
    expand: {
      type: String as PropType<"top" | "bottom">,
      default: "bottom",
    },
    className: { type: String, default: undefined },
    icon: { default: undefined },
    styles: { type: Object as PropType<SileoStyles>, default: undefined },
    button: { type: Object as PropType<SileoButton>, default: undefined },
    roundness: { type: Number, default: undefined },
    exiting: { type: Boolean, default: false },
    autoExpandDelayMs: { type: Number, default: undefined },
    autoCollapseDelayMs: { type: Number, default: undefined },
    canExpand: { type: Boolean, default: undefined },
    interruptKey: { type: String, default: undefined },
    refreshKey: { type: String, default: undefined },
    onMouseEnter: {
      type: Function as PropType<(e: MouseEvent) => void>,
      default: undefined,
    },
    onMouseLeave: {
      type: Function as PropType<(e: MouseEvent) => void>,
      default: undefined,
    },
    onDismiss: {
      type: Function as PropType<() => void>,
      default: undefined,
    },
  },
  setup(props) {
    const resolvedTitle = computed(() => props.title ?? props.state);

    const next = computed<View>(() => ({
      title: resolvedTitle.value,
      description: props.description,
      state: props.state,
      icon: props.icon,
      styles: props.styles,
      button: props.button,
      fill: props.fill,
    }));

    /* ------------------------------- State -------------------------------- */

    const view = ref<View>({ ...next.value });
    const applied = ref(props.refreshKey);
    const isExpanded = ref(false);
    const ready = ref(false);
    const pillWidth = ref(0);
    const contentHeight = ref(0);

    const hasDesc = computed(
      () => Boolean(view.value.description) || Boolean(view.value.button)
    );
    const isLoading = computed(() => view.value.state === "loading");
    const open = computed(
      () => hasDesc.value && isExpanded.value && !isLoading.value
    );
    const allowExpand = computed(() => {
      if (isLoading.value) return false;
      return (
        props.canExpand ??
        (!props.interruptKey || props.interruptKey === props.id)
      );
    });

    const headerKey = computed(() => `${view.value.state}-${view.value.title}`);
    const filterId = computed(() => `sileo-gooey-${props.id}`);
    const resolvedRoundness = computed(() =>
      Math.max(0, props.roundness ?? DEFAULT_ROUNDNESS)
    );
    const blur = computed(() => resolvedRoundness.value * BLUR_RATIO);

    /* ------------------------------- Refs --------------------------------- */

    const headerRef = ref<HTMLDivElement | null>(null);
    const contentRef = ref<HTMLDivElement | null>(null);
    const innerRef = ref<HTMLDivElement | null>(null);
    const buttonRef = ref<HTMLButtonElement | null>(null);

    let headerExitTimer: number | null = null;
    let autoExpandTimer: number | null = null;
    let autoCollapseTimer: number | null = null;
    let swapTimer: number | null = null;
    let lastRefreshKey = props.refreshKey;
    let pendingView: { key?: string; payload: View } | null = null;
    let headerPadding: number | null = null;
    let frozenExpanded = HEIGHT * MIN_EXPAND_RATIO;
    let pointerStartY: number | null = null;

    /* ----------------------------- Header Layer --------------------------- */

    const headerLayer = ref<{
      current: { key: string; view: View };
      prev: { key: string; view: View } | null;
    }>({
      current: { key: headerKey.value, view: { ...view.value } },
      prev: null,
    });

    /* ----------------------------- Derived Values ------------------------- */

    const minExpanded = HEIGHT * MIN_EXPAND_RATIO;

    const rawExpanded = computed(() => {
      if (!hasDesc.value) return minExpanded;
      return Math.max(minExpanded, HEIGHT + contentHeight.value);
    });

    const expanded = computed(() => {
      if (open.value) {
        frozenExpanded = rawExpanded.value;
        return rawExpanded.value;
      }
      return frozenExpanded;
    });

    const svgHeight = computed(() =>
      hasDesc.value ? Math.max(expanded.value, minExpanded) : HEIGHT
    );
    const expandedContent = computed(() =>
      Math.max(0, expanded.value - HEIGHT)
    );
    const resolvedPillWidth = computed(() =>
      Math.max(pillWidth.value || HEIGHT, HEIGHT)
    );
    const pillHeight = computed(() => HEIGHT + blur.value * 3);
    const pillX = computed(() => {
      if (props.position === "right") return WIDTH - resolvedPillWidth.value;
      if (props.position === "center")
        return (WIDTH - resolvedPillWidth.value) / 2;
      return 0;
    });

    const rootStyle = computed(() => ({
      "--_h": `${open.value ? expanded.value : HEIGHT}px`,
      "--_pw": `${resolvedPillWidth.value}px`,
      "--_px": `${pillX.value}px`,
      "--_sy": `${open.value ? 1 : HEIGHT / pillHeight.value}`,
      "--_ph": `${pillHeight.value}px`,
      "--_by": `${open.value ? 1 : 0}`,
      "--_ht": `translateY(${open.value ? (props.expand === "bottom" ? 3 : -3) : 0}px) scale(${open.value ? 0.9 : 1})`,
      "--_co": `${open.value ? 1 : 0}`,
    }));

    /* ----------------------------- Measurements --------------------------- */

    let pillRo: ResizeObserver | null = null;
    let pillRafId = 0;
    let contentRo: ResizeObserver | null = null;
    let contentRafId = 0;

    const measurePillWidth = () => {
      const el = innerRef.value;
      const header = headerRef.value;
      if (!el || !header) return;
      if (headerPadding === null) {
        const cs = getComputedStyle(header);
        headerPadding =
          parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      }
      const w = el.scrollWidth + headerPadding + PILL_PADDING;
      if (w > PILL_PADDING) {
        pillWidth.value = w;
      }
    };

    const setupPillObserver = () => {
      if (pillRo) {
        cancelAnimationFrame(pillRafId);
        pillRo.disconnect();
      }
      const el = innerRef.value;
      if (!el) return;
      measurePillWidth();
      pillRo = new ResizeObserver(() => {
        cancelAnimationFrame(pillRafId);
        pillRafId = requestAnimationFrame(measurePillWidth);
      });
      pillRo.observe(el);
    };

    const measureContentHeight = () => {
      const el = contentRef.value;
      if (!el) return;
      contentHeight.value = el.scrollHeight;
    };

    const setupContentObserver = () => {
      if (contentRo) {
        cancelAnimationFrame(contentRafId);
        contentRo.disconnect();
        contentRo = null;
      }
      if (!hasDesc.value) {
        contentHeight.value = 0;
        return;
      }
      const el = contentRef.value;
      if (!el) return;
      measureContentHeight();
      contentRo = new ResizeObserver(() => {
        cancelAnimationFrame(contentRafId);
        contentRafId = requestAnimationFrame(measureContentHeight);
      });
      contentRo.observe(el);
    };

    /* ----------------------------- Header Layer Sync ---------------------- */

    watch(
      [headerKey, () => view.value],
      ([newKey]) => {
        const state = headerLayer.value;
        if (state.current.key === newKey) {
          if (state.current.view === view.value) return;
          headerLayer.value = {
            ...state,
            current: { key: newKey, view: view.value },
          };
        } else {
          headerLayer.value = {
            prev: state.current,
            current: { key: newKey, view: view.value },
          };
        }
      },
      { flush: "sync" }
    );

    watch(
      () => headerLayer.value.prev,
      (prev) => {
        if (!prev) return;
        if (headerExitTimer) clearTimeout(headerExitTimer);
        headerExitTimer = window.setTimeout(() => {
          headerExitTimer = null;
          headerLayer.value = { ...headerLayer.value, prev: null };
        }, HEADER_EXIT_MS);
      }
    );

    watch(
      () => headerLayer.value.current.key,
      () => nextTick(setupPillObserver),
      { flush: "post" }
    );

    watch(hasDesc, () => nextTick(setupContentObserver), { flush: "post" });

    /* ----------------------------- Refresh Logic -------------------------- */

    watch(
      [open, () => props.refreshKey, next],
      ([openVal, refreshKeyVal, nextVal]) => {
        if (refreshKeyVal === undefined) {
          view.value = nextVal as View;
          applied.value = undefined;
          pendingView = null;
          lastRefreshKey = refreshKeyVal;
          return;
        }

        if (lastRefreshKey === refreshKeyVal) return;
        lastRefreshKey = refreshKeyVal as string;

        if (swapTimer) {
          clearTimeout(swapTimer);
          swapTimer = null;
        }

        if (openVal) {
          pendingView = {
            key: refreshKeyVal as string,
            payload: nextVal as View,
          };
          isExpanded.value = false;
          swapTimer = window.setTimeout(() => {
            swapTimer = null;
            if (!pendingView) return;
            view.value = pendingView.payload;
            applied.value = pendingView.key;
            pendingView = null;
          }, SWAP_COLLAPSE_MS);
        } else {
          pendingView = null;
          view.value = nextVal as View;
          applied.value = refreshKeyVal as string;
        }
      }
    );

    /* ----------------------------- Auto Expand/Collapse ------------------- */

    watch(
      [
        () => props.autoCollapseDelayMs,
        () => props.autoExpandDelayMs,
        hasDesc,
        allowExpand,
        () => props.exiting,
        applied,
      ],
      () => {
        if (autoExpandTimer) clearTimeout(autoExpandTimer);
        if (autoCollapseTimer) clearTimeout(autoCollapseTimer);

        if (!hasDesc.value || !window) return;

        if (props.exiting || !allowExpand.value) {
          isExpanded.value = false;
          return;
        }

        if (
          props.autoExpandDelayMs == null &&
          props.autoCollapseDelayMs == null
        )
          return;

        const expandDelay = props.autoExpandDelayMs ?? 0;
        const collapseDelay = props.autoCollapseDelayMs ?? 0;

        if (expandDelay > 0) {
          autoExpandTimer = window.setTimeout(() => {
            isExpanded.value = true;
          }, expandDelay);
        } else {
          isExpanded.value = true;
        }

        if (collapseDelay > 0) {
          autoCollapseTimer = window.setTimeout(() => {
            isExpanded.value = false;
          }, collapseDelay);
        }
      },
      { immediate: true }
    );

    /* ------------------------------- Swipe -------------------------------- */

    const SWIPE_DISMISS = 30;
    const SWIPE_MAX = 20;

    const setupSwipe = () => {
      const el = buttonRef.value;
      if (!el) return;

      const onMove = (e: PointerEvent) => {
        if (pointerStartY === null) return;
        const dy = e.clientY - pointerStartY;
        const sign = dy > 0 ? 1 : -1;
        const clamped = Math.min(Math.abs(dy), SWIPE_MAX) * sign;
        el.style.transform = `translateY(${clamped}px)`;
      };

      const onUp = (e: PointerEvent) => {
        if (pointerStartY === null) return;
        const dy = e.clientY - pointerStartY;
        pointerStartY = null;
        el.style.transform = "";
        if (Math.abs(dy) > SWIPE_DISMISS) {
          props.onDismiss?.();
        }
      };

      el.addEventListener("pointermove", onMove, { passive: true });
      el.addEventListener("pointerup", onUp, { passive: true });
    };

    /* ------------------------------- Handlers ----------------------------- */

    const handleEnter = (e: MouseEvent) => {
      props.onMouseEnter?.(e);
      if (hasDesc.value) isExpanded.value = true;
    };

    const handleLeave = (e: MouseEvent) => {
      props.onMouseLeave?.(e);
      isExpanded.value = false;
    };

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "height" && e.propertyName !== "transform") return;
      if (open.value) return;
      if (!pendingView) return;
      if (swapTimer) {
        clearTimeout(swapTimer);
        swapTimer = null;
      }
      view.value = pendingView.payload;
      applied.value = pendingView.key;
      pendingView = null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (props.exiting || !props.onDismiss) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-sileo-button]")) return;
      pointerStartY = e.clientY;
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    };

    /* ------------------------------- Lifecycle ---------------------------- */

    onMounted(() => {
      requestAnimationFrame(() => {
        ready.value = true;
      });
      setupPillObserver();
      setupContentObserver();
      setupSwipe();
    });

    onUnmounted(() => {
      if (pillRo) {
        cancelAnimationFrame(pillRafId);
        pillRo.disconnect();
      }
      if (contentRo) {
        cancelAnimationFrame(contentRafId);
        contentRo.disconnect();
      }
      if (headerExitTimer) clearTimeout(headerExitTimer);
      if (autoExpandTimer) clearTimeout(autoExpandTimer);
      if (autoCollapseTimer) clearTimeout(autoCollapseTimer);
      if (swapTimer) clearTimeout(swapTimer);
    });

    /* -------------------------------- Render ------------------------------ */

    return () => {
      const viewVal = view.value;
      const headerLayerVal = headerLayer.value;
      const openVal = open.value;

      const currentIcon = (headerLayerVal.current.view.icon ??
        STATE_ICON[headerLayerVal.current.view.state]()) as VNodeChild;

      const headerContent: VNode[] = [
        h(
          "div",
          {
            ref: innerRef,
            key: headerLayerVal.current.key,
            "data-sileo-header-inner": "",
            "data-layer": "current",
          },
          [
            h(
              "div",
              {
                "data-sileo-badge": "",
                "data-state": headerLayerVal.current.view.state,
                class: headerLayerVal.current.view.styles?.badge,
              },
              [currentIcon]
            ),
            h(
              "span",
              {
                "data-sileo-title": "",
                "data-state": headerLayerVal.current.view.state,
                class: headerLayerVal.current.view.styles?.title,
              },
              headerLayerVal.current.view.title
            ),
          ]
        ),
      ];

      if (headerLayerVal.prev) {
        const prevIcon = (headerLayerVal.prev.view.icon ??
          STATE_ICON[headerLayerVal.prev.view.state]()) as VNodeChild;

        headerContent.push(
          h(
            "div",
            {
              key: headerLayerVal.prev.key,
              "data-sileo-header-inner": "",
              "data-layer": "prev",
              "data-exiting": "true",
            },
            [
              h(
                "div",
                {
                  "data-sileo-badge": "",
                  "data-state": headerLayerVal.prev.view.state,
                  class: headerLayerVal.prev.view.styles?.badge,
                },
                [prevIcon]
              ),
              h(
                "span",
                {
                  "data-sileo-title": "",
                  "data-state": headerLayerVal.prev.view.state,
                  class: headerLayerVal.prev.view.styles?.title,
                },
                headerLayerVal.prev.view.title
              ),
            ]
          )
        );
      }

      const children: VNode[] = [
        h("div", { "data-sileo-canvas": "", "data-edge": props.expand }, [
          h(
            "svg",
            {
              "data-sileo-svg": "",
              width: WIDTH,
              height: svgHeight.value,
              viewBox: `0 0 ${WIDTH} ${svgHeight.value}`,
            },
            [
              h("title", null, "Sileo Notification"),
              GooeyDefs(filterId.value, blur.value),
              h("g", { filter: `url(#${filterId.value})` }, [
                h("rect", {
                  "data-sileo-pill": "",
                  x: pillX.value,
                  rx: resolvedRoundness.value,
                  ry: resolvedRoundness.value,
                  fill: viewVal.fill,
                }),
                h("rect", {
                  "data-sileo-body": "",
                  y: HEIGHT,
                  width: WIDTH,
                  height: expandedContent.value,
                  rx: resolvedRoundness.value,
                  ry: resolvedRoundness.value,
                  fill: viewVal.fill,
                }),
              ]),
            ]
          ),
        ]),

        h(
          "div",
          {
            ref: headerRef,
            "data-sileo-header": "",
            "data-edge": props.expand,
          },
          [h("div", { "data-sileo-header-stack": "" }, headerContent)]
        ),
      ];

      if (hasDesc.value) {
        const descChildren: VNodeChild[] = [];

        if (viewVal.description != null) {
          descChildren.push(viewVal.description as VNodeChild);
        }

        if (viewVal.button) {
          descChildren.push(
            h(
              "a",
              {
                href: "#",
                type: "button",
                "data-sileo-button": "",
                "data-state": viewVal.state,
                class: viewVal.styles?.button,
                onClick: (e: Event) => {
                  e.preventDefault();
                  e.stopPropagation();
                  viewVal.button?.onClick();
                },
              },
              viewVal.button.title
            )
          );
        }

        children.push(
          h(
            "div",
            {
              "data-sileo-content": "",
              "data-edge": props.expand,
              "data-visible": openVal,
            },
            [
              h(
                "div",
                {
                  ref: contentRef,
                  "data-sileo-description": "",
                  class: viewVal.styles?.description,
                },
                descChildren
              ),
            ]
          )
        );
      }

      return h(
        "button",
        {
          ref: buttonRef,
          type: "button",
          "data-sileo-toast": "",
          "data-ready": ready.value,
          "data-expanded": openVal,
          "data-exiting": props.exiting,
          "data-edge": props.expand,
          "data-position": props.position,
          "data-state": viewVal.state,
          class: props.className,
          style: rootStyle.value,
          onMouseenter: handleEnter,
          onMouseleave: handleLeave,
          onTransitionend: handleTransitionEnd,
          onPointerdown: handlePointerDown,
        },
        children
      );
    };
  },
});
