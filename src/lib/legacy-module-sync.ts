import { apiFetch } from "@/lib/api-client";
import { syncStoreToCloud, type CloudSyncResult } from "@/lib/cloud-sync";
import { isCloudUuid } from "@/lib/cloud-uuid";
import { db } from "@/lib/db";
import { reconcileProductsWithCloud } from "@/lib/product-reconcile";
import { supabase } from "@/lib/supabase/client";
import { syncAll } from "@/lib/sync";
import type { Course, CourseModule, Delivery, FarmParcel, HealthPatient } from "@/types";

export interface ModuleSyncSlice {
  pushed: number;
  errors: string[];
}

export interface LegacyModuleSyncResult {
  products: ModuleSyncSlice;
  courses: ModuleSyncSlice;
  modules: ModuleSyncSlice;
  deliveries: ModuleSyncSlice;
  patients: ModuleSyncSlice;
  parcels: ModuleSyncSlice;
  assets: ModuleSyncSlice;
  queue: { synced: number; errors: number };
  crm: CloudSyncResult;
}

function localModulesKey(courseId: string): string {
  return `wazo_course_modules_${courseId}`;
}

function readLocalModules(courseId: string): CourseModule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(localModulesKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CourseModule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalModules(courseId: string, modules: CourseModule[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(localModulesKey(courseId), JSON.stringify(modules));
}

async function listCourseIds(storeId: string): Promise<string[]> {
  const ids = new Set<string>();

  if (db) {
    const local = await db.courses.where("store_id").equals(storeId).toArray();
    for (const course of local) ids.add(course.id);
  }

  try {
    const response = await apiFetch(
      `/api/education/courses?store_id=${encodeURIComponent(storeId)}`,
      { cache: "no-store" }
    );
    const payload = (await response.json()) as { courses?: Course[] };
    if (response.ok && payload.courses) {
      for (const course of payload.courses) ids.add(course.id);
    }
  } catch {
    // Offline or API error — local ids only.
  }

  return [...ids];
}

async function syncPendingCourses(storeId: string): Promise<ModuleSyncSlice> {
  const result: ModuleSyncSlice = { pushed: 0, errors: [] };
  if (!db) return result;

  const pending = await db.courses
    .where("store_id")
    .equals(storeId)
    .filter((c) => c._pendingSync || c.id.startsWith("local-"))
    .toArray();

  for (const course of pending) {
    try {
      const response = await apiFetch("/api/education/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          title: course.title,
          description: course.description,
          is_public: course.is_public ?? false,
        }),
      });
      const payload = (await response.json()) as { course?: Course; error?: string };
      if (!response.ok || !payload.course) {
        result.errors.push(`${course.title}: ${payload.error || "échec"}`);
        continue;
      }
      const oldId = course.id;
      const saved = { ...course, ...payload.course, _pendingSync: false };
      if (oldId.startsWith("local-")) await db.courses.delete(oldId);
      await db.courses.put(saved);
      result.pushed++;
    } catch (error) {
      result.errors.push(
        `${course.title}: ${error instanceof Error ? error.message : "échec"}`
      );
    }
  }

  return result;
}

async function syncPendingModules(storeId: string): Promise<ModuleSyncSlice> {
  const result: ModuleSyncSlice = { pushed: 0, errors: [] };
  const courseIds = await listCourseIds(storeId);

  for (const courseId of courseIds) {
    const local = readLocalModules(courseId);
    const pending = local.filter((m) => !isCloudUuid(m.id));
    if (!pending.length) continue;

    let next = [...local];

    for (const courseModule of pending) {
      try {
        const response = await apiFetch("/api/education/modules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: courseId,
            title: courseModule.title,
            content: courseModule.content ?? null,
            media_url: courseModule.media_url ?? null,
            sort_order:
              typeof courseModule.sort_order === "number" ? courseModule.sort_order : 0,
          }),
        });
        const payload = (await response.json()) as {
          success: boolean;
          module?: CourseModule;
          error?: string;
        };
        if (response.ok && payload.success && payload.module) {
          next = next.map((item) =>
            item.id === courseModule.id ? payload.module! : item
          );
          result.pushed++;
        } else {
          result.errors.push(
            `${courseModule.title}: ${payload.error || "échec module"}`
          );
        }
      } catch (error) {
        result.errors.push(
          `${courseModule.title}: ${error instanceof Error ? error.message : "échec"}`
        );
      }
    }

    writeLocalModules(courseId, next);
  }

  return result;
}

