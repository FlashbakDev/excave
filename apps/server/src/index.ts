import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildServer } from "./app.js"

const rootDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
loadEnv({ path: resolve(rootDir, ".env") })

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? "0.0.0.0"

async function main() {
  const { app, db } = await buildServer()

  try {
    await app.listen({ port: PORT, host: HOST })
  } catch (error) {
    app.log.error(error)
    await db?.client.end({ timeout: 2 })
    process.exit(1)
  }
}

void main()
