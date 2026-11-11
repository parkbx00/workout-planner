import { db, newId } from './db.ts'
import { getDefaultRestSeconds } from './settings.ts'
import type { Template, TemplateExercise } from './types.ts'

/**
 * Targets given to an exercise when it's added to a template. All editable afterwards.
 * The rest time here is only the factory value; Settings can change the default.
 */
export const TEMPLATE_EXERCISE_DEFAULTS = {
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  restSeconds: 90,
}

export const LIMITS = {
  targetSets: [1, 10],
  reps: [1, 100],
  restSeconds: [0, 600],
} as const

const clamp = (n: number, [lo, hi]: readonly [number, number]) =>
  Math.min(hi, Math.max(lo, Math.round(n)))

export function listTemplateExercises(templateId: string): Promise<TemplateExercise[]> {
  return db.templateExercises.where('templateId').equals(templateId).sortBy('order')
}

export function createTemplate(name = 'New template'): Promise<Template> {
  return db.transaction('rw', db.templates, async () => {
    const last = await db.templates.orderBy('order').last()
    const template: Template = {
      id: newId(),
      name,
      dayOfWeek: null,
      order: (last?.order ?? -1) + 1,
      updatedAt: Date.now(),
    }
    await db.templates.add(template)
    return template
  })
}

export async function updateTemplate(
  id: string,
  patch: Partial<Pick<Template, 'name' | 'dayOfWeek'>>,
): Promise<void> {
  const clean = { ...patch }
  if (clean.name !== undefined) {
    clean.name = clean.name.trim().replace(/\s+/g, ' ')
    if (!clean.name) delete clean.name // an empty name keeps the old one
  }
  await db.templates.update(id, { ...clean, updatedAt: Date.now() })
}

/** Removes the template and its exercise rows. Logged sessions are untouched. */
export async function deleteTemplate(id: string): Promise<void> {
  await db.transaction('rw', db.templates, db.templateExercises, async () => {
    await db.templateExercises.where('templateId').equals(id).delete()
    await db.templates.delete(id)
  })
}

export function addTemplateExercise(
  templateId: string,
  exerciseId: string,
): Promise<TemplateExercise> {
  return db.transaction('rw', db.templateExercises, db.settings, async () => {
    const current = await listTemplateExercises(templateId)
    const row: TemplateExercise = {
      id: newId(),
      templateId,
      exerciseId,
      order: (current.at(-1)?.order ?? -1) + 1,
      ...TEMPLATE_EXERCISE_DEFAULTS,
      restSeconds: await getDefaultRestSeconds(),
      updatedAt: Date.now(),
    }
    await db.templateExercises.add(row)
    return row
  })
}

export type TargetPatch = Partial<
  Pick<TemplateExercise, 'targetSets' | 'repMin' | 'repMax' | 'restSeconds'>
>

/** Applies the patch, clamps to sane limits and keeps repMin ≤ repMax. */
export async function updateTemplateExercise(id: string, patch: TargetPatch): Promise<void> {
  await db.transaction('rw', db.templateExercises, async () => {
    const current = await db.templateExercises.get(id)
    if (!current) return
    const next = { ...current, ...patch }
    next.targetSets = clamp(next.targetSets, LIMITS.targetSets)
    next.repMin = clamp(next.repMin, LIMITS.reps)
    next.repMax = clamp(next.repMax, LIMITS.reps)
    next.restSeconds = clamp(next.restSeconds, LIMITS.restSeconds)
    if (next.repMin > next.repMax) {
      // Whichever end the user just edited wins; the other end follows it.
      if (patch.repMax !== undefined && patch.repMin === undefined) next.repMin = next.repMax
      else next.repMax = next.repMin
    }
    next.updatedAt = Date.now()
    await db.templateExercises.put(next)
  })
}

export async function removeTemplateExercise(id: string): Promise<void> {
  await db.templateExercises.delete(id)
}

export async function reorderTemplateExercises(
  templateId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.templateExercises, async () => {
    const now = Date.now()
    const rows = await listTemplateExercises(templateId)
    const position = new Map(orderedIds.map((id, i) => [id, i]))
    for (const row of rows) {
      const order = position.get(row.id)
      if (order !== undefined && order !== row.order) {
        await db.templateExercises.update(row.id, { order, updatedAt: now })
      }
    }
  })
}
