import "../styles.css";

import type { VNode } from "vue";
import { sileo as _sileo } from "../core/store";
import type {
	SileoAPI,
	SileoPromiseOptions as CoreSileoPromiseOptions,
} from "../core/store";
import type { SileoOptions as CoreSileoOptions } from "../core/types";

export const sileo = _sileo as unknown as SileoAPI<VNode>;

export { Toaster } from "./toaster";

export type SileoOptions = CoreSileoOptions<VNode>;
export type SileoPromiseOptions<T = unknown> = CoreSileoPromiseOptions<
	T,
	VNode
>;

export type {
	SileoButton,
	SileoPosition,
	SileoState,
	SileoStyles,
} from "../core/types";
