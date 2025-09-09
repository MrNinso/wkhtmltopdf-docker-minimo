import { execSync } from "child_process"
import path from "path"
import fs from "fs/promises"

function getDependencies(filePath: string): string[] {
    try {
        const output = execSync(`ldd ${filePath}`, { encoding: "utf-8" })
        const deps: string[] = []
        for (const l of output.split("\n")) {
            const line = l?.trim()
            if (!line) continue

            // Caso 1: "libxxx.so => /path/to/libxxx.so (0x...)"
            let match = line.match(/=>\s*(\/[^\s]+)/)
            if (match) {
                deps.push(match[1])
                continue
            }

            // Caso 2: "/path/to/libxxx.so (0x...)" sem "=>"
            match = line.match(/^\/[^\s]+/)
            if (match) {
                deps.push(match[0])
                continue
            }
        }
        return deps
    } catch (err: any) {
        console.error(`Erro rodando ldd em ${filePath}:`, err.message)
        return []
    }
}

async function resolveAllLibs(entryFile: string): Promise<Set<string>> {
    const visited = new Set<string>()
    const toVisit = [path.resolve(entryFile)]

    while (toVisit.length > 0) {
        const current = toVisit.pop()
        if (!current) continue
        if (visited.has(current)) continue

        visited.add(current)

        const stat = await fs.lstat(current)
        if (stat.isSymbolicLink()) {
            const realTarget = await fs.realpath(current)
            if (!visited.has(realTarget)) {
                toVisit.push(realTarget)
            }
        }

        const deps = getDependencies(current)
        for (const dep of deps) {
            if (!visited.has(dep)) {
                toVisit.push(dep)
            }
        }
    }

    return visited
}

async function main() {
    if (process.argv.length !== 3) {
        console.error("Uso: bun resolveLibs.ts /caminho/do/binario")
        process.exit(1)
    }

    const entryFile = process.argv[2]
    const allLibs = [...(await resolveAllLibs(entryFile))]
    const baseLibs = path.resolve("./libs")

    await fs.mkdir(baseLibs, { recursive: true })

    await Promise.all(allLibs.map(async (lib) => {
        const novoCaminho = path.join(baseLibs, lib)
        await fs.mkdir(path.dirname(novoCaminho), { recursive: true })

        const stat = await fs.lstat(lib)
        if (stat.isSymbolicLink()) {
            // preserva o link
            const target = await fs.readlink(lib)
            await fs.symlink(target, novoCaminho)
        } else {
            // copia arquivo normal
            await fs.cp(lib, novoCaminho, { recursive: true })
        }
        console.log(`COPY: ${lib}`)
    }))

    console.log("== COPY: DONE ==")
}

main()
