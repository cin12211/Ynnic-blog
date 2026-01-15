---
title: "Vue but underthehood: Part 2 - The Language Engine"
description: Discovering how TypeScript powers Vue 3's type system and enhances the developer experience.
date: 2026-01-16
tags:
  - vue
  - typescript
---

## Introduction

Welcome back to "Vue but underthehood"! In [Part 1](/blog/vue-underthehood-01-proxy-foundation/), we explored how Vue 3 uses JavaScript Proxies as its reactive foundation. Now, let's dive into **The Language Engine** - how TypeScript integrates with Vue to provide excellent type safety and developer experience.

## Vue 3's TypeScript-First Approach

Unlike Vue 2, which was written in JavaScript and had TypeScript definitions added later, Vue 3 was rewritten from the ground up in TypeScript. This fundamental shift brings numerous benefits:

- **Better type inference** for component props, emits, and refs
- **Improved IDE support** with autocomplete and error checking
- **Self-documenting code** through type annotations
- **Safer refactoring** with compile-time error detection

## Type-Safe Component Props

Vue 3 provides excellent type inference for component props using TypeScript:

```typescript
import { defineComponent, PropType } from "vue";

interface User {
	id: number;
	name: string;
	email: string;
}

export default defineComponent({
	props: {
		user: {
			type: Object as PropType<User>,
			required: true,
		},
		count: {
			type: Number,
			default: 0,
		},
	},
	setup(props) {
		// props.user is typed as User
		// props.count is typed as number
		console.log(props.user.name); // ✅ Type-safe!
	},
});
```

## Script Setup and Type Inference

The `<script setup>` syntax provides even better type inference with less boilerplate:

```typescript
<script setup lang="ts">
import { ref, computed } from 'vue';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const props = defineProps<{
  initialTodos: Todo[];
  maxCount?: number;
}>();

const todos = ref<Todo[]>(props.initialTodos);

const completedTodos = computed(() =>
  todos.value.filter(todo => todo.completed)
);

// Everything is fully typed!
</script>
```

## Generic Components

Vue 3.3+ introduces support for generic components, allowing for even more flexible typing:

```typescript
<script setup lang="ts" generic="T">
defineProps<{
  items: T[];
  selectedItem: T | null;
}>();

const emit = defineEmits<{
  select: [item: T];
  remove: [item: T];
}>();
</script>
```

## The Ref Type System

Understanding how Vue types refs is crucial:

```typescript
import { ref, Ref, unref } from "vue";

// Ref<number>
const count = ref(0);

// Ref<string | null>
const message = ref<string | null>(null);

// Type narrowing works!
if (message.value) {
	// message.value is typed as string here
	console.log(message.value.toUpperCase());
}

// unref utility for unwrapping
function useValue<T>(maybeRef: T | Ref<T>): T {
	return unref(maybeRef);
}
```

## Internal Type Utilities

Vue provides powerful internal type utilities that you can leverage:

```typescript
import type {
	ExtractPropTypes,
	ExtractPublicPropTypes,
	ComponentPublicInstance,
} from "vue";

const props = {
	name: String,
	age: Number,
	active: Boolean,
} as const;

// Extract the prop types
type Props = ExtractPropTypes<typeof props>;
// { name?: string; age?: number; active?: boolean }

type PublicProps = ExtractPublicPropTypes<typeof props>;
// For external usage
```

## Key Takeaways

- Vue 3 is written in TypeScript, providing first-class type support
- `defineComponent` and `<script setup>` offer excellent type inference
- Generic components enable flexible, reusable typed components
- Vue's type utilities help extract and work with component types
- The TypeScript integration enhances both DX and code safety

## What's Next?

In **Part 3: The Safety Valve**, we'll explore Vue's error handling mechanisms and how it gracefully handles failures at runtime.

---

_This is Part 2 of the "Vue but underthehood" series._
