import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminGeminiFood } from '@/core/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { UtensilsCrossed, Check, Pencil, Trash2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';

type StatusFilter = 'all' | 'unverified' | 'verified';
const PAGE_SIZE = 50;

function EditFoodDialog({
  food,
  open,
  onOpenChange,
  onSave,
}: {
  food: AdminGeminiFood;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; calories: number; protein: number; carbs: number; fat: number }) => void;
}) {
  const [name, setName] = useState(food.name);
  const [calories, setCalories] = useState(String(food.calories));
  const [protein, setProtein] = useState(String(food.protein));
  const [carbs, setCarbs] = useState(String(food.carbs));
  const [fat, setFat] = useState(String(food.fat));

  const handleSave = () => {
    onSave({
      name: name.trim(),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Food</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Calories</label>
              <Input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Protein (g)</label>
              <Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Carbs (g)</label>
              <Input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Fat (g)</label>
              <Input type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminFoodsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [offset, setOffset] = useState(0);
  const [editingFood, setEditingFood] = useState<AdminGeminiFood | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'gemini-foods', status, offset],
    queryFn: () => adminApi.getGeminiFoods(status, PAGE_SIZE, offset),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'gemini-foods'] });
  };

  const verifyMutation = useMutation({
    mutationFn: (id: string) => adminApi.updateFood(id, { verified: true }),
    onSuccess: () => { toast.success('Food verified'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminApi.updateFood>[1] }) =>
      adminApi.updateFood(id, data),
    onSuccess: () => { toast.success('Food updated'); invalidate(); setEditingFood(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteFood(id),
    onSuccess: () => { toast.success('Food deleted'); invalidate(); setDeletingId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const foods = data?.foods ?? [];
  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Gemini Food Review</h2>
        <span className="text-sm text-muted-foreground">({total} total)</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(['all', 'unverified', 'verified'] as StatusFilter[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => { setStatus(s); setOffset(0); }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

      {/* Food list */}
      <div className="space-y-2">
        {foods.map((food) => (
          <Card key={food.id}>
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{food.name}</span>
                  <Badge className="text-xs bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 gap-1">
                    <Sparkles className="w-3 h-3" />
                    Gemini AI
                  </Badge>
                  {food.isLiquid && <Badge variant="outline" className="text-xs">liquid</Badge>}
                  <Badge variant={food.verified ? 'default' : 'secondary'} className={food.verified ? 'bg-success/10 text-success border-success/30 hover:bg-success/10' : ''}>
                    {food.verified ? `✓ Verified${food.verifiedAt ? ` ${new Date(food.verifiedAt).toLocaleDateString()}` : ''}` : '⚠ Needs review'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {food.calories} kcal | P: {food.protein}g | C: {food.carbs}g | F: {food.fat}g
                  <span className="ml-2 text-xs">
                    Added {new Date(food.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                {!food.verified && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => verifyMutation.mutate(food.id)}
                    disabled={verifyMutation.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Verify
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingFood(food)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive/80"
                  onClick={() => setDeletingId(food.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && foods.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            No Gemini-created foods found.
          </p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Edit dialog */}
      {editingFood && (
        <EditFoodDialog
          food={editingFood}
          open={!!editingFood}
          onOpenChange={(open) => { if (!open) setEditingFood(null); }}
          onSave={(data) => updateMutation.mutate({ id: editingFood.id, data })}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Food</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this food? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
