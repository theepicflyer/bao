<script lang="ts">
	import FoodRow from './FoodRow.svelte';
	import { MEAL_TRACE, type Entry } from '../types.ts';
	import { entryPortion } from '../format.ts';
	import { Trace } from 'warren/burrow';

	let { entry, onclick }: { entry: Entry; onclick: () => void } = $props();
</script>

<FoodRow
	name={entry.name}
	portion={entryPortion(entry.servings, entry.serving_label, entry.grams)}
	protein={entry.protein_g}
	carbs={entry.carb_g}
	fat={entry.fat_g}
	kcal={entry.kcal}
	{onclick}
>
	{#snippet tile()}
		{#if entry.photo_id}
			<img src="/api/files/{entry.photo_id}" alt="" loading="lazy" class="mk-tile-photo" />
		{:else}
			<Trace name={MEAL_TRACE[entry.meal]} size={24} />
		{/if}
	{/snippet}
</FoodRow>
