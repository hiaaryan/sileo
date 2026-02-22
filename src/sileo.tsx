import { motion } from "motion/react";
import {
	type CSSProperties,
	type MouseEventHandler,
	memo,
	type ReactNode,
	type TransitionEventHandler,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	BLUR_RATIO,
	DEFAULT_ROUNDNESS,
	HEADER_EXIT_MS,
	HEIGHT,
	MIN_EXPAND_RATIO,
	PILL_PADDING,
	SPRING,
	SWAP_COLLAPSE_MS,
	WIDTH,
} from "./constants";
import {
	ArrowRight,
	Check,
	ChevronLeft,
	ChevronRight,
	CircleAlert,
	LifeBuoy,
	LoaderCircle,
	X,
} from "./icons";
import "./styles.css";
import type { SileoButton, SileoState, SileoStyles } from "./types";

type State = SileoState;

interface View {
	title?: string;
	description?: ReactNode | string;
	state: State;
	icon?: ReactNode | null;
	styles?: SileoStyles;
	button?: SileoButton;
	fill: string;
}

interface SileoProps {
	id: string;
	fill?: string;
	state?: State;
	title?: string;
	description?: ReactNode | string;
	position?: "left" | "center" | "right";
	expand?: "top" | "bottom";
	className?: string;
	icon?: ReactNode | null;
	styles?: SileoStyles;
	button?: SileoButton;
	roundness?: number;
	exiting?: boolean;
	autoExpandDelayMs?: number;
	autoCollapseDelayMs?: number;
	canExpand?: boolean;
	interruptKey?: string;
	refreshKey?: string;
	onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
	onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
	onDismiss?: () => void;
	navIndex?: number;
	navTotal?: number;
	onNavigate?: (dir: -1 | 1) => void;
}

/* ---------------------------------- Icons --------------------------------- */

const STATE_ICON: Record<State, ReactNode> = {
	success: <Check />,
	loading: <LoaderCircle data-sileo-icon="spin" aria-hidden="true" />,
	error: <X />,
	warning: <CircleAlert />,
	info: <LifeBuoy />,
	action: <ArrowRight />,
};

/* ----------------------------- Memoised Defs ------------------------------ */
const GooeyDefs = memo(function GooeyDefs({
	filterId,
	blur,
}: {
	filterId: string;
	blur: number;
}) {
	return (
		<defs>
			<filter
				id={filterId}
				x="-20%"
				y="-20%"
				width="140%"
				height="140%"
				colorInterpolationFilters="sRGB"
			>
				<feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
				<feColorMatrix
					in="blur"
					mode="matrix"
					values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
					result="goo"
				/>
				<feComposite in="SourceGraphic" in2="goo" operator="atop" />
			</filter>
		</defs>
	);
});

/* ------------------------------- Component -------------------------------- */

