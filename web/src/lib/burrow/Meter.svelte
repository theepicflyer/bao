<script lang="ts">
	import NutrientIcon, { type Nutrient } from '../components/NutrientIcon.svelte';
	import { Count } from 'warren/web';
	import { Trace, type TraceName } from 'warren/burrow';

	/* Burrow's Meter. Every meter shares one scale, 0 to 125% of its target, with the target as a tick at 80%; past it
	   the fill carries on in its own colour, striped, so a meter over target looks like the others. The flag ("6 g
	   over") follows the label; "value / target" keeps its own column on the right. */
	let {
		label,
		value,
		max,
		unit = 'g',
		color = 'accent',
		cap,
		nutrient,
		overIsGood = false
	}: {
		label: string;
		value: number;
		max: number | null;
		unit?: string;
		color?: string;
		cap?: TraceName;
		nutrient?: Nutrient;
		/** Going past the target is fine (protein): the flag isn't a warning. */
		overIsGood?: boolean;
	} = $props();

	const HEADROOM = 1.25;
	const target = $derived(max != null && max > 0 ? max : null);
	const v = $derived(Math.max(0, value || 0));
	// over only once the numbers shown differ, so 65.4 of 65 g doesn't read "0 g over"
	const over = $derived(target != null && Math.round(v) > Math.round(target));
	const end = $derived(target ? target * HEADROOM : 1);
	const base = $derived(target ? Math.min(v, target) / end : 0);
	const extra = $derived(target ? Math.max(0, Math.min(v, end) - target) / end : 0);
	const at = 1 / HEADROOM;
</script>

<div class="bh-meter {over ? 'is-over' : ''}" style="--meter: var(--{color}); --meter-soft: var(--{color}-soft)">
	<div class="bh-meter__top">
		<span class="bh-meter__label"
			>{#if nutrient}<NutrientIcon kind={nutrient} size={14} />{/if}{label}{#if over && target}<span
					class="bh-tag {overIsGood ? 'bh-tag--in' : 'bh-tag--over'}">{Math.round(v - target)} {unit} over</span
				>{:else if !target}<span class="bh-tag">No target</span>{/if}</span
		>
		<span class="bh-meter__value"><Count value={v} />{target ? ` / ${Math.round(target)}` : ''} {unit}</span>
	</div>
	<div class="bh-meter__rail">
		<div
			class="bh-meter__track"
			role="meter"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={target ?? undefined}
			aria-valuenow={Math.round(v)}
		>
			<div class="bh-meter__fill" style="--w: {base * 100}%"></div>
			{#if extra > 0}
				<div class="bh-meter__extra" style="left: {at * 100}%; --w: {extra * 100}%"></div>
			{/if}
		</div>
		{#if target}
			<span class="bh-meter__tick" style="left: {at * 100}%" aria-hidden="true"></span>
		{/if}
		{#if cap && target}
			<!-- the sunflower rides the end of the fill -->
			<Trace name={cap} size={24} class="bh-meter__cap" style="--w: {(base + extra) * 100}%; --p: {base + extra}" />
		{/if}
	</div>
</div>
