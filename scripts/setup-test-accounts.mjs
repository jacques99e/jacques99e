/**
 * Crée ou met à jour deux comptes test : propriétaire + employé, liés à une boutique.
 * Usage : node scripts/setup-test-accounts.mjs
 * Requiert SUPABASE_SERVICE_ROLE_KEY et NEXT_PUBLIC_SUPABASE_URL dans .env.local
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

async function upsertUser({ email, password, phone, full_name }) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId;
  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { full_name, phone },
    });
    console.log(`  Utilisateur existant mis à jour : ${email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });
    if (error) throw new Error(`${email}: ${error.message}`);
    userId = data.user.id;
    console.log(`  Utilisateur créé : ${email}`);
  }

  await admin.from("profiles").upsert(
    { id: userId, phone, full_name, whatsapp: phone },
    { onConflict: "id" }
  );

  return userId;
}

async function main() {
  console.log("Création des comptes test Wazo Digital…\n");

  const ownerId = await upsertUser(ACCOUNTS.owner);
  const employeeId = await upsertUser(ACCOUNTS.employee);

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
        phone: ACCOUNTS.owner.phone,
        whatsapp: ACCOUNTS.owner.phone,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Boutique: ${error.message}`);
    storeId = store.id;
    console.log(`  Boutique créée : ${STORE_NAME} (${storeId})`);
  } else {
    console.log(`  Boutique existante : ${STORE_NAME} (${storeId})`);
  }

  const { error: memberError } = await admin.from("store_members").upsert(
    {
      store_id: storeId,
      user_id: employeeId,
      role: "employee",
    },
    { onConflict: "store_id,user_id" }
  );
  if (memberError) throw new Error(`Membre: ${memberError.message}`);
  console.log("  Employé ajouté à la boutique (rôle: employee)\n");

  console.log("=== Comptes prêts ===\n");
  console.log("Propriétaire");
  console.log(`  Email    : ${ACCOUNTS.owner.email}`);
  console.log(`  Mot de passe : ${ACCOUNTS.owner.password}`);
  console.log(`  Téléphone : ${ACCOUNTS.owner.phone}`);
  console.log("\nEmployé");
  console.log(`  Email    : ${ACCOUNTS.employee.email}`);
  console.log(`  Mot de passe : ${ACCOUNTS.employee.password}`);
  console.log(`  Téléphone : ${ACCOUNTS.employee.phone}`);
  console.log(`\nBoutique : ${STORE_NAME}`);
  console.log("\nValidation rôles :");
  console.log("  1. Connectez le propriétaire → Paramètres > Équipe : voir l'employé");
  console.log("  2. Connectez l'employé → caisse/clients OK, paramètres équipe bloqués");
  console.log("\nVoir docs/TEST-ACCOUNTS.md pour la matrice complète.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
