---
title: "Vue but underthehood: Part 1 - The Proxy Foundation"
description: Exploring how Vue 3 leverages JavaScript Proxies to build its reactive system from the ground up.
date: 2026-01-15
tags:
  - vue
  - typescript
---

## Introduction

Welcome to the first part of "Vue but underthehood" - a deep dive into Vue 3's internal mechanisms. In this series, we'll explore how Vue 3 implements its powerful reactivity system using modern JavaScript features.

In this first installment, we'll examine **The Proxy Foundation** - the cornerstone of Vue 3's reactivity system.

## What are JavaScript Proxies?

JavaScript Proxies allow you to create a wrapper around an object that can intercept and redefine fundamental operations. This is exactly what Vue 3 uses to track dependencies and trigger updates.

```typescript
const target = { count: 0 };

const handler = {
	get(target, property, receiver) {
		console.log(`Getting ${property}`);
		return Reflect.get(target, property, receiver);
	},
	set(target, property, value, receiver) {
		console.log(`Setting ${property} to ${value}`);
		return Reflect.set(target, property, value, receiver);
	},
};

const proxy = new Proxy(target, handler);
```

## How Vue Uses Proxies

Vue 3's `reactive()` function creates a Proxy around your data objects. When you access or modify properties, Vue can:

1. **Track** which components are reading which properties (dependency collection)
2. **Trigger** updates when those properties change (effect execution)

```typescript
import { reactive, effect } from "vue";

const state = reactive({ count: 0 });

effect(() => {
	console.log(`Count is: ${state.count}`);
});

// This will trigger the effect
state.count++;
```

## The ReactiveHandler

At the heart of Vue's reactivity is the `ReactiveHandler` - a set of trap functions that intercept operations:

```typescript
class ReactiveHandler implements ProxyHandler<Target> {
	get(target: Target, key: string | symbol, receiver: object) {
		// Track dependency
		track(target, TrackOpTypes.GET, key);
		const res = Reflect.get(target, key, receiver);
		return res;
	}

	set(target: Target, key: string | symbol, value: unknown, receiver: object) {
		const oldValue = target[key];
		const result = Reflect.set(target, key, value, receiver);
		// Trigger effects if value changed
		if (oldValue !== value) {
			trigger(target, TriggerOpTypes.SET, key, value, oldValue);
		}
		return result;
	}
}
```

## Key Takeaways

- Vue 3 uses JavaScript Proxies as the foundation of its reactivity system
- Proxies allow Vue to intercept property access and modification
- The `get` trap enables dependency tracking
- The `set` trap enables effect triggering
- This approach is more powerful and performant than Vue 2's `Object.defineProperty`

## What's Next?

In **Part 2: The Language Engine**, we'll explore how TypeScript enhances Vue's development experience and how Vue's type system works internally.

---

_This is Part 1 of the "Vue but underthehood" series. Stay tuned for more deep dives into Vue's internal mechanisms!_
