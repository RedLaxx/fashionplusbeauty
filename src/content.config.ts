import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['fashion', 'beauty', 'lifestyle', 'shopping']),
    heroImage: z.string(),
    heroAlt: z.string(),
    pinImage: z.string().optional(),
    author: z.string().default('FashionPlusBeauty Editors'),
    readTime: z.number().int().positive().default(5),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    status: z.enum(['published', 'draft']).default('published'),
    affiliateDisclosure: z.boolean().default(false),
  }),
});

export const collections = { articles };