async function syncPendingDeliveries(storeId: string): Promise<ModuleSyncSlice> {
  const result: ModuleSyncSlice = { pushed: 0, errors: [] };
  if (!db) return result;

  const pending = await db.deliveries
    .where("store_id")
    .equals(storeId)
    .filter((d) => d._pendingSync || !isCloudUuid(d.id))
    .toArray();

  for (const delivery of pending) {
    try {
      const response = await apiFetch("/api/logistics/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          sender_name: delivery.sender_name,
          recipient_name: delivery.recipient_name,
          recipient_phone: delivery.recipient_phone,
          address: delivery.address,
        }),
      });
      const payload = (await response.json()) as { delivery?: Delivery; error?: string };
      if (!response.ok || !payload.delivery) {
        result.errors.push(
          `${delivery.tracking_code}: ${payload.error || "échec livraison"}`
        );
        continue;
      }
      const oldId = delivery.id;
      const saved = { ...payload.delivery, _pendingSync: false };
      if (!isCloudUuid(oldId)) await db.deliveries.delete(oldId);
      await db.deliveries.put(saved);
      result.pushed++;
    } catch (error) {
      result.errors.push(
        `${delivery.tracking_code}: ${error instanceof Error ? error.message : "échec"}`
      );
    }
  }

  return result;
}

async function syncPendingPatients(storeId: string): Promise<ModuleSyncSlice> {
  const result: ModuleSyncSlice = { pushed: 0, errors: [] };
  if (!db) return result;

  const pending = await db.healthPatients
    .where("store_id")
    .equals(storeId)
    .filter((p) => p._pendingSync || !isCloudUuid(p.id))
    .toArray();

  for (const patient of pending) {
    try {
      const response = await apiFetch("/api/health/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          full_name: patient.full_name,
          age: patient.age,
          blood_group: patient.blood_group,
          allergies: patient.allergies,
          medical_history: patient.medical_history,
          phone: patient.phone,
        }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        patient?: HealthPatient;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.patient) {
        result.errors.push(`${patient.full_name}: ${payload.error || "échec patient"}`);
        continue;
      }
      const oldId = patient.id;
      const saved = { ...payload.patient, _pendingSync: false };
      if (!isCloudUuid(oldId)) await db.healthPatients.delete(oldId);
      await db.healthPatients.put(saved);
      result.pushed++;
    } catch (error) {
      result.errors.push(
        `${patient.full_name}: ${error instanceof Error ? error.message : "échec"}`
      );
    }
  }

  return result;
}

async function syncPendingParcels(storeId: string): Promise<ModuleSyncSlice> {
  const result: ModuleSyncSlice = { pushed: 0, errors: [] };
  if (!db) return result;

  const pending = await db.farmParcels
    .where("store_id")
    .equals(storeId)
    .filter((p) => p._pendingSync || !isCloudUuid(p.id))
    .toArray();

  for (const parcel of pending) {
    try {
      const response = await apiFetch("/api/agriculture/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          name: parcel.name,
          area_hectares: parcel.area_hectares,
          crop_type: parcel.crop_type,
          sowing_date: parcel.sowing_date,
          stage: parcel.stage,
          expected_yield_kg: parcel.expected_yield_kg,
          harvested_kg: parcel.harvested_kg,
          latitude: parcel.latitude,
          longitude: parcel.longitude,
        }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        parcel?: FarmParcel;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.parcel) {
        result.errors.push(`${parcel.name}: ${payload.error || "échec parcelle"}`);
        continue;
      }
      const oldId = parcel.id;
      const saved = { ...payload.parcel, _pendingSync: false };
      if (!isCloudUuid(oldId)) await db.farmParcels.delete(oldId);
      await db.farmParcels.put(saved);
      result.pushed++;
    } catch (error) {
      result.errors.push(
        `${parcel.name}: ${error instanceof Error ? error.message : "échec"}`
      );
    }
  }

  return result;
}

