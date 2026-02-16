import type { SileoOptions, SileoPosition, SileoState } from "./types";

/* -------------------------------- Constants ------------------------------- */

export const DEFAULT_DURATION = 6000;
export const EXIT_DURATION = DEFAULT_DURATION * 0.1;
const AUTO_EXPAND_DELAY = DEFAULT_DURATION * 0.025;
const AUTO_COLLAPSE_DELAY = DEFAULT_DURATION - 2000;

export const pillAlign = (pos: SileoPosition) =>
	pos.includes("right") ? "right" : pos.includes("center") ? "center" : "left";
export const expandDir = (pos: SileoPosition) =>
	pos.startsWith("top") ? ("bottom" as const) : ("top" as const);

/* ---------------------------------- Types --------------------------------- */

export interface InternalSileoOptions extends SileoOptions {
	id?: string;
	state?: SileoState;
}

export interface SileoItem extends InternalSileoOptions {
	id: string;
	instanceId: string;
	exiting?: boolean;
	autoExpandDelayMs?: number;
	autoCollapseDelayMs?: number;
}

/* ------------------------------ Global State ------------------------------ */

export type SileoListener = (toasts: SileoItem[]) => void;

export const store = {
	toasts: [] as SileoItem[],
	listeners: new Set<SileoListener>(),
	position: "top-right" as SileoPosition,
	options: undefined as Partial<SileoOptions> | undefined,

	emit() {
		for (const fn of this.listeners) fn(this.toasts);
	},

	update(fn: (prev: SileoItem[]) => SileoItem[]) {
		this.toasts = fn(this.toasts);
		this.emit();
	},
};

let idCounter = 0;
const generateId = () =>
	`${++idCounter}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const timeoutKey = (t: SileoItem) => `${t.id}:${t.instanceId}`;

/* ------------------------------- Toast API -------------------------------- */

export const dismissToast = (id: string) => {
	const item = store.toasts.find((t) => t.id === id);
	if (!item || item.exiting) return;

	store.update((prev) =>
		prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
	);

	setTimeout(
		() => store.update((prev) => prev.filter((t) => t.id !== id)),
		EXIT_DURATION,
	);
};

const resolveAutopilot = (
	opts: InternalSileoOptions,
	duration: number | null,
): { expandDelayMs?: number; collapseDelayMs?: number } => {
	if (opts.autopilot === false || !duration || duration <= 0) return {};
	const cfg = typeof opts.autopilot === "object" ? opts.autopilot : undefined;
	const clamp = (v: number) => Math.min(duration, Math.max(0, v));
	return {
		expandDelayMs: clamp(cfg?.expand ?? AUTO_EXPAND_DELAY),
		collapseDelayMs: clamp(cfg?.collapse ?? AUTO_COLLAPSE_DELAY),
	};
};

const mergeOptions = (options: InternalSileoOptions) => ({
	...store.options,
	...options,
	styles: { ...store.options?.styles, ...options.styles },
});

const buildSileoItem = (
	merged: InternalSileoOptions,
	id: string,
	fallbackPosition?: SileoPosition,
): SileoItem => {
	const duration = merged.duration ?? DEFAULT_DURATION;
	const auto = resolveAutopilot(merged, duration);
	return {
		...merged,
		id,
		instanceId: generateId(),
		position: merged.position ?? fallbackPosition ?? store.position,
		autoExpandDelayMs: auto.expandDelayMs,
		autoCollapseDelayMs: auto.collapseDelayMs,
	};
};

const createToast = (options: InternalSileoOptions) => {
	const live = store.toasts.filter((t) => !t.exiting);
	const merged = mergeOptions(options);

	const id = merged.id ?? "sileo-default";
	const prev = live.find((t) => t.id === id);
	const item = buildSileoItem(merged, id, prev?.position);

	if (prev) {
		store.update((p) => p.map((t) => (t.id === id ? item : t)));
	} else {
		store.update((p) => [...p.filter((t) => t.id !== id), item]);
	}
	return { id, duration: merged.duration ?? DEFAULT_DURATION };
};

const updateToast = (id: string, options: InternalSileoOptions) => {
	const existing = store.toasts.find((t) => t.id === id);
	if (!existing) return;

	const item = buildSileoItem(mergeOptions(options), id, existing.position);
	store.update((prev) => prev.map((t) => (t.id === id ? item : t)));
};

/* ----------------------------- Public API Types --------------------------- */

export interface SileoPromiseOptions<T = unknown, Renderable = unknown> {
	loading: Pick<SileoOptions<Renderable>, "title" | "icon">;
	success: SileoOptions<Renderable> | ((data: T) => SileoOptions<Renderable>);
	error: SileoOptions<Renderable> | ((err: unknown) => SileoOptions<Renderable>);
	action?: SileoOptions<Renderable> | ((data: T) => SileoOptions<Renderable>);
	position?: SileoPosition;
}

export interface SileoAPI<Renderable = unknown> {
	show(opts: SileoOptions<Renderable>): string;
	success(opts: SileoOptions<Renderable>): string;
	error(opts: SileoOptions<Renderable>): string;
	warning(opts: SileoOptions<Renderable>): string;
	info(opts: SileoOptions<Renderable>): string;
	action(opts: SileoOptions<Renderable>): string;
	promise<T>(
		promise: Promise<T> | (() => Promise<T>),
		opts: SileoPromiseOptions<T, Renderable>,
	): Promise<T>;
	dismiss(id: string): void;
	clear(position?: SileoPosition): void;
}

/* ----------------------------- API Singleton ------------------------------ */

export const sileo: SileoAPI = {
	show: (opts) => createToast(opts).id,
	success: (opts) => createToast({ ...opts, state: "success" }).id,
	error: (opts) => createToast({ ...opts, state: "error" }).id,
	warning: (opts) => createToast({ ...opts, state: "warning" }).id,
	info: (opts) => createToast({ ...opts, state: "info" }).id,
	action: (opts) => createToast({ ...opts, state: "action" }).id,

	promise: <T,>(
		promise: Promise<T> | (() => Promise<T>),
		opts: SileoPromiseOptions<T>,
	): Promise<T> => {
		const { id } = createToast({
			...opts.loading,
			state: "loading",
			duration: null,
			position: opts.position,
		});

		const p = typeof promise === "function" ? promise() : promise;

		p.then((data) => {
			if (opts.action) {
				const actionOpts =
					typeof opts.action === "function" ? opts.action(data) : opts.action;
				updateToast(id, { ...actionOpts, state: "action", id });
			} else {
				const successOpts =
					typeof opts.success === "function"
						? opts.success(data)
						: opts.success;
				updateToast(id, { ...successOpts, state: "success", id });
			}
		}).catch((err) => {
			const errorOpts =
				typeof opts.error === "function" ? opts.error(err) : opts.error;
			updateToast(id, { ...errorOpts, state: "error", id });
		});

		return p;
	},

	dismiss: dismissToast,

	clear: (position?: SileoPosition) =>
		store.update((prev) =>
			position ? prev.filter((t) => t.position !== position) : [],
		),
};
