---
title: "Vue but underthehood: Part 5 - Reactive Realities"
description: The grand finale - understanding the complete reactivity system with refs, computed properties, watchers, and effect scheduling.
date: 2026-01-19
tags:
  - vue
  - typescript
---

## Introduction

Welcome to the final installment of "Vue but underthehood"! We've journeyed through [The Proxy Foundation](/blog/vue-underthehood-01-proxy-foundation/), [The Language Engine](/blog/vue-underthehood-02-language-engine/), [The Safety Valve](/blog/vue-underthehood-03-safety-valve/), and [The Identity Crisis](/blog/vue-underthehood-04-identity-crisis/). Now, let's explore **Reactive Realities** - the complete picture of Vue's reactivity system.

## The Reactivity Trinity

Vue's reactivity system consists of three core concepts:

1. **Reactive data** - The source of truth (Proxies from Part 1)
2. **Effects** - Functions that depend on reactive data
3. **Scheduler** - Coordinates when effects run

```typescript
// The core reactivity loop
reactive data → track dependencies → trigger effects → schedule updates → re-run effects
```

## The Dependency Tracking System

At the heart of Vue's reactivity is the dependency tracking system:

```typescript
type Dep = Set<ReactiveEffect> & {
	w?: number; // wasTracked
	n?: number; // newTracked
};

type KeyToDepMap = Map<any, Dep>;
const targetMap = new WeakMap<any, KeyToDepMap>();

export function track(target: object, type: TrackOpTypes, key: unknown) {
	if (shouldTrack && activeEffect) {
		let depsMap = targetMap.get(target);
		if (!depsMap) {
			targetMap.set(target, (depsMap = new Map()));
		}

		let dep = depsMap.get(key);
		if (!dep) {
			depsMap.set(key, (dep = new Set()));
		}

		trackEffects(dep);
	}
}

export function trigger(
	target: object,
	type: TriggerOpTypes,
	key?: unknown,
	newValue?: unknown,
	oldValue?: unknown
) {
	const depsMap = targetMap.get(target);
	if (!depsMap) return;

	let deps: (Dep | undefined)[] = [];

	// Collect all effects that need to run
	if (key !== void 0) {
		deps.push(depsMap.get(key));
	}

	// Trigger all collected effects
	const effects: ReactiveEffect[] = [];
	for (const dep of deps) {
		if (dep) {
			effects.push(...dep);
		}
	}

	triggerEffects(new Set(effects));
}
```

## The ReactiveEffect Class

Effects are the foundation of Vue's reactivity:

```typescript
export class ReactiveEffect<T = any> {
	active = true;
	deps: Dep[] = [];
	parent: ReactiveEffect | undefined = undefined;

	constructor(
		public fn: () => T,
		public scheduler: EffectScheduler | null = null,
		scope?: EffectScope
	) {
		recordEffectScope(this, scope);
	}

	run() {
		if (!this.active) {
			return this.fn();
		}

		let parent: ReactiveEffect | undefined = activeEffect;
		let lastShouldTrack = shouldTrack;

		while (parent) {
			if (parent === this) {
				return;
			}
			parent = parent.parent;
		}

		try {
			this.parent = activeEffect;
			activeEffect = this;
			shouldTrack = true;

			// Clean up old dependencies
			cleanupEffect(this);

			// Run the effect and collect new dependencies
			return this.fn();
		} finally {
			activeEffect = this.parent;
			shouldTrack = lastShouldTrack;
			this.parent = undefined;
		}
	}

	stop() {
		if (this.active) {
			cleanupEffect(this);
			this.active = false;
		}
	}
}
```

## Ref Implementation

Refs wrap primitive values to make them reactive:

```typescript
export interface Ref<T = any> {
	value: T;
	[RefSymbol]: true;
}

class RefImpl<T> {
	private _value: T;
	private _rawValue: T;
	public dep?: Dep = undefined;
	public readonly __v_isRef = true;

	constructor(value: T, public readonly __v_isShallow: boolean) {
		this._rawValue = __v_isShallow ? value : toRaw(value);
		this._value = __v_isShallow ? value : toReactive(value);
	}

	get value() {
		trackRefValue(this);
		return this._value;
	}

	set value(newVal) {
		newVal = this.__v_isShallow ? newVal : toRaw(newVal);
		if (hasChanged(newVal, this._rawValue)) {
			this._rawValue = newVal;
			this._value = this.__v_isShallow ? newVal : toReactive(newVal);
			triggerRefValue(this, newVal);
		}
	}
}

export function ref<T>(value: T): Ref<UnwrapRef<T>> {
	return createRef(value, false);
}
```

## Computed Implementation

Computed properties are cached effects:

