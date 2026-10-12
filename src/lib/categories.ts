export const categories = {
  fashion: {
    label: 'Fashion',
    navLabel: 'Style',
    eyebrow: 'The style edit',
    title: 'Wear what feels like you.',
    description: 'Thoughtful outfit ideas, easy styling notes and wardrobe inspiration for the way you really live.',
    accent: 'wine',
  },
  beauty: {
    label: 'Beauty',
    navLabel: 'Beauty',
    eyebrow: 'The beauty desk',
    title: 'A little glow goes a long way.',
    description: 'A friendly edit of skincare, makeup and hair ideas—grounded in real routines and made to feel good.',
    accent: 'rose',
  },
  lifestyle: {
    label: 'Lifestyle',
    navLabel: 'Living',
    eyebrow: 'The good-life notes',
    title: 'Make room for the lovely.',
    description: 'Small rituals, fresh perspectives and feel-good finds for making the everyday a little more yours.',
    accent: 'sand',
  },
  shopping: {
    label: 'Shopping',
    navLabel: 'The Edit',
    eyebrow: 'The considered edit',
    title: 'Good finds, thoughtfully chosen.',
    description: 'Useful, beautiful things worth knowing about—plus the shopping guides that make choosing easier.',
    accent: 'berry',
  },
} as const;

export type CategorySlug = keyof typeof categories;

export function getCategory(slug: string) {
  return categories[slug as CategorySlug] ?? categories.fashion;
}
