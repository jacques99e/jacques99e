/**
 * Crée ou met à jour deux comptes test : propriétaire + employé, liés à une boutique.
 * Usage : node scripts/setup-test-accounts.mjs
 *
 * Préfère SUPABASE_SERVICE_ROLE_KEY si valide ; sinon utilise la clé anon (signup + session).
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = loadEnvFile(path.join(ROOT, ".env.local"));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local");
  process.exit(1);
}

const ACCOUNTS = {
  owner: {
    email: "test.owner@wazo.africa",
    password: "TestOwner2026!",
    phone: "+221770000001",
    full_name: "Test Propriétaire",
  },
  employee: {
    email: "test.employee@wazo.africa",
    password: "TestEmployee2026!",
    phone: "+221770000002",
    full_name: "Test Employé",
  },
};

const STORE_NAME = "Boutique Test Rôles Wazo";
const STORE_SLUG = "boutique-test-roles-wazo";

async function serviceRoleWorks() {
  if (!serviceKey) return false;
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  return res.ok;
}

async function ensureUserViaAdmin(admin, account) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === account.email.toLowerCase());

  let userId;
  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.full_name, phone: account.phone },
    });
    console.log(`  Utilisateur existant mis à jour : ${account.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.full_name, phone: account.phone },
    });
    if (error) throw new Error(`${account.email}: ${error.message}`);
    userId = data.user.id;
    console.log(`  Utilisateur créé : ${account.email}`);
  }

  await admin.from("profiles").upsert(
    { id: userId, phone: account.phone, full_name: account.full_name, whatsapp: account.phone },
    { onConflict: "id" }
  );

  return userId;
}

async function signIn(account) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return json;
}

async function signUp(account) {
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      data: { full_name: account.full_name, phone: account.phone },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.access_token) return json;
  if (res.ok && json.id) {
    return signIn(account);
  }
  if (json.msg?.includes("already registered") || json.error_description?.includes("already")) {
    return signIn(account);
  }
  throw new Error(`${account.email}: ${json.msg || json.error_description || res.status}`);
}

async function ensureUserViaAnon(account) {
  const session = (await signIn(account)) || (await signUp(account));
  if (!session?.access_token || !session?.user?.id) {
    throw new Error(`${account.email}: impossible de se connecter après inscription`);
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await client.from("profiles").upsert(
    {
      id: session.user.id,
      phone: account.phone,
      full_name: account.full_name,
      whatsapp: account.phone,
    },
    { onConflict: "id" }
  );

  console.log(`  Compte prêt : ${account.email}`);
  return { userId: session.user.id, client };
}

async function setupWithServiceRole() {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ownerId = await ensureUserViaAdmin(admin, ACCOUNTS.owner);
  const employeeId = await ensureUserViaAdmin(admin, ACCOUNTS.employee);

  const { data: existingStore } = await admin
    .from("stores")
    .select("id, name")
    .eq("owner_id", ownerId)
    .eq("name", STORE_NAME)
    .maybeSingle();

  let storeId = existingStore?.id;
  if (!storeId) {
    const { data: store, error } = await admin
      .from("stores")
      .insert({
        owner_id: ownerId,
        name: STORE_NAME,
        slug: STORE_SLUG,
        phone: ACCOUNTS.owner.phone,
        whatsapp: ACCOUNTS.owner.phone,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Boutique: ${error.message}`);
    storeId = store.id;
    console.log(`  Boutique créée : ${STORE_NAME}`);
  } else {
    console.log(`  Boutique existante : ${STORE_NAME}`);
  }

  const { error: memberError } = await admin.from("store_members").upsert(
    { store_id: storeId, user_id: employeeId, role: "employee" },
    { onConflict: "store_id,user_id" }
  );
  if (memberError) throw new Error(`Membre: ${memberError.message}`);
  console.log("  Employé ajouté à la boutique (rôle: employee)");
}

async function setupWithAnonKey() {
  console.log("  (mode anon — service role indisponible)\n");

  const { userId: employeeId } = await ensureUserViaAnon(ACCOUNTS.employee);
  const { userId: ownerId, client: ownerClient } = await ensureUserViaAnon(ACCOUNTS.owner);

  const { data: existingStore } = await ownerClient
    .from("stores")
    .select("id, name")
    .eq("owner_id", ownerId)
    .eq("name", STORE_NAME)
    .maybeSingle();

  let storeId = existingStore?.id;
  if (!storeId) {
    const { data: store, error } = await ownerClient
      .from("stores")
      .insert({
        owner_id: ownerId,
        name: STORE_NAME,
        slug: STORE_SLUG,
        phone: ACCOUNTS.owner.phone,
        whatsapp: ACCOUNTS.owner.phone,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Boutique: ${error.message}`);
    storeId = store.id;
    console.log(`  Boutique créée : ${STORE_NAME}`);
  } else {
    console.log(`  Boutique existante : ${STORE_NAME}`);
  }

  const { error: memberError } = await ownerClient.from("store_members").upsert(
    { store_id: storeId, user_id: employeeId, role: "employee" },
    { onConflict: "store_id,user_id" }
  );
  if (memberError) throw new Error(`Membre: ${memberError.message}`);
  console.log("  Employé ajouté à la boutique (rôle: employee)");
}

function printSummary() {
  console.log("\n=== Comptes prêts ===\n");
  console.log("Propriétaire");
  console.log(`  Email        : ${ACCOUNTS.owner.email}`);
  console.log(`  Mot de passe : ${ACCOUNTS.owner.password}`);
  console.log(`  Téléphone    : ${ACCOUNTS.owner.phone}`);
  console.log("\nEmployé");
  console.log(`  Email        : ${ACCOUNTS.employee.email}`);
  console.log(`  Mot de passe : ${ACCOUNTS.employee.password}`);
  console.log(`  Téléphone    : ${ACCOUNTS.employee.phone}`);
  console.log(`\nBoutique : ${STORE_NAME}`);
  console.log("\nValidation : connectez chaque compte sur wazo-digital.com/login");
}

async function main() {
  console.log("Création des comptes test Wazo Digital…\n");

  if (await serviceRoleWorks()) {
    console.log("  Mode : service role\n");
    await setupWithServiceRole();
  } else {
    if (serviceKey) {
      console.warn("  SUPABASE_SERVICE_ROLE_KEY invalide — bascule mode anon.\n");
    }
    await setupWithAnonKey();
  }

  printSummary();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
