"use server"

import { revalidatePath } from "next/cache"

import { runDeadlineWarnings } from "@/lib/cases/deadline-warnings"
import { requireOperator } from "@/lib/operator/auth"

export async function runWarnings(): Promise<void> {
  await requireOperator()
  await runDeadlineWarnings()
  revalidatePath("/admin")
}
