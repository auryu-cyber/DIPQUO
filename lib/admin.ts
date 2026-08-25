import { getJsonFile } from "@/lib/github";

interface AdminsConfig {
  admins: string[];
}

export async function isAdminEmail(email: string): Promise<boolean> {
  const config = await getJsonFile<AdminsConfig>("config/admins.json");
  if (!config) return false;
  return config.data.admins.includes(email.toLowerCase()) || config.data.admins.includes(email);
}
