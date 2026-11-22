<script lang="ts">
	import FoodRow from '#lib/components/FoodRow.svelte';
	import SourceBadge from '#lib/components/SourceBadge.svelte';
	import EmptyState from '#lib/burrow/EmptyState.svelte';
	import Icon from '#lib/burrow/Icon.svelte';
	import TrailPath from '#lib/burrow/TrailPath.svelte';
	import { Habitat, Loader } from 'warren/burrow';
	import { flip, get, loaded, preload } from 'warren/web';
	import { foodPortion, foodTitle } from '#lib/format.ts';
	import type { Food } from '#lib/types.ts';
	import { columns } from '#lib/state.svelte.ts';

	// the household's foods: at once when Foods was open before, refreshed underneath
	const loadedOurs = loaded<{ foods: Food[] }>(() => '/api/foods/ours');
	const ours = $derived(loadedOurs.data?.foods ?? (loadedOurs.failed ? [] : null));
	let query = $state('');
	let results = $state<Food[]>([]);
	let searching = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let seq = 0;

	function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		if (!q) {
			results = [];
			return;
		}
		searching = true;
		timer = setTimeout(async () => {
			const mine = ++seq;
			try {
				const res = await get<{ results: Food[] }>(`/api/foods/search?q=${encodeURIComponent(q)}&limit=40`);
				if (mine === seq) results = res.results;
			} finally {
				if (mine === seq) searching = false;
			}
		}, 220);
	}
</script>

<svelte:head><title>Foods · Bao</title></svelte:head>

{#snippet foodRow(food: Food)}
	{@const f = foodPortion(food)}
	<!-- a finger on the row starts loading the food, so it's there when the screen slides in -->
	<FoodRow
		name={foodTitle(food)}
		portion={f.portion}
		protein={f.n.protein_g}
		carbs={f.n.carb_g}
		fat={f.n.fat_g}
		kcal={f.n.kcal}
		href="/foods/{food.id}"
		onpointerdown={() => preload(`/api/foods/${food.id}`)}
	>
		{#snippet end()}<SourceBadge source={food.source} />{/snippet}
	</FoodRow>
{/snippet}

<!-- Bao's pantry: the household's own foods, and every reference food to search -->
<Habitat kind="meadow" class="mk-top">
	<p class="small text-ink-muted">Ours, SG FoodID and USDA</p>
	<h1 class="page-title">Foods</h1>
	<a href="/foods/new" class="bh-btn wn-press bh-btn--primary bh-btn--sm mt-2"><Icon name="plus" size={18} />New food</a>
</Habitat>

{#snippet search()}
	<label class="bh-field">
		<span class="sr-only">Search all foods</span>
		<span class="bh-field__box">
			<span class="bh-field__affix"><Icon name="search" size={20} /></span>
			<input class="bh-field__input" type="search" bind:value={query} oninput={onInput} placeholder="Search all foods" />
		</span>
	</label>
{/snippet}

{#snippet searchResults()}
	<section class="bh-card py-1" aria-label="Search results">
		{#if searching && !results.length}
			<div class="grid justify-items-center py-6"><Loader label="Digging through the foods…" /></div>
		{:else if !results.length}
			<EmptyState trace="hole" title="No matches" body="Gali dug everywhere. Try a shorter word." />
		{:else}
			<!-- new matches rise in as you type; ones that stay slide to their new place -->
			<ul class="mk-rows mk-stagger">
				{#each results as food (food.id)}<li animate:flip>{@render foodRow(food)}</li>{/each}
			</ul>
		{/if}
	</section>
{/snippet}

{#snippet household()}
	<section class="bh-card" aria-labelledby="ours-title">
		<header class="bh-card__head mb-1">
			<div class="bh-card__heading">
				<h2 id="ours-title" class="bh-card__title">Ours</h2>
				<p class="bh-card__sub">Shared by the household</p>
			</div>
		</header>
		{#if ours === null}
			<div class="grid gap-5 py-3" aria-busy="true" aria-label="Loading the household's foods">
				{#each [0.7, 0.5, 0.6] as w, i (i)}
					<div class="grid gap-2">
						<div class="mk-skeleton mk-skeleton--line wn-skeleton" style="width: {w * 100}%"></div>
						<div class="mk-skeleton mk-skeleton--line wn-skeleton w-1/4"></div>
					</div>
				{/each}
			</div>
		{:else if !ours.length}
			<EmptyState
				trace="sunflower"
				title="No household foods yet"
				body="Add the things you buy and eat often. Their aliases make them the default, so “a bowl of yogurt” means your yogurt."
			/>
		{:else}
			<ul class="mk-rows mk-stagger">
				{#each ours as food (food.id)}<li>{@render foodRow(food)}</li>{/each}
			</ul>
		{/if}
	</section>
{/snippet}

{#snippet tip()}
	<div class="bh-card bh-card--tint body flex gap-3">
		<span class="shrink-0 pt-0.5"><Icon name="camera" size={22} /></span>
		<span>Send a photo of a nutrition label to Bao on the Today screen and it saves the food here for you.</span>
	</div>
{/snippet}

<div class="mk-page">
	{#if columns.current}
		<!-- unfolded and desktop: the household's foods beside the search, crumbs winding behind both -->
		<TrailPath kind="crumbs" from={0.5} to={0.75} seed={3} class="grid grid-cols-2 items-start gap-9 pt-9 pb-4">
			<div class="grid gap-9">
				{@render household()}
			</div>
			<div class="grid gap-9">
				{@render search()}
				{#if query.trim()}{@render searchResults()}{:else}{@render tip()}{/if}
			</div>
		</TrailPath>
	{:else}
		<!-- Bao's crumbs wind down from the meadow behind the search and the cards -->
		<TrailPath kind="crumbs" from={0.78} to={0.4} seed={3} class="grid gap-9 pt-9 pb-4">
			{@render search()}
			{#if query.trim()}
				{@render searchResults()}
			{:else}
				{@render household()}
				{@render tip()}
			{/if}
		</TrailPath>
	{/if}
</div>
