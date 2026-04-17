import { z } from "zod";

export const ResourceSchema = z.object({
  addresses: z.array(z.string().optional()).optional(),
  description: z.string().optional(),
  emails: z.array(z.string().optional()).optional(),
  justification: z.string().optional(),
  name: z.string(),
  phones: z.array(z.string().optional()).optional(),
  website: z.string().nullish().or(z.literal("")),
  referral_type: z.enum(["external", "internal", "government"]).optional(),
});

export const ResourcesSchema = z.object({
  resources: z.array(ResourceSchema),
});

export type Resource = z.infer<typeof ResourceSchema>;
export type Resources = z.infer<typeof ResourcesSchema>;
