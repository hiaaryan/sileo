import type { ReactNode, SVGProps } from "react";

const Icon = ({
	title,
	children,
	...props
}: SVGProps<SVGSVGElement> & { title: string; children: ReactNode }) => (
	<svg
		{...props}
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<title>{title}</title>
		{children}
	</svg>
);

export const ArrowRight = () => (
	<Icon title="Arrow Right">
		<path d="M5 12h14" />
		<path d="m12 5 7 7-7 7" />
	</Icon>
);

export const LifeBuoy = () => (
	<Icon title="Life Buoy">
		<circle cx="12" cy="12" r="10" />
		<path d="m4.93 4.93 4.24 4.24" />
		<path d="m14.83 9.17 4.24-4.24" />
		<path d="m14.83 14.83 4.24 4.24" />
		<path d="m9.17 14.83-4.24 4.24" />
		<circle cx="12" cy="12" r="4" />
	</Icon>
);

export const LoaderCircle = (props: SVGProps<SVGSVGElement>) => (
	<Icon title="Loader Circle" {...props}>
		<path d="M21 12a9 9 0 1 1-6.219-8.56" />
	</Icon>
);

export const X = () => (
	<Icon title="X">
		<path d="M18 6 6 18" />
		<path d="m6 6 12 12" />
	</Icon>
);

export const CircleAlert = () => (
	<Icon title="Circle Alert">
		<circle cx="12" cy="12" r="10" />
		<line x1="12" x2="12" y1="8" y2="12" />
		<line x1="12" x2="12.01" y1="16" y2="16" />
	</Icon>
);

export const Check = () => (
	<Icon title="Check">
		<path d="M20 6 9 17l-5-5" />
	</Icon>
);
