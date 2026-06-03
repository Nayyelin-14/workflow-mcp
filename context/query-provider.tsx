"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({}));

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ဒီ QueryProvider က React Query ရဲ့ Cache Manager (QueryClient) ကို
//  App တစ်ခုလုံးမှာ Share လုပ်နိုင်အောင် Context Provider
// ထိုးထားတဲ့ Component ဖြစ်တယ်။ useState(() => new QueryClient())
//  သုံးထားတာက Re-render တိုင်း QueryClient အသစ်မဖန်တီးဘဲ Cache
// မပျောက်အောင်
