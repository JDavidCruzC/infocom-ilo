import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SecurityFlags = {
  allow_delete_transactions: boolean;
};

export const DEFAULT_SECURITY_FLAGS: SecurityFlags = {
  allow_delete_transactions: false,
};

const KEY = "security_flags";

export const useSecurityFlags = () => {
  return useQuery({
    queryKey: ["store_settings", KEY],
    queryFn: async (): Promise<SecurityFlags> => {
      const { data } = await supabase
        .from("store_settings")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      return { ...DEFAULT_SECURITY_FLAGS, ...((data?.value as any) || {}) };
    },
    staleTime: 60_000,
  });
};

export const useSetSecurityFlag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<SecurityFlags>) => {
      const { data: existing } = await supabase
        .from("store_settings")
        .select("id, value")
        .eq("key", KEY)
        .maybeSingle();
      const merged = { ...DEFAULT_SECURITY_FLAGS, ...((existing?.value as any) || {}), ...patch };
      if (existing) {
        const { error } = await supabase
          .from("store_settings")
          .update({ value: merged as any })
          .eq("key", KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_settings")
          .insert({ key: KEY, value: merged as any });
        if (error) throw error;
      }
      return merged;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store_settings", KEY] });
    },
  });
};
