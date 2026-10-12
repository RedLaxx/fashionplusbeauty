import type { CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

export function isPublished(article: Article) {
  return article.data.status === 'published';
}

export function byNewest(a: Article, b: Article) {
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

export function articleUrl(article: Article) {
  return `/stories/${article.id}/`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function imageUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const siteUrl = (import.meta.env.PUBLIC_SITE_URL || 'https://fashionplusbeauty.com').replace(/\/$/, '');
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
