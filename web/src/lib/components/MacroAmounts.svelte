<script lang="ts" module>
	import type { Nutrient } from './NutrientIcon.svelte';

	const NAME: Record<Nutrient, [string, string]> = {
		protein: ['Protein', 'g'],
		carbs: ['Carbs', 'g'],
		fat: ['Fat', 'g'],
		energy: ['Energy', 'kcal']
	};
</script>

<script lang="ts">
	import NutrientIcon from './NutrientIcon.svelte';
	import { grams, kcal as kcalText } from '../format.ts';

	/* Burrow's Macros: protein, carbs and fat, then kcal when given. Each number starts right after its symbol in a
	   fixed 3-digit box, so nothing moves between 1 and 999; kcal is rightmost, so a 4-digit meal total runs on into
	   the card's padding. A missing value is a muted dash. */
	let {
		protein,
		carbs,
		fat,
		kcal,
		class: cls = ''
	}: {
		protein: number | null | undefined;
		carbs: number | null | undefined;
		fat: number | null | undefined;
		/** Leave out for no kcal cell; null shows a dash. */
		kcal?: number | null;
		class?: string;
	} = $props();
</script>

{#snippet cell(kind: Nutrient, value: number | null | undefined)}
	{@const none = value == null}
	{@const text = kind === 'energy' ? kcalText(value) : grams(value)}
	{@const [name, unit] = NAME[kind]}
	<span class="bh-num bh-num--{kind} {kind === 'energy' ? 'bh-num--k' : ''}" title="{name}: {none ? 'not known' : `${text} ${unit}`}">
		<NutrientIcon {kind} size={14} />
		<span class="bh-sr">{name} </span>
		<span class="bh-num__val {none ? 'is-none' : ''}">{text}</span>
		<span class="bh-sr">{none ? ' not known' : ` ${unit}`}</span>
	</span>
{/snippet}

<span class="bh-macros {cls}">
	{@render cell('protein', protein)}
	{@render cell('carbs', carbs)}
	{@render cell('fat', fat)}
	{#if kcal !== undefined}{@render cell('energy', kcal)}{/if}
</span>
