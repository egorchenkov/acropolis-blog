import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    image: z.string().refine(
      (val) => val.startsWith('/uploads/') || val.startsWith('https://'),
      { message: 'Image must be a local /uploads/ path or https:// URL' }
    ).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