export const Sileo = memo(function Sileo({
	id,
	fill = "#FFFFFF",
	state = "success",
	title = state,
	description,
	position = "left",
	expand = "bottom",
	className,
	icon,
	styles,
	button,
	roundness,
	exiting = false,
	autoExpandDelayMs,
	autoCollapseDelayMs,
	canExpand,
	interruptKey,
	refreshKey,
	onMouseEnter,
	onMouseLeave,
	onDismiss,
	navIndex,
	navTotal,
	onNavigate,
}: SileoProps) {
	const next: View = useMemo(
		() => ({ title, description, state, icon, styles, button, fill }),
		[title, description, state, icon, styles, button, fill],
	);

	const [view, setView] = useState<View>(next);
	const [applied, setApplied] = useState(refreshKey);
	const [isExpanded, setIsExpanded] = useState(false);
	const [ready, setReady] = useState(false);
	const [pillWidth, setPillWidth] = useState(0);
	const [contentHeight, setContentHeight] = useState(0);
	const hasDesc = Boolean(view.description) || Boolean(view.button);
	const isLoading = view.state === "loading";
	const open = hasDesc && isExpanded && !isLoading;
	const allowExpand = isLoading
		? false
		: (canExpand ?? (!interruptKey || interruptKey === id));

	const headerKey = `${view.state}-${view.title}`;
	const filterId = `sileo-gooey-${id}`;
	const resolvedRoundness = Math.max(0, roundness ?? DEFAULT_ROUNDNESS);
	const blur = resolvedRoundness * BLUR_RATIO;

	const headerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const headerExitRef = useRef<number | null>(null);
	const autoExpandRef = useRef<number | null>(null);
	const autoCollapseRef = useRef<number | null>(null);
	const swapTimerRef = useRef<number | null>(null);
	const lastRefreshKeyRef = useRef(refreshKey);
	const pendingRef = useRef<{ key?: string; payload: View } | null>(null);
	const [headerLayer, setHeaderLayer] = useState<{
		current: { key: string; view: View };
		prev: { key: string; view: View } | null;
	}>({ current: { key: headerKey, view }, prev: null });

	/* ------------------------------ Measurements ------------------------------ */

	const innerRef = useRef<HTMLDivElement>(null);

	const headerPadRef = useRef<number | null>(null);

	const pillRoRef = useRef<ResizeObserver | null>(null);
	const pillRafRef = useRef(0);
	const pillObservedRef = useRef<Element | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: headerLayer.current.key is used to force a re-render
	useLayoutEffect(() => {
		const el = innerRef.current;
		const header = headerRef.current;
		if (!el || !header) return;
		if (headerPadRef.current === null) {
			const cs = getComputedStyle(header);
			headerPadRef.current =
				parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
		}
		const px = headerPadRef.current;
		const measure = () => {
			const w = el.scrollWidth + px + PILL_PADDING;
			if (w > PILL_PADDING) {
				setPillWidth((prev) => (prev === w ? prev : w));
			}
		};
		measure();

		if (!pillRoRef.current) {
			pillRoRef.current = new ResizeObserver(() => {
				cancelAnimationFrame(pillRafRef.current);
				pillRafRef.current = requestAnimationFrame(() => {
					const inner = innerRef.current;
					const pad = headerPadRef.current ?? 0;
					if (!inner) return;
					const w = inner.scrollWidth + pad + PILL_PADDING;
					if (w > PILL_PADDING) {
						setPillWidth((prev) => (prev === w ? prev : w));
					}
				});
			});
		}

		if (pillObservedRef.current !== el) {
			if (pillObservedRef.current) {
				pillRoRef.current.unobserve(pillObservedRef.current);
			}
			pillRoRef.current.observe(el);
			pillObservedRef.current = el;
		}
	}, [headerLayer.current.key]);

	useEffect(() => {
		return () => {
			cancelAnimationFrame(pillRafRef.current);
			pillRoRef.current?.disconnect();
		};
	}, []);

	useLayoutEffect(() => {
		if (!hasDesc) {
			setContentHeight(0);
			return;
		}
		const el = contentRef.current;
		if (!el) return;
		const measure = () => {
			const h = el.scrollHeight;
			setContentHeight((prev) => (prev === h ? prev : h));
		};
		measure();
		let rafId = 0;
		const ro = new ResizeObserver(() => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(measure);
		});
		ro.observe(el);
		return () => {
			cancelAnimationFrame(rafId);
			ro.disconnect();
		};
	}, [hasDesc]);

	useEffect(() => {
		const raf = requestAnimationFrame(() => setReady(true));
		return () => cancelAnimationFrame(raf);
	}, []);

	useLayoutEffect(() => {
		setHeaderLayer((state) => {
			if (state.current.key === headerKey) {
				if (state.current.view === view) return state;
				return { ...state, current: { key: headerKey, view } };
			}
			return {
				prev: state.current,
				current: { key: headerKey, view },
			};
		});
	}, [headerKey, view]);

	useEffect(() => {
		if (!headerLayer.prev) return;
		if (headerExitRef.current) {
			clearTimeout(headerExitRef.current);
		}
		headerExitRef.current = window.setTimeout(() => {
			headerExitRef.current = null;
			setHeaderLayer((state) => ({ ...state, prev: null }));
		}, HEADER_EXIT_MS);
		return () => {
			if (headerExitRef.current) {
				clearTimeout(headerExitRef.current);
				headerExitRef.current = null;
			}
		};
	}, [headerLayer.prev]);

	/* ----------------------------- Sync fill ---------------------------------- */

	useEffect(() => {
		setView((prev) => (prev.fill === fill ? prev : { ...prev, fill }));
	}, [fill]);

	/* ----------------------------- Refresh logic ------------------------------ */

	useEffect(() => {
		if (refreshKey === undefined) {
			setView(next);
			setApplied(undefined);
			pendingRef.current = null;
			lastRefreshKeyRef.current = refreshKey;
			return;
		}

		if (lastRefreshKeyRef.current === refreshKey) return;
		lastRefreshKeyRef.current = refreshKey;

		if (swapTimerRef.current) {
			clearTimeout(swapTimerRef.current);
			swapTimerRef.current = null;
		}

		if (open) {
			pendingRef.current = { key: refreshKey, payload: next };
			setIsExpanded(false);
			swapTimerRef.current = window.setTimeout(() => {
				swapTimerRef.current = null;
				const pending = pendingRef.current;
				if (!pending) return;
				setView(pending.payload);
				setApplied(pending.key);
				pendingRef.current = null;
			}, SWAP_COLLAPSE_MS);
		} else {
			pendingRef.current = null;
			setView(next);
			setApplied(refreshKey);
		}
	}, [open, refreshKey, next]);

	/* ----------------------------- Auto expand/collapse ----------------------- */

	// biome-ignore lint/correctness/useExhaustiveDependencies: applied is used to force a re-render
	useEffect(() => {
		if (!hasDesc) return;

		if (autoExpandRef.current) clearTimeout(autoExpandRef.current);
		if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);

		if (exiting || !allowExpand) {
			setIsExpanded(false);
			return;
		}

		if (autoExpandDelayMs == null && autoCollapseDelayMs == null) return;

		const expandDelay = autoExpandDelayMs ?? 0;
		const collapseDelay = autoCollapseDelayMs ?? 0;

		if (expandDelay > 0) {
			autoExpandRef.current = window.setTimeout(
				() => setIsExpanded(true),
				expandDelay,
			);
		} else {
			setIsExpanded(true);
		}

		if (collapseDelay > 0) {
			autoCollapseRef.current = window.setTimeout(
				() => setIsExpanded(false),
				collapseDelay,
			);
		}

		return () => {
			if (autoExpandRef.current) clearTimeout(autoExpandRef.current);
			if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);
		};
	}, [
		autoCollapseDelayMs,
		autoExpandDelayMs,
		hasDesc,
		allowExpand,
		exiting,
		applied,
	]);

	/* ------------------------------ Derived values ---------------------------- */

	const showNav = navTotal !== undefined && navTotal > 1;

	const minExpanded = HEIGHT * MIN_EXPAND_RATIO;
	const rawExpanded = hasDesc
		? Math.max(minExpanded, HEIGHT + contentHeight)
		: minExpanded;

	const frozenExpandedRef = useRef(rawExpanded);
	if (open) {
		frozenExpandedRef.current = rawExpanded;
	}

	const expanded = open ? rawExpanded : frozenExpandedRef.current;
	const svgHeight = hasDesc ? Math.max(expanded, minExpanded) : HEIGHT;
	const expandedContent = Math.max(0, expanded - HEIGHT);
	const navExtra = showNav ? 50 : 0;
	const resolvedPillWidth = Math.max(pillWidth || HEIGHT, HEIGHT) + navExtra;
	const pillHeight = HEIGHT + blur * 3;

	const pillX =
		position === "right"
			? WIDTH - resolvedPillWidth
			: position === "center"
				? (WIDTH - resolvedPillWidth) / 2
				: 0;

	/* ------------------------------- Memoised animate targets ----------------- */

	const pillAnimate = useMemo(
		() => ({
			x: pillX,
			width: resolvedPillWidth,
			height: open ? pillHeight : HEIGHT,
		}),
		[pillX, resolvedPillWidth, open, pillHeight],
	);

	const bodyAnimate = useMemo(
		() => ({
			height: open ? expandedContent : 0,
			opacity: open ? 1 : 0,
		}),
		[open, expandedContent],
	);

	const bodyTransition = useMemo(
		() => (open ? SPRING : { ...SPRING, bounce: 0 }),
		[open],
	);

	const pillTransition = useMemo(
		() => (ready ? SPRING : { duration: 0 }),
		[ready],
	);

	const viewBox = `0 0 ${WIDTH} ${svgHeight}`;

	const canvasStyle = useMemo<CSSProperties>(
		() => ({ filter: `url(#${filterId})` }),
		[filterId],
	);

	/* ------------------------------- Inline styles ---------------------------- */

	const rootStyle = useMemo<CSSProperties & Record<string, string>>(
		() => ({
			"--_h": `${open ? expanded : HEIGHT}px`,
			"--_pw": `${resolvedPillWidth}px`,
			"--_px": `${pillX}px`,
			"--_ht": `translateY(${open ? (expand === "bottom" ? 3 : -3) : 0}px) scale(${open ? 0.9 : 1})`,
			"--_co": `${open ? 1 : 0}`,
		}),
		[open, expanded, resolvedPillWidth, pillX, expand],
	);

	/* -------------------------------- Handlers -------------------------------- */

	const handleEnter: MouseEventHandler<HTMLButtonElement> = useCallback(
		(e) => {
			onMouseEnter?.(e);
			if (hasDesc) setIsExpanded(true);
		},
		[hasDesc, onMouseEnter],
	);

	const handleLeave: MouseEventHandler<HTMLButtonElement> = useCallback(
		(e) => {
			onMouseLeave?.(e);
			setIsExpanded(false);
		},
		[onMouseLeave],
	);

	const handleTransitionEnd: TransitionEventHandler<HTMLButtonElement> =
		useCallback(
			(e) => {
				if (e.propertyName !== "height" && e.propertyName !== "transform")
					return;
				if (open) return;
				const pending = pendingRef.current;
				if (!pending) return;
				if (swapTimerRef.current) {
					clearTimeout(swapTimerRef.current);
					swapTimerRef.current = null;
				}
				setView(pending.payload);
				setApplied(pending.key);
				pendingRef.current = null;
			},
			[open],
		);

	/* -------------------------------- Swipe ----------------------------------- */

	const SWIPE_DISMISS = 30;
	const SWIPE_MAX = 20;
	const buttonRef = useRef<HTMLButtonElement>(null);
	const pointerStartRef = useRef<number | null>(null);
	const onDismissRef = useRef(onDismiss);
	onDismissRef.current = onDismiss;

	const swipeHandlersRef = useRef<{
		onMove: (e: PointerEvent) => void;
		onUp: (e: PointerEvent) => void;
	} | null>(null);

	if (!swipeHandlersRef.current) {
		const handlers = {
			onMove: (e: PointerEvent) => {
				const el = buttonRef.current;
				if (pointerStartRef.current === null || !el) return;
				const dy = e.clientY - pointerStartRef.current;
				const sign = dy > 0 ? 1 : -1;
				const clamped = Math.min(Math.abs(dy), SWIPE_MAX) * sign;
				el.style.transform = `translateY(${clamped}px)`;
			},
			onUp: (e: PointerEvent) => {
				const el = buttonRef.current;
				if (pointerStartRef.current === null || !el) return;
				const dy = e.clientY - pointerStartRef.current;
				pointerStartRef.current = null;
				el.style.transform = "";
				el.removeEventListener("pointermove", handlers.onMove);
				el.removeEventListener("pointerup", handlers.onUp);
				if (Math.abs(dy) > SWIPE_DISMISS) {
					onDismissRef.current?.();
				}
			},
		};
		swipeHandlersRef.current = handlers;
	}

	const handleButtonClick = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			view.button?.onClick();
		},
		[view.button],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			if (exiting || !onDismiss) return;
			const target = e.target as HTMLElement;
			if (target.closest("[data-sileo-button]")) return;
			if (target.closest("[data-sileo-nav]")) return;
			pointerStartRef.current = e.clientY;
			e.currentTarget.setPointerCapture(e.pointerId);
			const el = buttonRef.current;
			const h = swipeHandlersRef.current;
			if (el && h) {
				el.addEventListener("pointermove", h.onMove, { passive: true });
				el.addEventListener("pointerup", h.onUp, { passive: true });
			}
		},
		[exiting, onDismiss],
	);

	/* --------------------------------- Render --------------------------------- */

	return (
		<button
			ref={buttonRef}
			type="button"
			data-sileo-toast
			data-ready={ready}
			data-expanded={open}
			data-exiting={exiting}
			data-edge={expand}
			data-position={position}
			data-state={view.state}
			className={className}
			style={rootStyle}
			onMouseEnter={handleEnter}
			onMouseLeave={handleLeave}
			onTransitionEnd={handleTransitionEnd}
			onPointerDown={handlePointerDown}
		>
			<div data-sileo-canvas data-edge={expand} style={canvasStyle}>
				<svg data-sileo-svg width={WIDTH} height={svgHeight} viewBox={viewBox}>
					<title>Sileo Notification</title>
					<GooeyDefs filterId={filterId} blur={blur} />
					<motion.rect
						data-sileo-pill
						rx={resolvedRoundness}
						ry={resolvedRoundness}
						fill={view.fill}
						initial={false}
						animate={pillAnimate}
						transition={pillTransition}
					/>
					<motion.rect
						data-sileo-body
						y={HEIGHT}
						width={WIDTH}
						rx={resolvedRoundness}
						ry={resolvedRoundness}
						fill={view.fill}
						initial={false}
						animate={bodyAnimate}
						transition={bodyTransition}
					/>
				</svg>
			</div>

			<div ref={headerRef} data-sileo-header data-edge={expand}>
				<div data-sileo-header-stack>
					<div
						ref={innerRef}
						key={headerLayer.current.key}
						data-sileo-header-inner
						data-layer="current"
					>
						<div
							data-sileo-badge
							data-state={headerLayer.current.view.state}
							className={headerLayer.current.view.styles?.badge}
						>
							{headerLayer.current.view.icon ??
								STATE_ICON[headerLayer.current.view.state]}
						</div>
						<span
							data-sileo-title
							data-state={headerLayer.current.view.state}
							className={headerLayer.current.view.styles?.title}
						>
							{headerLayer.current.view.title}
						</span>
					</div>
					{headerLayer.prev && (
						<div
							key={headerLayer.prev.key}
							data-sileo-header-inner
							data-layer="prev"
							data-exiting="true"
						>
							<div
								data-sileo-badge
								data-state={headerLayer.prev.view.state}
								className={headerLayer.prev.view.styles?.badge}
							>
								{headerLayer.prev.view.icon ??
									STATE_ICON[headerLayer.prev.view.state]}
							</div>
							<span
								data-sileo-title
								data-state={headerLayer.prev.view.state}
								className={headerLayer.prev.view.styles?.title}
							>
								{headerLayer.prev.view.title}
							</span>
						</div>
					)}
				</div>
				{showNav && (
					<div data-sileo-nav>
						<button
							type="button"
							onClick={() => onNavigate?.(-1)}
							disabled={navIndex === 0}
							aria-label="Previous notification"
						>
							<ChevronLeft />
						</button>
						<button
							type="button"
							onClick={() => onNavigate?.(1)}
							disabled={
								navIndex !== undefined &&
								navTotal !== undefined &&
								navIndex >= navTotal - 1
							}
							aria-label="Next notification"
						>
							<ChevronRight />
						</button>
					</div>
				)}
			</div>

			{hasDesc && (
				<div data-sileo-content data-edge={expand} data-visible={open}>
					<div
						ref={contentRef}
						data-sileo-description
						className={view.styles?.description}
					>
						{view.description}
						{view.button && (
							// biome-ignore lint/a11y/useValidAnchor: cannot use button inside a button
							<a
								href="#"
								type="button"
								data-sileo-button
								data-state={view.state}
								className={view.styles?.button}
								onClick={handleButtonClick}
							>
								{view.button.title}
							</a>
						)}
					</div>
				</div>
			)}
		</button>
	);
});
