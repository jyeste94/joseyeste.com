import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string().optional(), // Using description to map to existing 'summary' or standard meta
        summary: z.string(), // Keeping summary as per existing data structure
        date: z.string().transform((str) => new Date(str)), // Transform string date to Date object
        category: z.string(),
        readingTime: z.string(),
        tags: z.array(z.string()),
    }),
});

export const collections = { blog };
