import { runDeadlineWarnings } from "@/lib/cases/deadline-warnings"
import { passwordMatches } from "@/lib/operator/session"

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!passwordMatches(token, process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 })
  }
  return Response.json({ warnings: await runDeadlineWarnings() })
}
