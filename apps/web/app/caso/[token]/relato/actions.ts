"use server"

import { redirect } from "next/navigation"

import {
  submitStory as submit,
  type StoryState,
} from "@/lib/cases/submit-story"

export async function submitStory(
  token: string,
  _previous: StoryState,
  formData: FormData
): Promise<StoryState> {
  const result = await submit(token, formData)
  if (!result.ok) return result.state
  redirect(`/caso/${token}`)
}
