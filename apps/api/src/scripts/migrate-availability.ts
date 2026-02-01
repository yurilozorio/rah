/**
 * Migration script: Convert legacy ServiceAvailability to new AvailabilitySchedule structure
 * 
 * Run with: npx tsx apps/api/src/scripts/migrate-availability.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateAvailability() {
  console.log("Starting availability migration...\n");

  // Get all unique service IDs from legacy table
  const legacyRules = await prisma.serviceAvailability.findMany({
    where: { isActive: true },
    orderBy: [{ serviceId: "asc" }, { weekday: "asc" }]
  });

  if (legacyRules.length === 0) {
    console.log("No legacy availability rules found. Nothing to migrate.");
    return;
  }

  // Group rules by service ID
  const rulesByService = new Map<number, typeof legacyRules>();
  for (const rule of legacyRules) {
    const existing = rulesByService.get(rule.serviceId) ?? [];
    existing.push(rule);
    rulesByService.set(rule.serviceId, existing);
  }

  console.log(`Found ${legacyRules.length} legacy rules for ${rulesByService.size} services.\n`);

  // Check if new schedules already exist
  const existingSchedules = await prisma.availabilitySchedule.count();
  if (existingSchedules > 0) {
    console.log(`Warning: ${existingSchedules} schedules already exist in new format.`);
    console.log("Skipping migration to avoid duplicates.\n");
    console.log("To force migration, delete existing AvailabilitySchedule records first.");
    return;
  }

  // Migrate each service
  for (const [serviceId, rules] of rulesByService) {
    console.log(`Migrating service ${serviceId}...`);

    // Group by weekday (in case there are multiple time windows per day)
    const rulesByWeekday = new Map<number, typeof rules>();
    for (const rule of rules) {
      const existing = rulesByWeekday.get(rule.weekday) ?? [];
      existing.push(rule);
      rulesByWeekday.set(rule.weekday, existing);
    }

    // Create schedules for each day
    for (let weekday = 0; weekday < 7; weekday++) {
      const dayRules = rulesByWeekday.get(weekday) ?? [];
      const isAvailable = dayRules.length > 0;

      await prisma.availabilitySchedule.create({
        data: {
          serviceId,
          weekday,
          isAvailable,
          timeWindows: {
            create: dayRules.map((rule) => ({
              startMinute: rule.startMinute,
              endMinute: rule.endMinute
            }))
          }
        }
      });
    }

    console.log(`  - Created 7 day schedules with ${rules.length} time windows`);
  }

  console.log("\nMigration complete!");
  console.log("\nNote: Legacy ServiceAvailability records were NOT deleted.");
  console.log("The system will automatically prefer new AvailabilitySchedule records.");
  console.log("You can delete legacy records once you've verified the migration worked correctly.");
}

async function createDefaultGlobalSchedule() {
  console.log("\nChecking for global schedule...\n");

  const existingGlobal = await prisma.availabilitySchedule.count({
    where: { serviceId: null }
  });

  if (existingGlobal > 0) {
    console.log("Global schedule already exists. Skipping.");
    return;
  }

  console.log("Creating default global schedule (Mon-Sat, 9am-7pm)...");

  // Create default global schedule
  for (let weekday = 0; weekday < 7; weekday++) {
    const isWorkday = weekday >= 1 && weekday <= 6; // Mon-Sat

    await prisma.availabilitySchedule.create({
      data: {
        serviceId: null, // null = global
        weekday,
        isAvailable: isWorkday,
        timeWindows: isWorkday
          ? {
              create: [
                {
                  startMinute: 540, // 9:00 AM
                  endMinute: 1140 // 7:00 PM
                }
              ]
            }
          : undefined
      }
    });
  }

  console.log("Default global schedule created!");
}

async function main() {
  try {
    await migrateAvailability();
    await createDefaultGlobalSchedule();
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