async function syncPendingAssets(storeId: string): Promise<ModuleSyncSlice> {
  const result: ModuleSyncSlice = { pushed: 0, errors: [] };
  if (!db) return result;

  const pending = await db.blockchainAssets
    .where("store_id")
    .equals(storeId)
    .filter((a) => a._pendingSync || !isCloudUuid(a.id))
    .toArray();

  for (const asset of pending) {
    try {
      const response = await apiFetch("/api/blockchain/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          name: asset.name,
          asset_type: asset.asset_type,
          description: asset.description,
          metadata: asset.metadata,
          latitude: asset.latitude,
          longitude: asset.longitude,
        }),
      });
      const payload = (await response.json()) as {
        asset?: { id: string };
        error?: string;
      };
      if (!response.ok || !payload.asset) {
        result.errors.push(`${asset.name}: ${payload.error || "échec actif"}`);
        continue;
      }
      const oldId = asset.id;
      const saved = { ...asset, id: payload.asset.id, _pendingSync: false };
      if (!isCloudUuid(oldId)) await db.blockchainAssets.delete(oldId);
      await db.blockchainAssets.put(saved);
      result.pushed++;
    } catch (error) {
      result.errors.push(
        `${asset.name}: ${error instanceof Error ? error.message : "échec"}`
      );
    }
  }

  return result;
}

/** Pousse toutes les données locales (Dexie + localStorage) vers le cloud via les APIs serveur. */
export async function syncAllLegacyModulesToCloud(
  storeId: string
): Promise<LegacyModuleSyncResult> {
  if (!navigator.onLine) {
    throw new Error("Connexion requise pour synchroniser vers le cloud.");
  }

  const productsRaw = await reconcileProductsWithCloud(storeId);
  const products: ModuleSyncSlice = {
    pushed: productsRaw.pushed,
    errors: productsRaw.errors,
  };

  const queue = await syncAll(storeId);
  const crm = await syncStoreToCloud(storeId);

  const [courses, modules, deliveries, patients, parcels, assets] = await Promise.all([
    syncPendingCourses(storeId),
    syncPendingModules(storeId),
    syncPendingDeliveries(storeId),
    syncPendingPatients(storeId),
    syncPendingParcels(storeId),
    syncPendingAssets(storeId),
  ]);

  // Rafraîchir les modules cloud pour les cours sans pending local
  for (const courseId of await listCourseIds(storeId)) {
    if (!isCloudUuid(courseId)) continue;
    const { data } = await supabase
      .from("course_modules")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order");
    if (data?.length) writeLocalModules(courseId, data as CourseModule[]);
  }

  return {
    products,
    courses,
    modules,
    deliveries,
    patients,
    parcels,
    assets,
    queue,
    crm,
  };
}

export function formatLegacySyncSummary(result: LegacyModuleSyncResult): string {
  const lines: string[] = [];
  const slices: Array<[string, ModuleSyncSlice]> = [
    ["Produits", result.products],
    ["Cours", result.courses],
    ["Modules formation", result.modules],
    ["Livraisons", result.deliveries],
    ["Patients", result.patients],
    ["Parcelles", result.parcels],
    ["Actifs blockchain", result.assets],
  ];

  let totalPushed = 0;
  for (const [label, slice] of slices) {
    if (slice.pushed > 0) {
      lines.push(`${label}: ${slice.pushed} envoyé(s)`);
      totalPushed += slice.pushed;
    }
  }

  lines.push(
    `CRM: ${result.crm.clientsPushed} clients↑ · ${result.crm.salesPushed} ventes↑`
  );

  if (result.queue.synced > 0) {
    lines.push(`File d'attente: ${result.queue.synced} élément(s)`);
  }

  const allErrors = slices.flatMap(([, s]) => s.errors).concat(result.crm.errors);
  if (allErrors.length) {
    lines.push(`Erreurs: ${allErrors.slice(0, 4).join(" · ")}`);
  } else if (totalPushed === 0 && result.crm.clientsPushed === 0 && result.crm.salesPushed === 0) {
    lines.push("Rien à envoyer — vos données sont déjà à jour sur le cloud.");
  } else {
    lines.push("Synchronisation complète réussie.");
  }

  return lines.join("\n");
}
