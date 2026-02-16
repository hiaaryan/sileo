"use client";

import "../styles.css";

import type { ReactNode } from "react";
import { sileo as _sileo } from "../core/store";
import type { SileoAPI, SileoPromiseOptions as CoreSileoPromiseOptions } from "../core/store";
import type { SileoOptions as CoreSileoOptions } from "../core/types";

export const sileo = _sileo as unknown as SileoAPI<ReactNode>;

export { Toaster } from "./toaster";

export type SileoOptions = CoreSileoOptions<ReactNode>;
export type SileoPromiseOptions<T = unknown> = CoreSileoPromiseOptions<T, ReactNode>;

export type {
	SileoButton,
	SileoPosition,
	SileoState,
	SileoStyles,
} from "../core/types";
