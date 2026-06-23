import { getToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type TokenResponse = { access_token: string; token_type: string };

export type AvatarResponse = {
  avatar_id: string;
  photo_url: string;
};

export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type Category = "tops" | "bottoms" | "dresses";

export type WardrobeItem = {
  id: string;
  category: Category;
  image_url: string;
  clean_image_url: string | null;
  name: string | null;
  color: string | null;
  pattern: string | null;
  formality: string | null;
  season: string | null;
  warmth: number | null;
  user_notes: string | null;
  conditions: string | null;
  is_favorite: boolean;
  tagging_status: "pending" | "done" | "failed";
  created_at: string;
};

export type Outfit = {
  id: string;
  prompt: string | null;
  reasoning: string | null;
  item_ids: string[];
  source: "llm" | "manual";
  items: WardrobeItem[];
  result_url: string | null;
  render_status: "draft" | "rendering" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
};

export type StylistSuggestResult = {
  outfit_id: string;
  item_ids: string[];
  reasoning: string;
  decline: boolean;
};

export type StylistMessage = {
  id: string;
  role: string;
  content: string;
  outfit_id: string | null;
  created_at: string;
};

export type WardrobeItemUpdate = {
  category?: Category;
  name?: string | null;
  user_notes?: string | null;
  conditions?: string | null;
  is_favorite?: boolean;
};

export type TryOnStatus = {
  job_id: string;
  status: JobStatus;
  result_url?: string | null;
  garment_url?: string | null;
  source_url?: string | null;
  category?: Category | null;
  error?: string | null;
  created_at: string;
};

async function request<T>(
  path: string,
  opts: RequestInit = {},
  isForm = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...headers, ...(opts.headers as Record<string, string>) },
  });

  if (!res.ok) {
    let detail = "Request failed";
    try {
      const body = await res.json();
      detail = body.detail || body.message || JSON.stringify(body);
    } catch {
      try {
        detail = await res.text();
      } catch {}
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  register(email: string, password: string) {
    return request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  login(email: string, password: string) {
    return request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return request<{ id: string; email: string }>("/auth/me");
  },
  myAvatar() {
    return request<AvatarResponse | null>("/avatar/me").catch((e) => {
      if (String(e.message).toLowerCase().includes("no avatar")) return null;
      throw e;
    });
  },
  uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append("photo", file);
    return request<AvatarResponse>(
      "/avatar/upload",
      { method: "POST", body: fd },
      true,
    );
  },
  tryOnUrl(garment_url: string, description?: string) {
    return request<{ job_id: string; status: JobStatus }>("/tryon/url", {
      method: "POST",
      body: JSON.stringify({ garment_url, description }),
    });
  },
  tryOnUpload(garment: File, description?: string) {
    const fd = new FormData();
    fd.append("garment_image", garment);
    if (description) fd.append("description", description);
    return request<{ job_id: string; status: JobStatus }>(
      "/tryon/upload",
      { method: "POST", body: fd },
      true,
    );
  },
  jobStatus(id: string) {
    return request<TryOnStatus>(`/tryon/${id}`);
  },
  history() {
    return request<TryOnStatus[]>("/tryon/history");
  },
  changePassword(current_password: string, new_password: string) {
    return request<void>("/settings/password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    });
  },
  clearHistory() {
    return request<void>("/settings/history", { method: "DELETE" });
  },
  deleteAccount() {
    return request<void>("/settings/account", { method: "DELETE" });
  },
  listWardrobe(params?: {
    category?: Category;
    color?: string;
    season?: string;
    favorites_only?: boolean;
  }) {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.color) q.set("color", params.color);
    if (params?.season) q.set("season", params.season);
    if (params?.favorites_only) q.set("favorites_only", "true");
    const qs = q.toString();
    return request<WardrobeItem[]>(`/wardrobe/items${qs ? `?${qs}` : ""}`);
  },
  addWardrobeItem(file: File, category: Category) {
    const fd = new FormData();
    fd.append("photo", file);
    fd.append("category", category);
    return request<WardrobeItem>(
      "/wardrobe/items",
      { method: "POST", body: fd },
      true,
    );
  },
  updateWardrobeItem(id: string, data: WardrobeItemUpdate) {
    return request<WardrobeItem>(`/wardrobe/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  deleteWardrobeItem(id: string) {
    return request<void>(`/wardrobe/items/${id}`, { method: "DELETE" });
  },
  retagWardrobeItem(id: string) {
    return request<WardrobeItem>(`/wardrobe/items/${id}/retag`, {
      method: "POST",
    });
  },
  createOutfit(item_ids: string[]) {
    return request<Outfit>("/outfits", {
      method: "POST",
      body: JSON.stringify({ item_ids }),
    });
  },
  listOutfits() {
    return request<Outfit[]>("/outfits");
  },
  getOutfit(id: string) {
    return request<Outfit>(`/outfits/${id}`);
  },
  renderOutfit(id: string) {
    return request<{ outfit_id: string; render_status: string }>(
      `/outfits/${id}/render`,
      { method: "POST" },
    );
  },
  stylistSuggest(prompt: string, locked_item_ids: string[] = []) {
    return request<StylistSuggestResult>("/stylist/suggest", {
      method: "POST",
      body: JSON.stringify({ prompt, locked_item_ids }),
    });
  },
  stylistReroll(prompt: string, locked_item_ids: string[] = []) {
    return request<StylistSuggestResult>("/stylist/reroll", {
      method: "POST",
      body: JSON.stringify({ prompt, locked_item_ids }),
    });
  },
  stylistAsk(prompt: string, item_ids: string[] = []) {
    return request<{ reply: string }>("/stylist/ask", {
      method: "POST",
      body: JSON.stringify({ prompt, item_ids }),
    });
  },
  stylistMessages() {
    return request<StylistMessage[]>("/stylist/messages");
  },
};
