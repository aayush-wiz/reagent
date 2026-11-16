/**
 * backend/src/services/task-artifacts.ts — attribute research artifacts to the
 * task that produced them (Tasks page shows ONLY this task's outputs).
 *
 *   A research accumulates findings / docs / files across many tasks, so we
 *   can't show all of them on one task's page. Instead the worker SNAPSHOTS the
 *   research's artifact state before a run and DIFFS after — new/changed items
 *   belong to that run. This is universal (covers run_python figures that no
 *   tool logs) and needs no changes to the agent's tools.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../repositories/db-client.ts";
import { findings, documents, tasks } from "../models/schema.ts";
import { listWorkspaceFiles } from "./workspace-files.ts";
import { getTask } from "./tasks.ts";

export interface ArtifactSnapshot {
  findingIds: Set<string>;
  docs: Map<string, number>; // name → updatedAt
  files: Map<string, number>; // path → mtime
}

export interface TaskArtifacts {
  findings: string[]; // finding ids
  docs: string[]; // document names
  files: string[]; // workspace file paths
}

/** Capture the research's current artifact fingerprint. */
export async function snapshotArtifacts(researchId: string): Promise<ArtifactSnapshot> {
  const findingIds = new Set(
    db.select({ id: findings.id }).from(findings).where(eq(findings.researchId, researchId)).all().map((r) => r.id),
  );
  const docRows = db
    .select({ name: documents.name, updatedAt: documents.updatedAt })
    .from(documents)
    .where(eq(documents.researchId, researchId))
    .all();
  const docs = new Map(docRows.map((d) => [d.name, d.updatedAt]));
  const fileRows = await listWorkspaceFiles(researchId).catch(() => []);
  const files = new Map(fileRows.map((f) => [f.path, f.updatedAt]));
  return { findingIds, docs, files };
}

/** What changed vs a prior snapshot = the task's own artifacts. */
export async function diffArtifacts(researchId: string, before: ArtifactSnapshot): Promise<TaskArtifacts> {
  const after = await snapshotArtifacts(researchId);
  return {
    findings: [...after.findingIds].filter((id) => !before.findingIds.has(id)),
    docs: [...after.docs.entries()].filter(([n, u]) => u > (before.docs.get(n) ?? -1)).map(([n]) => n),
    files: [...after.files.entries()].filter(([p, m]) => m > (before.files.get(p) ?? -1)).map(([p]) => p),
  };
}

/** Persist the computed artifacts onto the task row. */
export function saveTaskArtifacts(taskId: string, artifacts: TaskArtifacts): void {
  db.update(tasks).set({ artifacts: JSON.stringify(artifacts) }).where(eq(tasks.id, taskId)).run();
}

/** Resolve a task's stored artifacts into full records for the Task detail page. */
export async function resolveTaskArtifacts(taskId: string) {
  const t = getTask(taskId);
  if (!t || !t.researchId) return { researchId: null, findings: [], documents: [], files: [] };
  let a: TaskArtifacts;
  try {
    a = JSON.parse(t.artifacts);
  } catch {
    a = { findings: [], docs: [], files: [] };
  }

  const findingRows = a.findings?.length
    ? db.select().from(findings).where(inArray(findings.id, a.findings)).all()
    : [];
  const docRows = a.docs?.length
    ? db.select().from(documents).where(and(eq(documents.researchId, t.researchId), inArray(documents.name, a.docs))).all()
    : [];
  // Enrich file paths with category/size from the live workspace listing.
  const allFiles = await listWorkspaceFiles(t.researchId).catch(() => []);
  const wanted = new Set(a.files ?? []);
  const files = allFiles.filter((f) => wanted.has(f.path));

  return {
    researchId: t.researchId,
    findings: findingRows.map((f) => ({ id: f.id, kind: f.kind, text: f.text })),
    documents: docRows.map((d) => ({ name: d.name, title: d.title, content: d.content })),
    files,
  };
}
