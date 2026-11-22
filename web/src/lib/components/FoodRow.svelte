<script lang="ts">
	import type { Snippet } from 'svelte';
	import MacroAmounts from './MacroAmounts.svelte';

	/* Burrow's food ListRow: the name alone on line 1, then the portion and the macros with kcal on line 2. Neither
	   line wraps. The tile is optional (the chat's change card has none); `end` puts a badge after the name. */
	let {
		name,
		portion,
		protein,
		carbs,
		fat,
		kcal,
		removed = false,
		tile,
		end,
		href,
		onclick,
		onpointerdown,
		disabled = false
	}: {
		name: string;
		portion: string;
		protein: number | null;
		carbs: number | null;
		fat: number | null;
		kcal: number | null;
		/** Struck through with its numbers dimmed: an entry a turn removed. */
		removed?: boolean;
		tile?: Snippet;
		end?: Snippet;
		/** A link (Foods) or a button (Today, the add sheet); neither makes a plain row. */
		href?: string;
		onclick?: () => void;
		onpointerdown?: () => void;
		disabled?: boolean;
	} = $props();

	const cls = $derived(`bh-row bh-row--food mk-food ${removed ? 'is-removed' : ''}`);
</script>

{#snippet content()}
	{#if tile}<span class="bh-row__tile">{@render tile()}</span>{/if}
	<span class="bh-row__body">
		{#if end}
			<span class="bh-row__line"><span class="bh-row__title">{name}</span>{@render end()}</span>
		{:else}
			<span class="bh-row__title">{name}</span>
		{/if}
		<span class="bh-row__line">
			<span class="bh-row__sub">{portion}</span>
			<MacroAmounts {protein} {carbs} {fat} {kcal} />
		</span>
	</span>
{/snippet}

{#if href != null}
	<a class="{cls} mk-row-btn wn-press" {href} {onpointerdown}>{@render content()}</a>
{:else if onclick}
	<button class="{cls} mk-row-btn wn-press" {onclick} {disabled}>{@render content()}</button>
{:else}
	<div class={cls}>{@render content()}</div>
{/if}
