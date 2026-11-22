<script lang="ts">
	import EntryRow from './EntryRow.svelte';
	import MacroAmounts from './MacroAmounts.svelte';
	import { Trace } from 'warren/burrow';
	import Icon from '../burrow/Icon.svelte';
	import type { Entry, Meal, Nutrients } from '../types.ts';
	import { MEAL_LABEL } from '../types.ts';
	import { wide } from '../state.svelte.ts';
	import { flip, row } from 'warren/web';

	let {
		meal,
		entries,
		subtotal,
		next = false,
		onadd,
		onedit,
		onsave
	}: {
		meal: Meal;
		entries: Entry[];
		subtotal: Nutrients;
		/** The meal the day's trail leads to: the first empty one after the last logged. */
		next?: boolean;
		onadd: (meal: Meal) => void;
		onedit: (entry: Entry) => void;
		onsave: (meal: Meal) => void;
	} = $props();

	const label = $derived(MEAL_LABEL[meal]);
</script>

{#if entries.length}
	<!-- a logged meal: Bao took a bite out of the corner -->
	<div class="bh-nibble">
		<section class="bh-card bh-card--nibbled" aria-label={label}>
			<header class="bh-card__head mk-nibble-head mb-0">
				<h2 class="bh-card__title">{label}</h2>
			</header>
			<!-- a new entry opens its row and rises into place (layout.css); a removed one closes its row; the others move -->
			<ul class="mk-rows mk-stagger">
				{#each entries as entry (entry.id)}
					<li animate:flip transition:row><EntryRow {entry} onclick={() => onedit(entry)} /></li>
				{/each}
			</ul>
			<!-- the meal's totals, in the rows' columns under a ruled line -->
			<div class="bh-row bh-row--food bh-row--total">
				<span class="bh-row__title">Total</span>
				<MacroAmounts protein={subtotal.protein_g} carbs={subtotal.carb_g} fat={subtotal.fat_g} kcal={subtotal.kcal} />
			</div>
			<footer class="bh-card__tray">
				<button class="bh-btn wn-press bh-btn--secondary bh-btn--sm" aria-label="Add to {label}" onclick={() => onadd(meal)}>
					<Icon name="plus" size={18} />Add
				</button>
				{#if entries.some((e) => e.food_id != null)}
					<button class="bh-btn wn-press bh-btn--ghost bh-btn--sm" aria-label="Save {label} as a quick meal" onclick={() => onsave(meal)}>
						<Icon name="bookmark" size={18} />Save meal
					</button>
				{/if}
			</footer>
		</section>
		<Trace name="crumbs" size={26} class="bh-nibble__crumbs" />
	</div>
{:else}
	<section class="bh-card {next ? '' : 'mk-card--quiet'}" aria-label={label} data-trail-end={next || undefined}>
		<div class="flex items-center gap-3">
			<div class="min-w-0 flex-1">
				<h2 class="bh-card__title">{label}</h2>
				<p class="small text-ink-muted">{next ? `Up next. Tell Bao${wide.current ? '' : ' below'}, or add food.` : 'Nothing logged'}</p>
			</div>
			<button class="bh-btn wn-press {next ? 'bh-btn--secondary' : 'bh-btn--ghost'} bh-btn--sm" aria-label="Add to {label}" onclick={() => onadd(meal)}>
				<Icon name="plus" size={18} />Add
			</button>
		</div>
	</section>
{/if}