```typescript
export class ComputedRefImpl<T> {
	public dep?: Dep = undefined;
	private _value!: T;
	public readonly effect: ReactiveEffect<T>;
	public readonly __v_isRef = true;
	public _dirty = true;

	constructor(
		getter: ComputedGetter<T>,
		private readonly _setter: ComputedSetter<T>,
		isReadonly: boolean
	) {
		this.effect = new ReactiveEffect(getter, () => {
			if (!this._dirty) {
				this._dirty = true;
				triggerRefValue(this);
			}
		});
	}

	get value() {
		// Track the computed as a dependency
		trackRefValue(this);

		// Only recompute if dirty
		if (this._dirty) {
			this._dirty = false;
			this._value = this.effect.run()!;
		}

		return this._value;
	}

	set value(newValue: T) {
		this._setter(newValue);
	}
}

export function computed<T>(
	getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
	let getter: ComputedGetter<T>;
	let setter: ComputedSetter<T>;

	if (isFunction(getterOrOptions)) {
		getter = getterOrOptions;
		setter = NOOP;
	} else {
		getter = getterOrOptions.get;
		setter = getterOrOptions.set;
	}

	return new ComputedRefImpl(getter, setter, isReadonly) as any;
}
```

## Watch Implementation

Watchers are effects with additional options:

```typescript
export function watch<T>(
	source: WatchSource<T> | WatchSource<T>[],
	cb: WatchCallback<T>,
	options?: WatchOptions
): WatchStopHandle {
	return doWatch(source, cb, options);
}

function doWatch(
	source: WatchSource | WatchSource[] | WatchEffect | object,
	cb: WatchCallback | null,
	{ immediate, deep, flush, onTrack, onTrigger }: WatchOptions = {}
): WatchStopHandle {
	let getter: () => any;

	// Normalize the source into a getter function
	if (isRef(source)) {
		getter = () => source.value;
	} else if (isReactive(source)) {
		getter = () => source;
		deep = true;
	} else if (isArray(source)) {
		getter = () =>
			source.map((s) => {
				if (isRef(s)) return s.value;
				if (isReactive(s)) return traverse(s);
				if (isFunction(s)) return s();
			});
	} else if (isFunction(source)) {
		getter = () => source();
	}

	let cleanup: () => void;
	const onCleanup: OnCleanup = (fn: () => void) => {
		cleanup = effect.onStop = () => {
			fn();
		};
	};

	let oldValue: any;

	const job: SchedulerJob = () => {
		if (!effect.active) return;

		if (cb) {
			const newValue = effect.run();
			if (deep || hasChanged(newValue, oldValue)) {
				if (cleanup) cleanup();
				cb(newValue, oldValue, onCleanup);
				oldValue = newValue;
			}
		} else {
			effect.run();
		}
	};

	// Create the effect
	const effect = new ReactiveEffect(getter, scheduler);

	// Initial run
	if (cb) {
		if (immediate) {
			job();
		} else {
			oldValue = effect.run();
		}
	} else {
		effect.run();
	}

	return () => {
		effect.stop();
	};
}
```

## The Scheduler

The scheduler coordinates when effects run:

```typescript
const queue: SchedulerJob[] = [];
let isFlushing = false;
let isFlushPending = false;

export function queueJob(job: SchedulerJob) {
	if (!queue.includes(job)) {
		queue.push(job);
		queueFlush();
	}
}

function queueFlush() {
	if (!isFlushing && !isFlushPending) {
		isFlushPending = true;
		nextTick(flushJobs);
	}
}

function flushJobs() {
	isFlushPending = false;
	isFlushing = true;

	// Sort jobs by id to ensure parent components update before children
	queue.sort((a, b) => getId(a) - getId(b));

	try {
		for (let i = 0; i < queue.length; i++) {
			const job = queue[i];
			if (job && job.active !== false) {
				callWithErrorHandling(job, null, ErrorCodes.SCHEDULER);
			}
		}
	} finally {
		queue.length = 0;
		isFlushing = false;
	}
}
```

## Putting It All Together

Here's how it all works in a real component:

```typescript
<script setup lang="ts">
import { ref, computed, watch, watchEffect } from 'vue';

// 1. Create reactive state (Proxy-based)
const count = ref(0);
const doubled = computed(() => count.value * 2);

// 2. Set up watchers (ReactiveEffects with schedulers)
watch(count, (newVal, oldVal) => {
  console.log(`Count changed from ${oldVal} to ${newVal}`);
});

watchEffect(() => {
  console.log(`Doubled: ${doubled.value}`);
});

// 3. Trigger updates
function increment() {
  count.value++; // Triggers deps → schedules effects → batches updates
}
</script>
```

## Key Takeaways

- Vue's reactivity system is built on effects, dependency tracking, and scheduling
- `ref` wraps primitives, tracking access via get/set
- `computed` creates cached effects that only recompute when dependencies change
- `watch` creates effects with fine-grained control and callbacks
- The scheduler batches and optimizes effect execution
- All reactive APIs (`ref`, `computed`, `watch`) are built on the same foundation
- Understanding this system helps debug reactivity issues and optimize performance

## Series Conclusion

Throughout this series, we've explored:

1. **The Proxy Foundation** - How Proxies enable reactivity
2. **The Language Engine** - TypeScript integration and type safety
3. **The Safety Valve** - Error handling and fault tolerance
4. **The Identity Crisis** - Key system and virtual DOM diffing
5. **Reactive Realities** - The complete reactivity system

You now have a deep understanding of Vue 3's internals! This knowledge will help you:

- Write more efficient Vue code
- Debug complex reactivity issues
- Make informed architectural decisions
- Contribute to Vue's ecosystem

Thank you for joining me on this journey into Vue's internals!

---

_This is the final part of the "Vue but underthehood" series. I hope you enjoyed the deep dive!_
