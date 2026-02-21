import { sileo } from "./toast";
import type { ReactNode } from "react";
import type { SileoOptions } from "./types";

interface SonnerCompatOptions {
	description?: ReactNode | string;
	duration?: number | null;
	action?: { label: string; onClick: () => void };
	id?: string;
}

function mapOptions(
	msg: string | ReactNode,
	opts?: SonnerCompatOptions,
): SileoOptions & { id?: string } {
	const title = typeof msg === "string" ? msg : "Notification";
	const description = typeof msg !== "string" ? msg : opts?.description;
	return {
		title,
		description,
		duration:
			opts?.duration === Infinity
				? null
				: opts?.duration === undefined
					? undefined
					: opts.duration,
		button: opts?.action
			? { title: opts.action.label, onClick: opts.action.onClick }
			: undefined,
		id: opts?.id,
	};
}

type ToastFn = {
	(msg: string | ReactNode, opts?: SonnerCompatOptions): string;
	success: (msg: string | ReactNode, opts?: SonnerCompatOptions) => string;
	error: (msg: string | ReactNode, opts?: SonnerCompatOptions) => string;
	warning: (msg: string | ReactNode, opts?: SonnerCompatOptions) => string;
	info: (msg: string | ReactNode, opts?: SonnerCompatOptions) => string;
	dismiss: typeof sileo.dismiss;
	promise: typeof sileo.promise;
};

const _toast = (msg: string | ReactNode, opts?: SonnerCompatOptions) =>
	sileo.show(mapOptions(msg, opts));

export const toast: ToastFn = Object.assign(_toast, {
	success: (msg: string | ReactNode, opts?: SonnerCompatOptions) =>
		sileo.success(mapOptions(msg, opts)),
	error: (msg: string | ReactNode, opts?: SonnerCompatOptions) =>
		sileo.error(mapOptions(msg, opts)),
	warning: (msg: string | ReactNode, opts?: SonnerCompatOptions) =>
		sileo.warning(mapOptions(msg, opts)),
	info: (msg: string | ReactNode, opts?: SonnerCompatOptions) =>
		sileo.info(mapOptions(msg, opts)),
	dismiss: sileo.dismiss,
	promise: sileo.promise,
});
