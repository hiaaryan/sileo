<div align="center">
  <h1>Sileo</h1>
  <p>An opinionated, physics-based toast component for React & Vue.</p>
  <p><a href="https://sileo.aaryan.design">Try Out</a> &nbsp; / &nbsp; <a href="https://sileo.aaryan.design/docs">Docs</a></p>
  <video src="https://github.com/user-attachments/assets/a292d310-9189-490a-9f9d-d0a1d09defce"></video>
</div>

### Installation

```bash
npm i sileo
```

### React

```tsx
import { sileo, Toaster } from "sileo";
import "sileo/styles.css";

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <YourApp />
    </>
  );
}

// Trigger toasts anywhere
sileo.success({ title: "Saved", description: "Your changes were saved." });
sileo.error({ title: "Error", description: "Something went wrong." });
```

### Vue

```vue
<script setup>
import { Toaster, sileo } from "sileo/vue";
import "sileo/styles.css";

function handleClick() {
  sileo.success({ title: "Saved", description: "Your changes were saved." });
}
</script>

<template>
  <Toaster position="top-right" />
  <button @click="handleClick">Show toast</button>
</template>
```

### API

The `sileo` API is identical across both frameworks:

```ts
sileo.show({ title: "Hello" });
sileo.success({ title: "Saved", description: "Your changes were saved." });
sileo.error({ title: "Error", description: "Something went wrong." });
sileo.warning({ title: "Warning", description: "Proceed with caution." });
sileo.info({ title: "Info", description: "Here's some information." });

// Promise-based
sileo.promise(fetchData(), {
  loading: { title: "Loading..." },
  success: (data) => ({ title: "Done", description: `Loaded ${data.length} items.` }),
  error: (err) => ({ title: "Failed", description: String(err) }),
});

// Dismiss & clear
sileo.dismiss(id);
sileo.clear();
```

### Toaster Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `position` | `"top-left" \| "top-center" \| "top-right" \| "bottom-left" \| "bottom-center" \| "bottom-right"` | `"top-right"` | Where toasts appear |
| `offset` | `number \| string \| { top?, right?, bottom?, left? }` | — | Viewport offset |
| `options` | `Partial<SileoOptions>` | — | Default options for all toasts |

For detailed docs, click here: https://sileo.aaryan.design
