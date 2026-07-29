import type { ReactNode } from "react";

export type SileoState =
	| "success"
	| "loading"
	| "error"
	| "warning"
	| "info"
	| "action";

export interface SileoStyles {
	title?: string;
	description?: string;
	badge?: string;
	button?: string;
}

/**
 * Visual weight of an action. `soft` is the default and matches the look
 * sileo has always shipped: a tinted pill in the toast's state colour.
 */
export type SileoButtonVariant = "soft" | "solid" | "outline" | "ghost";

export interface SileoButton {
	title: string;
	onClick: () => void;
	/** Visual weight. Defaults to `"soft"`. */
	variant?: SileoButtonVariant;
	/**
	 * Any CSS colour, overriding the toast's state colour for this action —
	 * e.g. a red `solid` confirm next to a neutral `ghost` cancel. The text
	 * colour of a `solid` button is derived from it automatically.
	 */
	color?: string;
}

export const SILEO_POSITIONS = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
] as const;

export type SileoPosition = (typeof SILEO_POSITIONS)[number];

export interface SileoOptions {
	title?: string;
	description?: ReactNode | string;
	type?: SileoState;
	position?: SileoPosition;
	duration?: number | null;
	icon?: ReactNode | null;
	styles?: SileoStyles;
	fill?: string;
	roundness?: number;
	autopilot?: boolean | { expand?: number; collapse?: number };
	/** Pass an array to render multiple actions side by side. */
	button?: SileoButton | SileoButton[];
}
