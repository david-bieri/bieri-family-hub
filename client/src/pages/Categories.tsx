import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BUILTIN_IDS } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";

const PRESET_COLORS = [
  "#3b82f6","#8b5cf6","#22c55e","#f59e0b","#ef4444","#ec4899",
  "#06b6d4","#f97316","#10b981","#6366f1","#84cc16","#e11d48",
];

type Form = { name: string; color: string };
const blank: Form = { name: "", color: "#6366f1" };

export default function Categories() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => (await apiRequest("GET", "/api/categories")).json(),
  });

  const save = useMutation({
    mutationFn: async () =>
      editId
        ? (await apiRequest("PUT", `/api/categories/${editId}`, form)).json()
        : (await apiRequest("POST", "/api/categories", form)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
      setOpen(false);
      setForm(blank);
      setEditId(null);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/categories"] }),
  });

  function openEdit(cat: any) {
    setForm({ name: cat.name, color: cat.color });
    setEditId(cat.id);
    setOpen(true);
  }

  const builtins = categories.filter((c: any) => BUILTIN_IDS.includes(c.id));
  const custom = categories.filter((c: any) => !BUILTIN_IDS.includes(c.id));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Categories organize events across all modules. Create custom ones for anything that doesn't fit the defaults.
          </p>
        </div>
        <Button size="sm" onClick={() => { setForm(blank); setEditId(null); setOpen(true); }} data-testid="button-add-category">
          <Plus size={14} className="mr-1" /> New Category
        </Button>
      </div>

      {/* Built-in categories */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Lock size={11} /> Built-in (cannot be deleted)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {builtins.map((cat: any) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
              data-testid={`category-row-${cat.id}`}
            >
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="font-medium text-sm flex-1">{cat.name}</span>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => openEdit(cat)}
              >
                <Pencil size={12} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom categories */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Custom Categories {custom.length > 0 && `(${custom.length})`}
        </h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && custom.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground">
            <p className="text-sm">No custom categories yet.</p>
            <Button
              variant="outline" size="sm" className="mt-3"
              onClick={() => { setForm(blank); setEditId(null); setOpen(true); }}
            >
              Create your first category
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {custom.map((cat: any) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
              data-testid={`category-row-${cat.id}`}
            >
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="font-medium text-sm flex-1">{cat.name}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                  <Pencil size={12} />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                  onClick={() => del.mutate(cat.id)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setForm(blank); setEditId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit" : "New"} Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Piano Lessons"
                className="mt-1 h-8"
                data-testid="input-category-name"
              />
            </div>
            <div>
              <Label className="text-xs mb-2 block">Color</Label>
              {/* Preset swatches */}
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                  />
                ))}
              </div>
              {/* Custom hex input */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full shrink-0 border border-border" style={{ backgroundColor: form.color }} />
                <Input
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  placeholder="#6366f1"
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            {/* Preview */}
            <div>
              <Label className="text-xs mb-2 block">Preview</Label>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: form.color + "22", color: form.color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: form.color }} />
                {form.name || "Category name"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={!form.name || save.isPending}
              data-testid="button-save-category"
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
