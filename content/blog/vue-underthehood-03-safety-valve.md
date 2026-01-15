---
title: "Vue but underthehood: Part 3 - The Safety Valve"
description: Understanding Vue 3's error handling system and how it gracefully manages runtime failures.
date: 2026-01-17
tags:
  - vue
  - typescript
---

## Introduction

In previous parts, we explored [The Proxy Foundation](/blog/vue-underthehood-01-proxy-foundation/) and [The Language Engine](/blog/vue-underthehood-02-language-engine/). Now we'll examine **The Safety Valve** - Vue's sophisticated error handling system that keeps your application running even when things go wrong.

## The Error Handling Pipeline

Vue 3 implements a comprehensive error handling pipeline that captures errors at multiple levels:

```typescript
// Internal error handling flow
export function handleError(
	err: unknown,
	instance: ComponentInternalInstance | null,
	type: ErrorTypes
) {
	const contextVNode = instance ? instance.vnode : null;

	if (instance) {
		let cur = instance.parent;
		const exposedInstance = instance.proxy;
		const errorInfo = ErrorTypeStrings[type];

		// Traverse up the component tree
		while (cur) {
			const errorCapturedHooks = cur.ec;
			if (errorCapturedHooks) {
				for (let i = 0; i < errorCapturedHooks.length; i++) {
					if (
						errorCapturedHooks[i](err, exposedInstance, errorInfo) === false
					) {
						return;
					}
				}
			}
			cur = cur.parent;
		}
	}

	// If not handled, log to console
	logError(err, type, contextVNode);
}
```

## Error Types

Vue categorizes errors into different types for better debugging:

```typescript
export enum ErrorCodes {
	SETUP_FUNCTION,
	RENDER_FUNCTION,
	WATCH_CALLBACK,
	WATCH_CLEANUP,
	WATCH_GETTER,
	COMPONENT_EVENT_HANDLER,
	VNODE_HOOK,
	DIRECTIVE_HOOK,
	TRANSITION_HOOK,
	APP_ERROR_HANDLER,
	APP_WARN_HANDLER,
	FUNCTION_REF,
	ASYNC_COMPONENT_LOADER,
	SCHEDULER,
}

const ErrorTypeStrings: Record<number, string> = {
	[ErrorCodes.SETUP_FUNCTION]: "setup function",
	[ErrorCodes.RENDER_FUNCTION]: "render function",
	[ErrorCodes.WATCH_CALLBACK]: "watcher callback",
	// ... more mappings
};
```

## The onErrorCaptured Hook

Components can capture errors from child components using `onErrorCaptured`:

```typescript
<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';

const error = ref<Error | null>(null);

onErrorCaptured((err, instance, info) => {
  console.error('Error captured:', err);
  console.log('Component:', instance);
  console.log('Error info:', info);

  // Store error for display
  error.value = err as Error;

  // Return false to prevent propagation
  return false;
});
</script>

<template>
  <div>
    <ErrorDisplay v-if="error" :error="error" />
    <slot v-else />
  </div>
</template>
```

## Global Error Handler

You can set up a global error handler to catch all unhandled errors:

```typescript
import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);

app.config.errorHandler = (err, instance, info) => {
	// Send to error tracking service
	console.error("Global error:", err);
	console.log("Vue instance:", instance);
	console.log("Error info:", info);

	// Report to monitoring service
	reportError({
		error: err,
		component: instance?.$options.name,
		info,
	});
};

app.mount("#app");
```

## Error Boundaries Pattern

Create reusable error boundary components:

```typescript
<script setup lang="ts">
import { ref, onErrorCaptured, provide } from 'vue';

const error = ref<Error | null>(null);
const errorInfo = ref<string>('');

onErrorCaptured((err, instance, info) => {
  error.value = err as Error;
  errorInfo.value = info;
  return false; // Stop propagation
});

const reset = () => {
  error.value = null;
  errorInfo.value = '';
};

provide('resetError', reset);
</script>

<template>
  <div class="error-boundary">
    <div v-if="error" class="error-state">
      <h2>Something went wrong</h2>
      <pre>{{ error.message }}</pre>
      <p>Error occurred in: {{ errorInfo }}</p>
      <button @click="reset">Try Again</button>
    </div>
    <slot v-else />
  </div>
</template>
```

## Handling Async Errors

Vue also handles errors in async operations:

```typescript
import { onMounted, ref } from "vue";

const data = ref(null);

onMounted(async () => {
	try {
		// Vue will catch errors thrown here
		const response = await fetch("/api/data");
		data.value = await response.json();
	} catch (err) {
		// Manual error handling
		console.error("Failed to fetch data:", err);
	}
});
```

## Scheduler Queue Errors

Vue's scheduler also has error handling for batch updates:

```typescript
function flushJobs() {
	try {
		for (let i = 0; i < queue.length; i++) {
			const job = queue[i];
			if (job && job.active !== false) {
				callWithErrorHandling(job, null, ErrorCodes.SCHEDULER);
			}
		}
	} finally {
		// Cleanup even if errors occurred
		queue.length = 0;
		isFlushing = false;
	}
}
```

## Key Takeaways

- Vue provides a multi-layered error handling system
- Errors bubble up the component tree until caught
- `onErrorCaptured` allows components to handle child errors
- Global error handlers provide application-wide error management
- Error boundaries are a powerful pattern for fault tolerance
- Vue categorizes errors by type for better debugging

## What's Next?

In **Part 4: The Identity Crisis**, we'll explore Vue's key system and how it manages component and element identity for efficient updates.

---

_This is Part 3 of the "Vue but underthehood" series._
