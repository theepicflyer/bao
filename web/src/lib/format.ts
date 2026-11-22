import type { Food, Nutrients, Serving } from './types.ts';

export function kcal(value: number | null | undefined): string {
	if (value == null) return '–';
	return Math.round(value).toLocaleString('en-SG');
}

/** "21:00" as "9:00 pm". */
export function clock(hhmm: string): string {
	const [h, m] = hhmm.split(':').map(Number);
	return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export function grams(value: number | null | undefined): string {
	if (value == null) return '–';
	return `${Math.round(value)}`;
}

export function qty(value: number): string {
	return Number.isInteger(value) ? `${value}` : `${Math.round(value * 100) / 100}`;
}

export function parseDate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = `${d.getMonth() + 1}`.padStart(2, '0');
	const day = `${d.getDate()}`.padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
	const d = parseDate(iso);
	d.setDate(d.getDate() + n);
	return isoDate(d);
}

export function dayLabel(iso: string, today: string): string {
	if (iso === today) return 'Today';
	if (iso === addDays(today, -1)) return 'Yesterday';
	if (iso === addDays(today, 1)) return 'Tomorrow';
	const d = parseDate(iso);
	const sameYear = iso.slice(0, 4) === today.slice(0, 4);
	return d
		.toLocaleDateString('en-SG', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			...(sameYear ? {} : { year: 'numeric' })
		})
		.replace(',', '');
}

const RELATIVE = ['Today', 'Yesterday', 'Tomorrow'];

/** The day screen's title: Today, Yesterday, Tomorrow, else the weekday. */
export function dayTitle(iso: string, today: string): string {
	const rel = dayLabel(iso, today);
	return RELATIVE.includes(rel) ? rel : parseDate(iso).toLocaleDateString('en-SG', { weekday: 'long' });
}

/** The line above the title: the full date for relative days, else the date (with the year when it isn't this one). */
export function daySubtitle(iso: string, today: string): string {
	if (RELATIVE.includes(dayLabel(iso, today))) return longDate(iso);
	const sameYear = iso.slice(0, 4) === today.slice(0, 4);
	return parseDate(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function longDate(iso: string): string {
	return parseDate(iso).toLocaleDateString('en-SG', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
}

export function defaultServing(food: Food): Serving | null {
	return food.servings.find((s) => s.default) ?? food.servings[0] ?? null;
}

export function scale(per100: Nutrients, g: number): Nutrients {
	const out = {} as Nutrients;
	for (const [k, v] of Object.entries(per100) as [keyof Nutrients, number | null][]) {
		out[k] = v == null ? null : (v * g) / 100;
	}
	return out;
}

// Words a count leaves as they are: units, and labels that are only a size ("1 large" egg) or a share ("1 whole").
const SAME = new Set(['g', 'kg', 'mg', 'ml', 'l', 'oz', 'lb', 'lbs', 'tbsp', 'tsp', 'whole', 'large', 'medium', 'small', 'regular', 'fish', 'nfs']);
const IRREGULAR: Record<string, string> = { half: 'halves', loaf: 'loaves', leaf: 'leaves', knife: 'knives', shelf: 'shelves', gram: 'grams' };

/** A serving word made plural: piece → pieces, glass → glasses, patty → patties, half → halves; oz and whole stay. */
export function plural(word: string): string {
	const lower = word.toLowerCase();
	if (SAME.has(lower) || !/[a-z]$/i.test(word)) return word;
	if (IRREGULAR[lower]) return IRREGULAR[lower];
	if (/(ss|sh|ch|x|z)$/i.test(word)) return `${word}es`;
	if (/s$/i.test(word)) return word;
	if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
	return `${word}s`;
}

/**
 * A counted serving as a number and its word: "1 bowl", "2 pieces", "2 regular cups", "3 scoops (serving spoon)",
 * "2 cans/cartons". The label's own count multiplies in ("3 oz" twice is "6 oz"). A bracket holding only a size
 * ("(250ml)", "(8 fl oz)") is dropped, so a count is never followed by an amount; any other bracket or comma
 * describes the serving and stays as it is.
 */
export function countText(servings: number, label: string): string {
	const clean = label
		.replace(/\((s|es)\)/g, '')
		.replace(/\s*\(\s*\d+(?:\.\d+)?\s*(?:ml|l|g|kg|mg|oz|fl\.? ?oz)\s*\)/gi, '')
		.trim();
	const m = /^(\d+(?:\.\d+)?|one|an?)\s+(.*)$/i.exec(clean);
	const each = m ? (/^\d/.test(m[1]) ? Number(m[1]) : 1) : 1;
	const unit = m ? m[2] : clean;
	const n = Math.round(servings * each * 100) / 100;
	if (n <= 1 || !unit) return `${qty(n)} ${unit}`.trim();
	// the word to change is the last one before any bracket or comma; "can/carton" changes both
	const cut = unit.search(/\s*[(,]/);
	const head = cut < 0 ? unit : unit.slice(0, cut);
	const tail = cut < 0 ? '' : unit.slice(cut);
	const words = head.split(' ');
	words[words.length - 1] = words[words.length - 1].split('/').map(plural).join('/');
	return `${qty(n)} ${words.join(' ')}${tail}`;
}

/** What an entry or quick add was: a count of servings ("2 pieces") or, only when weighed, its grams ("75 g"). */
export function portionText(servings: number | null, label: string | null, g: number | null): string {
	if (label && servings != null) return countText(servings, label);
	if (g != null) return `${Math.round(g)} g`;
	return label ?? '';
}

export const entryPortion = portionText;

/** A food's name with its brand in front, as entries name it ("Walker's Shortbread"). */
export function foodTitle(food: Food): string {
	return food.brand && !food.name.toLowerCase().includes(food.brand.toLowerCase()) ? `${food.brand} ${food.name}` : food.name;
}

/** A food's own row: its numbers per its default serving ("per 1 plate"), else per 100 g. */
export function foodPortion(food: Food): { portion: string; n: Nutrients } {
	const s = defaultServing(food);
	return { portion: `per ${s ? countText(1, s.label) : '100 g'}`, n: scale(food.per_100g, s ? s.grams : 100) };
}

export function initialPortion(
	food: Food,
	servings: number | null = null,
	label: string | null = null,
	g: number | null = null
): import('./types.ts').Portion {
	const match = label ? food.servings.find((s) => s.label === label) : null;
	if (match) return { unit: match.label, count: servings ?? 1, grams: g ?? match.grams };
	if (g != null && !label) return { unit: 'g', count: 1, grams: g };
	const d = defaultServing(food);
	if (d) return { unit: d.label, count: 1, grams: d.grams };
	return { unit: 'g', count: 1, grams: g ?? 100 };
}

export function portionPayload(p: import('./types.ts').Portion): {
	servings?: number;
	serving?: string;
	grams?: number;
} {
	if (p.unit === 'g') return { grams: Math.max(1, Number(p.grams) || 0) };
	return { servings: Math.max(0.25, Number(p.count) || 1), serving: p.unit };
}

export function portionGrams(food: Food, p: import('./types.ts').Portion): number {
	if (p.unit === 'g') return Number(p.grams) || 0;
	const s = food.servings.find((x) => x.label === p.unit);
	return (s?.grams ?? 100) * (Number(p.count) || 0);
}
